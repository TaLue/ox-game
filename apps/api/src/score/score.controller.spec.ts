/**
 * Integration tests for ScoreController — requires Docker postgres + redis.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { validate } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { ScoreModule } from './score.module';

const TEST_USER = { id: 'test-score-user', email: 'score@test.com', role: 'PLAYER' as const };

const mockAuth = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = TEST_USER;
    return true;
  },
};

describe('ScoreController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate }),
        PrismaModule,
        RedisModule,
        ScoreModule,
      ],
      providers: [{ provide: APP_GUARD, useValue: mockAuth }],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = module.get(PrismaService);
    redis = module.get(RedisService);

    await prisma.user.upsert({
      where: { id: TEST_USER.id },
      create: {
        id: TEST_USER.id,
        provider: 'test',
        providerId: 'score-sub',
        email: TEST_USER.email,
        displayName: 'Score Test User',
        role: 'PLAYER',
      },
      update: {},
    });
  });

  afterEach(async () => {
    await prisma.score.deleteMany({ where: { userId: TEST_USER.id } });
    await redis.client.del(`score:${TEST_USER.id}`);
    await redis.client.zrem('leaderboard:easy', TEST_USER.id);
    await redis.client.zrem('leaderboard:hard', TEST_USER.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: TEST_USER.id } });
    await app.close();
  });

  // ── GET /api/scores/me ────────────────────────────────────────────────────────

  describe('GET /api/scores/me', () => {
    it('returns 200 with zeros for a user with no score', async () => {
      const res = await request(app.getHttpServer()).get('/api/scores/me');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        easyCurrentStreak: 0, easyBestStreak: 0,
        hardCurrentStreak: 0, hardBestStreak: 0,
      });
    });

    it('returns 200 with existing Redis hot value', async () => {
      await redis.client.hset(`score:${TEST_USER.id}`,
        'easyStreak', 3, 'easyBest', 5, 'hardStreak', 1, 'hardBest', 2,
      );
      const res = await request(app.getHttpServer()).get('/api/scores/me');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        easyCurrentStreak: 3, easyBestStreak: 5,
        hardCurrentStreak: 1, hardBestStreak: 2,
      });
    });
  });

  // ── GET /api/leaderboard ──────────────────────────────────────────────────────

  describe('GET /api/leaderboard', () => {
    beforeEach(async () => {
      await redis.client.del('leaderboard:easy');
      await redis.client.del('leaderboard:hard');
      await prisma.score.deleteMany();
    });

    it('returns 200 with empty array when no scores exist', async () => {
      const res = await request(app.getHttpServer()).get('/api/leaderboard');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('reads leaderboard:hard by default', async () => {
      await redis.client.zadd('leaderboard:hard', 7, TEST_USER.id);
      const res = await request(app.getHttpServer()).get('/api/leaderboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ rank: 1, userId: TEST_USER.id, bestStreak: 7 });
    });

    it('reads leaderboard:easy when ?difficulty=EASY', async () => {
      await redis.client.zadd('leaderboard:easy', 4, TEST_USER.id);
      const res = await request(app.getHttpServer()).get('/api/leaderboard?difficulty=EASY');
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ rank: 1, userId: TEST_USER.id, bestStreak: 4 });
    });

    it('respects ?limit query param', async () => {
      await redis.client.zadd('leaderboard:hard', 10, TEST_USER.id);
      const res = await request(app.getHttpServer()).get('/api/leaderboard?limit=1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('falls back to Postgres when Redis ZSET is empty (D12)', async () => {
      await prisma.score.upsert({
        where: { userId: TEST_USER.id },
        create: { userId: TEST_USER.id, hardBestStreak: 5 },
        update: { hardBestStreak: 5 },
      });
      const res = await request(app.getHttpServer()).get('/api/leaderboard');
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ userId: TEST_USER.id, bestStreak: 5 });
    });
  });

  // ── Concurrency (RULE-SCORE-06) ───────────────────────────────────────────────

  describe('RULE-SCORE-06: atomic scoring under concurrency', () => {
    it('two concurrent applyScore calls produce consistent streak (RULE-SCORE-06)', async () => {
      const { ScoreService } = await import('./score.service');
      const svc = app.get(ScoreService);

      const [r1, r2] = await Promise.all([
        svc.applyScore(TEST_USER.id, 'PLAYER_WIN', 'HARD'),
        svc.applyScore(TEST_USER.id, 'PLAYER_WIN', 'HARD'),
      ]);

      const finalStreak = Math.max(r1.score.hardCurrentStreak, r2.score.hardCurrentStreak);
      expect(finalStreak).toBe(2);
    });
  });
});
