import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// ── Prisma mock factory ───────────────────────────────────────────────────────

const ZERO_STREAK = { easyCurrentStreak: 0, easyBestStreak: 0, hardCurrentStreak: 0, hardBestStreak: 0 };
const SOME_STREAK = { easyCurrentStreak: 2, easyBestStreak: 3, hardCurrentStreak: 1, hardBestStreak: 5 };

function makeUser(overrides: Partial<{
  id: string; email: string; displayName: string; role: string;
  score: typeof SOME_STREAK | null;
  games: object[];
}> = {}) {
  return {
    id: 'user-1', email: 'p@test.com', displayName: 'Player One', role: 'PLAYER',
    score: SOME_STREAK,
    games: [],
    ...overrides,
  };
}

function makePrisma(users: ReturnType<typeof makeUser>[] = [makeUser()]) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
      count: jest.fn().mockResolvedValue(users.length),
      findUnique: jest.fn().mockResolvedValue(users[0] ?? null),
    },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
}

async function buildService(prisma = makePrisma()) {
  const module = await Test.createTestingModule({
    providers: [AdminService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return { svc: module.get(AdminService), prisma };
}

// ── getScores ─────────────────────────────────────────────────────────────────

describe('AdminService.getScores', () => {
  it('returns paginated AdminScoreEntry list (AUTH-06)', async () => {
    const { svc } = await buildService();
    const result = await svc.getScores(1, 10, 'hardBestStreak');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      userId: 'user-1', email: 'p@test.com',
      easyCurrentStreak: 2, easyBestStreak: 3,
      hardCurrentStreak: 1, hardBestStreak: 5,
    });
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('defaults score to zeros when user has no score record', async () => {
    const { svc } = await buildService(makePrisma([makeUser({ score: null })]));
    const result = await svc.getScores();
    expect(result.data[0]).toMatchObject(ZERO_STREAK);
  });

  it('uses skip/take based on page and pageSize', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(3, 5, 'hardBestStreak');
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
  });

  it('orders by displayName when sort=displayName', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(1, 10, 'displayName');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { displayName: 'asc' } }),
    );
  });

  it('orders by score.hardBestStreak desc by default', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(1, 10, 'hardBestStreak');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { score: { hardBestStreak: 'desc' } } }),
    );
  });

  it('orders by score.easyBestStreak desc when sort=easyBestStreak', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(1, 10, 'easyBestStreak');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { score: { easyBestStreak: 'desc' } } }),
    );
  });
});

// ── getPlayerDetail ───────────────────────────────────────────────────────────

describe('AdminService.getPlayerDetail', () => {
  it('returns PlayerDetailDto with score and recentGames', async () => {
    const game = {
      id: 'g1', status: 'PLAYER_WIN', difficulty: 'EASY',
      createdAt: new Date('2026-01-01'), finishedAt: new Date('2026-01-01'),
    };
    const user = makeUser({ games: [game] });
    const prisma = makePrisma([user]);
    prisma.user.findUnique.mockResolvedValue(user);
    const { svc } = await buildService(prisma);

    const result = await svc.getPlayerDetail('user-1');
    expect(result.userId).toBe('user-1');
    expect(result.score).toEqual(SOME_STREAK);
    expect(result.recentGames).toHaveLength(1);
    expect(result.recentGames[0]).toMatchObject({ id: 'g1', status: 'PLAYER_WIN' });
  });

  it('throws 404 when player not found', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const { svc } = await buildService(prisma);
    await expect(svc.getPlayerDetail('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('returns empty recentGames when player has no games', async () => {
    const { svc } = await buildService();
    const result = await svc.getPlayerDetail('user-1');
    expect(result.recentGames).toEqual([]);
  });
});
