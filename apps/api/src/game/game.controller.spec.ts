/**
 * Integration tests for GameController โ€” requires Docker postgres + redis to be running.
 * Tests cover all RULE-GAME-* status codes via real HTTP (Supertest).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { Cell } from '@ox/shared';

/** Converts a Cell[] to Prisma's InputJsonValue for test DB setup. */
const toJsonBoard = (arr: (string | null)[]): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(arr)) as Prisma.InputJsonValue;
import { validate } from '../config/env.validation';
import { GameModule } from './game.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { ScoreModule } from '../score/score.module';
import { BotService } from './bot.service';

const TEST_USER = { id: 'test-ctrl-user', email: 'ctrl@test.com', role: 'PLAYER' as const };

/** Always authenticates as TEST_USER */
const mockAuth = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = TEST_USER;
    return true;
  },
};

describe('GameController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let botService: BotService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate }),
        PrismaModule,
        RedisModule,
        ScoreModule,
        GameModule,
      ],
      providers: [
        { provide: APP_GUARD, useValue: mockAuth },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    botService = module.get(BotService);

    // Ensure test user exists (games FK โ’ users)
    await prisma.user.upsert({
      where: { id: TEST_USER.id },
      create: {
        id: TEST_USER.id,
        provider: 'test',
        providerId: 'ctrl-sub',
        email: TEST_USER.email,
        displayName: 'Test Controller User',
        role: 'PLAYER',
      },
      update: {},
    });
  });

  afterEach(async () => {
    await prisma.game.deleteMany({ where: { userId: TEST_USER.id } });
    await prisma.score.deleteMany({ where: { userId: TEST_USER.id } });
    await redis.client.del(`score:${TEST_USER.id}`);
    await redis.client.zrem('leaderboard', TEST_USER.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: TEST_USER.id } });
    await app.close();
  });

  // โ”€โ”€ POST /api/games โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  describe('POST /api/games', () => {
    it('returns 201 with a GameDto (RULE-GAME-01, RULE-GAME-03)', async () => {
      // RULE-GAME-01/03
      const res = await request(app.getHttpServer()).post('/api/games').send({});
      expect(res.status).toBe(201);
      expect(res.body.board).toHaveLength(9);
      expect(res.body.turn).toBe('PLAYER');
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.difficulty).toBe('EASY');
    });

    it('accepts explicit HARD difficulty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/games')
        .send({ difficulty: 'HARD' });
      expect(res.status).toBe(201);
      expect(res.body.difficulty).toBe('HARD');
    });
  });

  // โ”€โ”€ GET /api/games/:id โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  describe('GET /api/games/:id', () => {
    it('returns 200 with the game (RULE-GAME-08)', async () => {
      // RULE-GAME-08
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const res = await request(app.getHttpServer()).get(`/api/games/${create.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(create.body.id);
    });

    it('returns 404 for a non-existent game id (RULE-GAME-08)', async () => {
      // RULE-GAME-08: 404 for not found
      const res = await request(app.getHttpServer()).get('/api/games/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  // โ”€โ”€ POST /api/games/:id/move โ€” validation โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  describe('POST /api/games/:id/move โ€” validation', () => {
    it('returns 400 for out-of-range position (RULE-GAME-04)', async () => {
      // RULE-GAME-04: 400 for out of range
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const res = await request(app.getHttpServer())
        .post(`/api/games/${create.body.id}/move`)
        .send({ position: 9 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-integer position (RULE-GAME-04)', async () => {
      // RULE-GAME-04: 400 for malformed input
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const res = await request(app.getHttpServer())
        .post(`/api/games/${create.body.id}/move`)
        .send({ position: 'abc' });
      expect(res.status).toBe(400);
    });

    it('returns 409 when position is already taken (RULE-GAME-04)', async () => {
      // RULE-GAME-04: 409 for occupied cell
      jest.spyOn(botService, 'move').mockReturnValue(8);
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      // First move at 0
      await request(app.getHttpServer())
        .post(`/api/games/${create.body.id}/move`)
        .send({ position: 0 });
      // Second move at same position
      const res = await request(app.getHttpServer())
        .post(`/api/games/${create.body.id}/move`)
        .send({ position: 0 });
      expect(res.status).toBe(409);
    });

    it('returns 409 for moves on a finished game (RULE-GAME-07)', async () => {
      // RULE-GAME-07: terminal status is final; 409 on further moves
      jest.spyOn(botService, 'move').mockReturnValue(8);
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const id = create.body.id;

      // Force player to win: set up board directly in DB
      await prisma.game.update({
        where: { id },
        data: { board: toJsonBoard(['X', 'X', null, null, null, null, null, null, null]) },
      });

      // Winning move
      await request(app.getHttpServer()).post(`/api/games/${id}/move`).send({ position: 2 });

      // Move on finished game โ’ 409
      const res = await request(app.getHttpServer())
        .post(`/api/games/${id}/move`)
        .send({ position: 3 });
      expect(res.status).toBe(409);
    });

    it('returns 404 for a game not found (RULE-GAME-08)', async () => {
      // RULE-GAME-08
      const res = await request(app.getHttpServer())
        .post('/api/games/nonexistent/move')
        .send({ position: 0 });
      expect(res.status).toBe(404);
    });
  });

  // โ”€โ”€ POST /api/games/:id/move โ€” full flow โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  describe('POST /api/games/:id/move โ€” full flow', () => {
    it('returns MoveResultDto with updated board (RULE-GAME-05)', async () => {
      // RULE-GAME-05: response reflects state after bot has moved
      jest.spyOn(botService, 'move').mockReturnValue(8);
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const res = await request(app.getHttpServer())
        .post(`/api/games/${create.body.id}/move`)
        .send({ position: 0 });

      expect(res.status).toBe(200);
      expect(res.body.board[0]).toBe('X');   // player's move
      expect(res.body.board[8]).toBe('O');   // bot's move
      expect(res.body.botMove).toBe(8);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.score).toHaveProperty('easyScore');
    });

    it('player wins: botMove is null and status is PLAYER_WIN (RULE-GAME-05)', async () => {
      // RULE-GAME-05: game ends on player's move โ€” bot does NOT move
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const id = create.body.id;
      await prisma.game.update({
        where: { id },
        data: { board: toJsonBoard(['X', 'X', null, null, null, null, null, null, null]) },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/games/${id}/move`)
        .send({ position: 2 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PLAYER_WIN');
      expect(res.body.botMove).toBeNull();
      expect((res.body.board as Cell[])[2]).toBe('X');
    });

    it('winning game updates score (acceptance criteria ยง12.3)', async () => {
      // Acceptance: a win increments easyScore (game created with default EASY difficulty)
      const create = await request(app.getHttpServer()).post('/api/games').send({});
      const id = create.body.id;
      await prisma.game.update({
        where: { id },
        data: { board: toJsonBoard(['X', 'X', null, null, null, null, null, null, null]) },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/games/${id}/move`)
        .send({ position: 2 });
      expect(res.body.score.easyScore).toBeGreaterThanOrEqual(1);
    });
  });
});
