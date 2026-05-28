import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// ── Prisma mock factory ───────────────────────────────────────────────────────

const ZERO_SCORE = { easyScore: 0, easyConsecutiveWins: 0, hardScore: 0, hardConsecutiveWins: 0 };
const SOME_SCORE = { easyScore: 3, easyConsecutiveWins: 2, hardScore: 5, hardConsecutiveWins: 1 };

function makeUser(overrides: Partial<{
  id: string; email: string; displayName: string; role: string;
  score: typeof SOME_SCORE | null;
  games: object[];
}> = {}) {
  return {
    id: 'user-1', email: 'p@test.com', displayName: 'Player One', role: 'PLAYER',
    score: SOME_SCORE,
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
    const result = await svc.getScores(1, 10, 'hardScore');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      userId: 'user-1', email: 'p@test.com',
      easyScore: 3, easyConsecutiveWins: 2,
      hardScore: 5, hardConsecutiveWins: 1,
    });
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('defaults score to zeros when user has no score record', async () => {
    const { svc } = await buildService(makePrisma([makeUser({ score: null })]));
    const result = await svc.getScores();
    expect(result.data[0]).toMatchObject(ZERO_SCORE);
  });

  it('uses skip/take based on page and pageSize', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(3, 5, 'hardScore');
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
  });

  it('orders by displayName when sort=displayName', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(1, 10, 'displayName');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { displayName: 'asc' } }),
    );
  });

  it('orders by score.hardScore desc by default', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(1, 10, 'hardScore');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { score: { hardScore: 'desc' } } }),
    );
  });

  it('orders by score.easyScore desc when sort=easyScore', async () => {
    const { svc, prisma } = await buildService();
    await svc.getScores(1, 10, 'easyScore');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { score: { easyScore: 'desc' } } }),
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
    expect(result.score).toEqual(SOME_SCORE);
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
