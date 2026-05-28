import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreService } from '../score/score.service';
import { BotService } from './bot.service';
import { GameService } from './game.service';

// ── Mock factories ───────────────────────────────────────────────────────────

interface FakeGame {
  id: string; userId: string; status: string; difficulty: string;
  board: (string | null)[]; moves: object[];
}

function makeGame(overrides: Partial<FakeGame> = {}): FakeGame {
  return {
    id: 'game-1', userId: 'user-1', status: 'IN_PROGRESS',
    difficulty: 'EASY', board: Array(9).fill(null), moves: [],
    ...overrides,
  };
}

interface PrismaMock {
  game: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
}

function makePrisma(game: FakeGame = makeGame()): PrismaMock {
  return {
    game: {
      create: jest.fn().mockResolvedValue(game),
      findUnique: jest.fn().mockResolvedValue(game),
      update: jest.fn().mockResolvedValue(game),
    },
  };
}

const ZERO_SCORE = { easyScore: 0, easyConsecutiveWins: 0, hardScore: 0, hardConsecutiveWins: 0 };
const ONE_SCORE  = { easyScore: 1, easyConsecutiveWins: 1, hardScore: 0, hardConsecutiveWins: 0 };

interface ScoreMock { getScore: jest.Mock; applyScore: jest.Mock; getLeaderboard: jest.Mock }
function makeScore(): ScoreMock {
  return {
    getScore: jest.fn().mockResolvedValue(ZERO_SCORE),
    applyScore: jest.fn().mockResolvedValue({ score: ONE_SCORE }),
    getLeaderboard: jest.fn().mockResolvedValue([]),
  };
}

interface BotMock { move: jest.Mock }
function makeBot(fixedMove = 8): BotMock {
  return { move: jest.fn().mockReturnValue(fixedMove) };
}

async function buildService(prisma: PrismaMock, score: ScoreMock, bot: BotMock): Promise<GameService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GameService,
      { provide: PrismaService, useValue: prisma },
      { provide: ScoreService, useValue: score },
      { provide: BotService, useValue: bot },
    ],
  }).compile();
  return module.get(GameService);
}

// ── createGame ───────────────────────────────────────────────────────────────
describe('GameService.createGame', () => {
  it('returns a GameDto with empty board and PLAYER turn (RULE-GAME-01, RULE-GAME-03)', async () => {
    // RULE-GAME-01: board length 9, all null  RULE-GAME-03: player always first
    const svc = await buildService(makePrisma(), makeScore(), makeBot());
    const dto = await svc.createGame('user-1', 'EASY');
    expect(dto.board).toHaveLength(9);
    expect(dto.board.every((c) => c === null)).toBe(true);
    expect(dto.turn).toBe('PLAYER');
    expect(dto.status).toBe('IN_PROGRESS');
  });

  it('defaults difficulty to EASY (D11)', async () => {
    // D11
    const svc = await buildService(makePrisma(), makeScore(), makeBot());
    expect((await svc.createGame('user-1')).difficulty).toBe('EASY');
  });
});

// ── getGame ───────────────────────────────────────────────────────────────────
describe('GameService.getGame', () => {
  it('returns game when user is the owner (RULE-GAME-08)', async () => {
    // RULE-GAME-08
    const svc = await buildService(makePrisma(), makeScore(), makeBot());
    expect((await svc.getGame('game-1', 'user-1')).id).toBe('game-1');
  });

  it('throws 404 when game not found (RULE-GAME-08)', async () => {
    // RULE-GAME-08: do not leak existence with 403
    const prisma = makePrisma();
    prisma.game.findUnique.mockResolvedValue(null);
    const svc = await buildService(prisma, makeScore(), makeBot());
    await expect(svc.getGame('none', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws 404 when user does not own the game (RULE-GAME-08)', async () => {
    // RULE-GAME-08: ownership ≠ 403, it's 404
    const svc = await buildService(makePrisma(), makeScore(), makeBot());
    await expect(svc.getGame('game-1', 'other-user')).rejects.toThrow(NotFoundException);
  });
});

// ── makeMove — validation ────────────────────────────────────────────────────
describe('GameService.makeMove — validation', () => {
  it('throws 404 when game not owned (RULE-GAME-08)', async () => {
    // RULE-GAME-08
    const svc = await buildService(makePrisma(), makeScore(), makeBot());
    await expect(svc.makeMove('game-1', 'other-user', 0)).rejects.toThrow(NotFoundException);
  });

  it('throws 409 when game is already finished (RULE-GAME-07)', async () => {
    // RULE-GAME-07: terminal status is final
    const svc = await buildService(makePrisma(makeGame({ status: 'PLAYER_WIN' })), makeScore(), makeBot());
    await expect(svc.makeMove('game-1', 'user-1', 0)).rejects.toThrow(ConflictException);
  });

  it('throws 409 when position is already occupied (RULE-GAME-04)', async () => {
    // RULE-GAME-04: cell must be null
    const board = Array(9).fill(null) as (string | null)[];
    board[0] = 'X';
    const svc = await buildService(makePrisma(makeGame({ board })), makeScore(), makeBot());
    await expect(svc.makeMove('game-1', 'user-1', 0)).rejects.toThrow(ConflictException);
  });

  it('does not call prisma.update on invalid move (RULE-GAME-04)', async () => {
    // RULE-GAME-04: board MUST NOT change on invalid move
    const board = Array(9).fill(null) as (string | null)[];
    board[4] = 'O';
    const prisma = makePrisma(makeGame({ board }));
    const svc = await buildService(prisma, makeScore(), makeBot());
    await expect(svc.makeMove('game-1', 'user-1', 4)).rejects.toThrow();
    expect(prisma.game.update).not.toHaveBeenCalled();
  });
});

// ── makeMove — game flow ──────────────────────────────────────────────────────
describe('GameService.makeMove — game flow', () => {
  it('applies player then bot move; response reflects final board (RULE-GAME-05)', async () => {
    // RULE-GAME-05: response reflects state after bot has moved
    const svc = await buildService(makePrisma(), makeScore(), makeBot(8));
    const result = await svc.makeMove('game-1', 'user-1', 0);
    expect(result.board[0]).toBe('X');
    expect(result.board[8]).toBe('O');
    expect(result.botMove).toBe(8);
  });

  it('PLAYER_WIN: bot does NOT move, botMove is null (RULE-GAME-05)', async () => {
    // RULE-GAME-05: game ends on player's move → bot skipped
    const board = Array(9).fill(null) as (string | null)[];
    board[0] = 'X'; board[1] = 'X'; // row 0 needs index 2
    const bot = makeBot(5);
    const svc = await buildService(makePrisma(makeGame({ board })), makeScore(), bot);

    const result = await svc.makeMove('game-1', 'user-1', 2);
    expect(result.status).toBe('PLAYER_WIN');
    expect(result.botMove).toBeNull();
    expect(bot.move).not.toHaveBeenCalled();
  });

  it('BOT_WIN: status is BOT_WIN after bot moves (RULE-GAME-05)', async () => {
    // RULE-GAME-05: bot wins after its move
    // _ _ _ / O O _ / X X _  → player plays 2 (no X win), bot plays 5 → O wins row [3,4,5]
    const board: (string | null)[] = [null, null, null, 'O', 'O', null, 'X', 'X', null];
    const svc = await buildService(makePrisma(makeGame({ board })), makeScore(), makeBot(5));
    const result = await svc.makeMove('game-1', 'user-1', 2);
    expect(result.status).toBe('BOT_WIN');
    expect(result.botMove).toBe(5);
  });

  it('calls applyScore when game ends (RULE-GAME-09)', async () => {
    // RULE-GAME-09: scoring triggered exactly once per finished game
    const board: (string | null)[] = ['X', 'X', null, null, null, null, null, null, null];
    const score = makeScore();
    const svc = await buildService(makePrisma(makeGame({ board })), score, makeBot(5));
    await svc.makeMove('game-1', 'user-1', 2);
    expect(score.applyScore).toHaveBeenCalledWith('user-1', 'PLAYER_WIN', 'EASY');
  });

  it('does NOT call applyScore while game is still in progress', async () => {
    const score = makeScore();
    const svc = await buildService(makePrisma(), score, makeBot(8));
    await svc.makeMove('game-1', 'user-1', 0);
    expect(score.applyScore).not.toHaveBeenCalled();
    expect(score.getScore).toHaveBeenCalled();
  });

  it('persists the game with correct status and finishedAt (RULE-GAME-09)', async () => {
    // RULE-GAME-09: game persisted with result, pointsDelta, moves
    const board: (string | null)[] = ['X', 'X', null, null, null, null, null, null, null];
    const prisma = makePrisma(makeGame({ board }));
    const svc = await buildService(prisma, makeScore(), makeBot(5));
    await svc.makeMove('game-1', 'user-1', 2);
    expect(prisma.game.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'game-1' },
      data: expect.objectContaining({ status: 'PLAYER_WIN', finishedAt: expect.any(Date) }),
    }));
  });
});
