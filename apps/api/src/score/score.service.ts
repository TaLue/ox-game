import { Injectable } from '@nestjs/common';
import { Difficulty, LeaderboardEntry, ScoreDto } from '@ox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type GameResult = 'PLAYER_WIN' | 'BOT_WIN' | 'DRAW';

/**
 * Redis Lua — atomically applies point scoring to per-difficulty hash and updates leaderboard ZSET.
 * RULE-SCORE-06: single Lua call prevents race conditions.
 *
 * KEYS[1] = score:{userId}        (hash: easyScore, easyConsWins, hardScore, hardConsWins)
 * KEYS[2] = leaderboard:easy|hard (sorted set ranked by total score)
 * ARGV[1] = result   (PLAYER_WIN | BOT_WIN | DRAW)
 * ARGV[2] = userId
 * ARGV[3] = diff     ('easy' | 'hard')
 * Returns { score, consecutiveWins }
 */
const LUA_SCORE = `
local scoreField = ARGV[3] .. 'Score'
local consField  = ARGV[3] .. 'ConsWins'
local sc   = tonumber(redis.call('HGET', KEYS[1], scoreField) or '0') or 0
local cons = tonumber(redis.call('HGET', KEYS[1], consField)  or '0') or 0

if ARGV[1] == 'PLAYER_WIN' then
  sc = sc + 1
  cons = cons + 1
  if cons == 3 then
    sc = sc + 1
    cons = 0
  end
elseif ARGV[1] == 'BOT_WIN' then
  if sc > 0 then sc = sc - 1 end
  cons = 0
end

redis.call('HSET', KEYS[1], scoreField, sc, consField, cons)
redis.call('ZADD', KEYS[2], sc, ARGV[2])
return { sc, cons }
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
        easyScore:           Number(h.easyScore    ?? 0),
        easyConsecutiveWins: Number(h.easyConsWins ?? 0),
        hardScore:           Number(h.hardScore    ?? 0),
        hardConsecutiveWins: Number(h.hardConsWins ?? 0),
      };
    }
    const score = await this.prisma.score.findUnique({ where: { userId } });
    return {
      easyScore:           score?.easyScore           ?? 0,
      easyConsecutiveWins: score?.easyConsecutiveWins ?? 0,
      hardScore:           score?.hardScore           ?? 0,
      hardConsecutiveWins: score?.hardConsecutiveWins ?? 0,
    };
  }

  /**
   * Atomically applies scoring rules via Lua (RULE-SCORE-06), then persists to Postgres.
   * Score tracking is per-difficulty — EASY and HARD are independent.
   */
  async applyScore(
    userId: string,
    result: GameResult,
    difficulty: Difficulty,
  ): Promise<{ score: ScoreDto }> {
    const diff  = difficulty.toLowerCase(); // 'easy' | 'hard'
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

    const [sc, cons] = raw;
    const other = await this.getScore(userId);

    if (difficulty === 'EASY') {
      await this.prisma.score.upsert({
        where:  { userId },
        create: { userId, easyScore: sc, easyConsecutiveWins: cons },
        update: { easyScore: sc, easyConsecutiveWins: cons },
      });
      return {
        score: {
          easyScore:           sc,
          easyConsecutiveWins: cons,
          hardScore:           other.hardScore,
          hardConsecutiveWins: other.hardConsecutiveWins,
        },
      };
    } else {
      await this.prisma.score.upsert({
        where:  { userId },
        create: { userId, hardScore: sc, hardConsecutiveWins: cons },
        update: { hardScore: sc, hardConsecutiveWins: cons },
      });
      return {
        score: {
          easyScore:           other.easyScore,
          easyConsecutiveWins: other.easyConsecutiveWins,
          hardScore:           sc,
          hardConsecutiveWins: cons,
        },
      };
    }
  }

  /** Returns top-N players from Redis ZSET for a given difficulty; rebuilds from Postgres if empty (D12). */
  async getLeaderboard(limit = 10, difficulty: Difficulty = 'HARD'): Promise<LeaderboardEntry[]> {
    const diff    = difficulty.toLowerCase();
    const lbKey   = `leaderboard:${diff}`;
    const scoreField = difficulty === 'EASY' ? 'easyScore' : 'hardScore';

    const raw = await this.redis.client.zrevrange(lbKey, 0, limit - 1, 'WITHSCORES');
    if (raw.length > 0) {
      return this.entriesToLeaderboard(raw);
    }

    // D12: rebuild from Postgres when Redis is flushed
    const scores = await this.prisma.score.findMany({
      orderBy: { [scoreField]: 'desc' },
      take: limit,
      include: { user: { select: { displayName: true } } },
    });
    return scores.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      displayName: s.user.displayName,
      score: s[scoreField as keyof typeof s] as number,
    }));
  }

  private async entriesToLeaderboard(raw: string[]): Promise<LeaderboardEntry[]> {
    const result: LeaderboardEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const userId = raw[i];
      const score  = Number(raw[i + 1]);
      const user   = await this.prisma.user.findUnique({
        where:  { id: userId },
        select: { displayName: true },
      });
      result.push({
        rank: result.length + 1,
        userId,
        displayName: user?.displayName ?? userId,
        score,
      });
    }
    return result;
  }
}
