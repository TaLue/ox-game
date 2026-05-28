import { Injectable } from '@nestjs/common';
import { Difficulty, LeaderboardEntry, ScoreDto } from '@ox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type GameResult = 'PLAYER_WIN' | 'BOT_WIN' | 'DRAW';

/**
 * Redis Lua — atomically updates the per-difficulty streak hash and leaderboard ZSET.
 * RULE-SCORE-06: single Lua call prevents race conditions.
 *
 * KEYS[1] = score:{userId}       (hash: easyStreak, easyBest, hardStreak, hardBest)
 * KEYS[2] = leaderboard:easy|hard (sorted set by bestStreak)
 * ARGV[1] = result   (PLAYER_WIN | BOT_WIN | DRAW)
 * ARGV[2] = userId
 * ARGV[3] = diff     ('easy' | 'hard')
 * Returns { currentStreak, bestStreak }
 */
const LUA_SCORE = `
local curField  = ARGV[3] .. 'Streak'
local bestField = ARGV[3] .. 'Best'
local cur  = tonumber(redis.call('HGET', KEYS[1], curField)  or '0') or 0
local best = tonumber(redis.call('HGET', KEYS[1], bestField) or '0') or 0

if ARGV[1] == 'PLAYER_WIN' then
  cur = cur + 1
  if cur > best then best = cur end
elseif ARGV[1] == 'BOT_WIN' then
  cur = 0
end

redis.call('HSET', KEYS[1], curField, cur, bestField, best)
redis.call('ZADD', KEYS[2], best, ARGV[2])
return { cur, best }
`;

@Injectable()
export class ScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Reads hot value from Redis; falls back to Postgres if key absent (D12). */
  async getScore(userId: string): Promise<ScoreDto> {
    const h = await this.redis.client.hgetall(`score:${userId}`);
    if (h && Object.keys(h).length > 0) {
      return {
        easyCurrentStreak: Number(h.easyStreak ?? 0),
        easyBestStreak:    Number(h.easyBest   ?? 0),
        hardCurrentStreak: Number(h.hardStreak ?? 0),
        hardBestStreak:    Number(h.hardBest   ?? 0),
      };
    }
    const score = await this.prisma.score.findUnique({ where: { userId } });
    return {
      easyCurrentStreak: score?.easyCurrentStreak ?? 0,
      easyBestStreak:    score?.easyBestStreak    ?? 0,
      hardCurrentStreak: score?.hardCurrentStreak ?? 0,
      hardBestStreak:    score?.hardBestStreak    ?? 0,
    };
  }

  /**
   * Atomically applies streak rules via Lua (RULE-SCORE-06), then persists to Postgres.
   * Streak tracking is per-difficulty — EASY and HARD are independent.
   */
  async applyScore(
    userId: string,
    result: GameResult,
    difficulty: Difficulty,
  ): Promise<{ score: ScoreDto }> {
    const diff = difficulty.toLowerCase(); // 'easy' | 'hard'
    const lbKey = `leaderboard:${diff}`;

    const raw = await this.redis.client.eval(
      LUA_SCORE,
      2,
      `score:${userId}`,
      lbKey,
      result,
      userId,
      diff,
    ) as [number, number];

    const [cur, best] = raw;

    // Read the other difficulty's current values to build the full ScoreDto
    const other = await this.getScore(userId);

    if (difficulty === 'EASY') {
      await this.prisma.score.upsert({
        where:  { userId },
        create: { userId, easyCurrentStreak: cur, easyBestStreak: best },
        update: { easyCurrentStreak: cur, easyBestStreak: best },
      });
      return {
        score: {
          easyCurrentStreak: cur,
          easyBestStreak:    best,
          hardCurrentStreak: other.hardCurrentStreak,
          hardBestStreak:    other.hardBestStreak,
        },
      };
    } else {
      await this.prisma.score.upsert({
        where:  { userId },
        create: { userId, hardCurrentStreak: cur, hardBestStreak: best },
        update: { hardCurrentStreak: cur, hardBestStreak: best },
      });
      return {
        score: {
          easyCurrentStreak: other.easyCurrentStreak,
          easyBestStreak:    other.easyBestStreak,
          hardCurrentStreak: cur,
          hardBestStreak:    best,
        },
      };
    }
  }

  /** Returns top-N players from Redis ZSET for a given difficulty; rebuilds from Postgres if empty (D12). */
  async getLeaderboard(limit = 10, difficulty: Difficulty = 'HARD'): Promise<LeaderboardEntry[]> {
    const diff  = difficulty.toLowerCase();
    const lbKey = `leaderboard:${diff}`;
    const bestField = difficulty === 'EASY' ? 'easyBestStreak' : 'hardBestStreak';

    const raw = await this.redis.client.zrevrange(lbKey, 0, limit - 1, 'WITHSCORES');
    if (raw.length > 0) {
      return this.entriesToLeaderboard(raw);
    }

    // D12: rebuild from Postgres when Redis is flushed
    const scores = await this.prisma.score.findMany({
      orderBy: { [bestField]: 'desc' },
      take: limit,
      include: { user: { select: { displayName: true } } },
    });
    return scores.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      displayName: s.user.displayName,
      bestStreak: s[bestField],
    }));
  }

  private async entriesToLeaderboard(raw: string[]): Promise<LeaderboardEntry[]> {
    const result: LeaderboardEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const userId    = raw[i];
      const bestStreak = Number(raw[i + 1]);
      const user = await this.prisma.user.findUnique({
        where:  { id: userId },
        select: { displayName: true },
      });
      result.push({
        rank: result.length + 1,
        userId,
        displayName: user?.displayName ?? userId,
        bestStreak,
      });
    }
    return result;
  }
}
