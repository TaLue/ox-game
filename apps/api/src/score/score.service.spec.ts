import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ScoreService } from './score.service';

const ZERO_SCORE = { easyCurrentStreak: 0, easyBestStreak: 0, hardCurrentStreak: 0, hardBestStreak: 0 };

function makePrisma() {
  return {
    score: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ displayName: 'Test User' }),
    },
  };
}

function makeRedis(evalResult: [number, number] = [1, 1]) {
  return {
    client: {
      eval: jest.fn().mockResolvedValue(evalResult),
      hgetall: jest.fn().mockResolvedValue(null),
      zrevrange: jest.fn().mockResolvedValue([]),
    },
  };
}

async function buildService(prisma: ReturnType<typeof makePrisma>, redis: ReturnType<typeof makeRedis>): Promise<ScoreService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ScoreService,
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: redis },
    ],
  }).compile();
  return module.get(ScoreService);
}

// ── getScore ─────────────────────────────────────────────────────────────────

describe('ScoreService.getScore', () => {
  it('returns Redis hot value when present', async () => {
    const redis = makeRedis();
    redis.client.hgetall.mockResolvedValue({ easyStreak: '3', easyBest: '5', hardStreak: '1', hardBest: '2' });
    const svc = await buildService(makePrisma(), redis);
    expect(await svc.getScore('user-1')).toEqual({
      easyCurrentStreak: 3, easyBestStreak: 5, hardCurrentStreak: 1, hardBestStreak: 2,
    });
  });

  it('falls back to Postgres when Redis key absent', async () => {
    const prisma = makePrisma();
    prisma.score.findUnique.mockResolvedValue({
      easyCurrentStreak: 2, easyBestStreak: 4, hardCurrentStreak: 0, hardBestStreak: 1,
    });
    const svc = await buildService(prisma, makeRedis());
    expect(await svc.getScore('user-1')).toEqual({
      easyCurrentStreak: 2, easyBestStreak: 4, hardCurrentStreak: 0, hardBestStreak: 1,
    });
  });

  it('returns zeros when neither Redis nor Postgres has the score', async () => {
    const svc = await buildService(makePrisma(), makeRedis());
    expect(await svc.getScore('user-1')).toEqual(ZERO_SCORE);
  });
});

// ── applyScore ────────────────────────────────────────────────────────────────

describe('ScoreService.applyScore', () => {
  it('calls Lua eval with correct keys and difficulty arg (RULE-SCORE-06)', async () => {
    const redis = makeRedis([1, 1]);
    const svc = await buildService(makePrisma(), redis);
    await svc.applyScore('user-1', 'PLAYER_WIN', 'EASY');
    expect(redis.client.eval).toHaveBeenCalledWith(
      expect.any(String), 2,
      'score:user-1', 'leaderboard:easy',
      'PLAYER_WIN', 'user-1', 'easy',
    );
  });

  it('uses leaderboard:hard for HARD difficulty (RULE-SCORE-06)', async () => {
    const redis = makeRedis([1, 1]);
    const svc = await buildService(makePrisma(), redis);
    await svc.applyScore('user-1', 'PLAYER_WIN', 'HARD');
    expect(redis.client.eval).toHaveBeenCalledWith(
      expect.any(String), 2,
      'score:user-1', 'leaderboard:hard',
      'PLAYER_WIN', 'user-1', 'hard',
    );
  });

  it('returns updated easyStreak in ScoreDto for EASY win (RULE-SCORE-01)', async () => {
    const svc = await buildService(makePrisma(), makeRedis([3, 3]));
    const { score } = await svc.applyScore('user-1', 'PLAYER_WIN', 'EASY');
    expect(score.easyCurrentStreak).toBe(3);
    expect(score.easyBestStreak).toBe(3);
  });

  it('returns updated hardStreak in ScoreDto for HARD win (RULE-SCORE-01)', async () => {
    const svc = await buildService(makePrisma(), makeRedis([2, 5]));
    const { score } = await svc.applyScore('user-1', 'PLAYER_WIN', 'HARD');
    expect(score.hardCurrentStreak).toBe(2);
    expect(score.hardBestStreak).toBe(5);
  });

  it('upserts Postgres with correct fields for EASY (RULE-SCORE-08)', async () => {
    const prisma = makePrisma();
    const svc = await buildService(prisma, makeRedis([2, 2]));
    await svc.applyScore('user-1', 'PLAYER_WIN', 'EASY');
    expect(prisma.score.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
      create: expect.objectContaining({ userId: 'user-1', easyCurrentStreak: 2, easyBestStreak: 2 }),
      update: expect.objectContaining({ easyCurrentStreak: 2, easyBestStreak: 2 }),
    }));
  });
});

// ── getLeaderboard ────────────────────────────────────────────────────────────

describe('ScoreService.getLeaderboard', () => {
  it('reads from leaderboard:hard by default', async () => {
    const redis = makeRedis();
    const svc = await buildService(makePrisma(), redis);
    await svc.getLeaderboard(10);
    expect(redis.client.zrevrange).toHaveBeenCalledWith('leaderboard:hard', 0, 9, 'WITHSCORES');
  });

  it('reads from leaderboard:easy when difficulty=EASY', async () => {
    const redis = makeRedis();
    const svc = await buildService(makePrisma(), redis);
    await svc.getLeaderboard(10, 'EASY');
    expect(redis.client.zrevrange).toHaveBeenCalledWith('leaderboard:easy', 0, 9, 'WITHSCORES');
  });

  it('returns entries from Redis ZSET with rank and bestStreak', async () => {
    const redis = makeRedis();
    redis.client.zrevrange.mockResolvedValue(['user-1', '7', 'user-2', '4']);
    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce({ displayName: 'Alice' })
      .mockResolvedValueOnce({ displayName: 'Bob' });
    const svc = await buildService(prisma, redis);
    const result = await svc.getLeaderboard(10, 'HARD');
    expect(result).toEqual([
      { rank: 1, userId: 'user-1', displayName: 'Alice', bestStreak: 7 },
      { rank: 2, userId: 'user-2', displayName: 'Bob', bestStreak: 4 },
    ]);
  });

  it('falls back to Postgres when Redis ZSET is empty (D12)', async () => {
    const prisma = makePrisma();
    prisma.score.findMany.mockResolvedValue([
      { userId: 'user-1', hardBestStreak: 5, user: { displayName: 'Alice' } },
    ]);
    const svc = await buildService(prisma, makeRedis());
    const result = await svc.getLeaderboard(10, 'HARD');
    expect(result[0]).toMatchObject({ rank: 1, userId: 'user-1', bestStreak: 5 });
  });
});
