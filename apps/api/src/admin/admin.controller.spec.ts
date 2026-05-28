/**
 * Integration tests for AdminController โ€” requires Docker postgres.
 * Covers AUTH-06: ADMIN role required, PLAYER gets 403.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { validate } from '../config/env.validation';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AdminModule } from './admin.module';

const TEST_ADMIN = { id: 'test-admin-user', email: 'admin@test.com', role: 'ADMIN' as const };
const TEST_PLAYER = { id: 'test-player-user', email: 'player@test.com', role: 'PLAYER' as const };

let activeUser: typeof TEST_ADMIN | typeof TEST_PLAYER = TEST_ADMIN;

const mockAuth = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = activeUser;
    return true;
  },
};

describe('AdminController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate }),
        PrismaModule,
        AdminModule,
      ],
      providers: [
        { provide: APP_GUARD, useValue: mockAuth },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = module.get(PrismaService);

    await prisma.user.upsert({
      where: { id: TEST_ADMIN.id },
      create: { id: TEST_ADMIN.id, provider: 'test', providerId: 'admin-sub', email: TEST_ADMIN.email, displayName: 'Admin User', role: 'ADMIN' },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: TEST_PLAYER.id },
      create: { id: TEST_PLAYER.id, provider: 'test', providerId: 'player-sub', email: TEST_PLAYER.email, displayName: 'Player User', role: 'PLAYER' },
      update: {},
    });
  });

  afterEach(() => {
    activeUser = TEST_ADMIN;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [TEST_ADMIN.id, TEST_PLAYER.id] } } });
    await app.close();
  });

  // โ”€โ”€ AUTH-06: role enforcement โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

  describe('AUTH-06: role guard', () => {
    it('returns 403 for PLAYER role on GET /admin/scores', async () => {
      activeUser = TEST_PLAYER;
      const res = await request(app.getHttpServer()).get('/api/admin/scores');
      expect(res.status).toBe(403);
    });

    it('returns 403 for PLAYER role on GET /admin/players/:id', async () => {
      activeUser = TEST_PLAYER;
      const res = await request(app.getHttpServer()).get(`/api/admin/players/${TEST_PLAYER.id}`);
      expect(res.status).toBe(403);
    });
  });

  // โ”€โ”€ GET /api/admin/scores โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

  describe('GET /api/admin/scores', () => {
    it('returns 200 with paginated data for ADMIN', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('pageSize');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes both test users in the result', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores?pageSize=100');
      const ids = (res.body.data as { userId: string }[]).map(e => e.userId);
      expect(ids).toContain(TEST_ADMIN.id);
      expect(ids).toContain(TEST_PLAYER.id);
    });

    it('respects pagination: page=2 with pageSize=1', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores?page=2&pageSize=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(1);
    });

    it('returns 400 for invalid sort value', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores?sort=invalid');
      expect(res.status).toBe(400);
    });

    it('accepts sort=displayName', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores?sort=displayName');
      expect(res.status).toBe(200);
    });

    it('accepts sort=easyBestStreak', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores?sort=easyBestStreak');
      expect(res.status).toBe(200);
    });

    it('accepts sort=hardBestStreak', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/scores?sort=hardBestStreak');
      expect(res.status).toBe(200);
    });
  });

  // โ”€โ”€ GET /api/admin/players/:id โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

  describe('GET /api/admin/players/:id', () => {
    it('returns 200 with PlayerDetailDto for existing player', async () => {
      const res = await request(app.getHttpServer()).get(`/api/admin/players/${TEST_PLAYER.id}`);
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(TEST_PLAYER.id);
      expect(res.body).toHaveProperty('score');
      expect(res.body).toHaveProperty('recentGames');
    });

    it('returns 404 for non-existent player', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/players/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('returns correct role and email for admin user', async () => {
      const res = await request(app.getHttpServer()).get(`/api/admin/players/${TEST_ADMIN.id}`);
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('ADMIN');
      expect(res.body.email).toBe(TEST_ADMIN.email);
    });
  });
});
