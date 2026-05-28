import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cell, Difficulty, GameDto, GameStatus, MoveResultDto } from '@ox/shared';
import { ScoreService } from '../score/score.service';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { applyMove, emptyBoard, getGameStatus } from './game.logic';
import { BotService } from './bot.service';

/** Casts a plain JSON-serialisable value to Prisma's InputJsonValue for storage. */
const json = <T>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

interface StoredMove {
  player: 'PLAYER' | 'BOT';
  position: number;
  symbol: 'X' | 'O';
}

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly score: ScoreService,
    private readonly bot: BotService,
    @Optional() private readonly ws: WsGateway | null,
  ) {}

  /** POST /games — RULE-GAME-01, RULE-GAME-02, RULE-GAME-03 */
  async createGame(userId: string, difficulty: Difficulty = 'EASY'): Promise<GameDto> {
    const board = emptyBoard();
    const game = await this.prisma.game.create({
      data: {
        userId,
        difficulty,
        board: json(board),
        moves: json([]),
        status: 'IN_PROGRESS',
      },
    });

    return {
      id: game.id,
      board,
      status: 'IN_PROGRESS',
      difficulty,
      turn: 'PLAYER', // RULE-GAME-03: player always moves first
    };
  }

  /** GET /games/:id — RULE-GAME-08 */
  async getGame(gameId: string, userId: string): Promise<GameDto> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });

    // RULE-GAME-08: 404 for not-found AND not-owned (do not leak existence)
    if (!game || game.userId !== userId) throw new NotFoundException();

    const board = game.board as unknown as Cell[];
    const status = game.status as GameStatus;

    return {
      id: game.id,
      board,
      status,
      difficulty: game.difficulty as Difficulty,
      turn: status === 'IN_PROGRESS' ? 'PLAYER' : 'BOT',
    };
  }

  /** POST /games/:id/move — RULE-GAME-04..09 */
  async makeMove(gameId: string, userId: string, position: number): Promise<MoveResultDto> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });

    // RULE-GAME-08: 404 for not-found or not-owned
    if (!game || game.userId !== userId) throw new NotFoundException();

    // RULE-GAME-07: terminal status is final
    if (game.status !== 'IN_PROGRESS') {
      throw new ConflictException('Game is already finished');
    }

    // RULE-GAME-04: position 0..8 already validated by DTO (400), double-guard here
    if (!Number.isInteger(position) || position < 0 || position > 8) {
      throw new BadRequestException('Position must be an integer 0..8');
    }

    const board = game.board as unknown as Cell[];

    // RULE-GAME-04: cell must be null
    if (board[position] !== null) {
      throw new ConflictException('Position already taken');
    }

    const moves = (game.moves as unknown as StoredMove[]).slice();

    // ── Player move ──────────────────────────────────────
    const afterPlayer = applyMove(board, position, 'X');
    moves.push({ player: 'PLAYER', position, symbol: 'X' });

    let status = getGameStatus(afterPlayer);
    let finalBoard = afterPlayer;
    let botMovePos: number | null = null;

    // ── Bot move (RULE-GAME-05) ──────────────────────────
    if (status === 'IN_PROGRESS') {
      botMovePos = this.bot.move(afterPlayer, game.difficulty as Difficulty);
      finalBoard = applyMove(afterPlayer, botMovePos, 'O');
      moves.push({ player: 'BOT', position: botMovePos, symbol: 'O' });
      status = getGameStatus(finalBoard);
    }

    const isTerminal = status !== 'IN_PROGRESS';

    // ── Scoring (RULE-GAME-09, RULE-SCORE-*) ────────────
    const difficulty = game.difficulty as Difficulty;
    let scoreResult: { score: import('@ox/shared').ScoreDto };
    if (isTerminal) {
      scoreResult = await this.score.applyScore(userId, status as 'PLAYER_WIN' | 'BOT_WIN' | 'DRAW', difficulty);
    } else {
      scoreResult = { score: await this.score.getScore(userId) };
    }

    // ── Persist (RULE-GAME-09) ────────────────────────────
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        board: json(finalBoard),
        moves: json(moves),
        status,
        finishedAt: isTerminal ? new Date() : null,
      },
    });

    // ── WebSocket push (RULE-SCORE-08) ──────────────────
    if (isTerminal && this.ws) {
      this.ws.emitScoreUpdate(userId, scoreResult.score);
      const [easyLb, hardLb] = await Promise.all([
        this.score.getLeaderboard(10, 'EASY'),
        this.score.getLeaderboard(10, 'HARD'),
      ]);
      this.ws.emitLeaderboardUpdate('EASY', easyLb);
      this.ws.emitLeaderboardUpdate('HARD', hardLb);
    }

    return {
      board: finalBoard,
      botMove: botMovePos,
      status,
      score: scoreResult.score,
    };
  }
}
