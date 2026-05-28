import { Cell } from '@ox/shared';
import {
  WIN_LINES,
  applyMove,
  checkWinner,
  emptyBoard,
  getAvailableMoves,
  getGameStatus,
  isDraw,
} from './game.logic';

// ──────────────────────────────────────────
// checkWinner — RULE-GAME-06
// ──────────────────────────────────────────
describe('checkWinner', () => {
  it('returns null on an empty board (RULE-GAME-06)', () => {
    // RULE-GAME-06
    expect(checkWinner(emptyBoard())).toBeNull();
  });

  it.each(WIN_LINES)('detects X win on line [%i,%i,%i] (RULE-GAME-06)', (a, b, c) => {
    // RULE-GAME-06: all 8 win lines must be detected
    const board = emptyBoard();
    board[a] = 'X';
    board[b] = 'X';
    board[c] = 'X';
    expect(checkWinner(board)).toBe('X');
  });

  it.each(WIN_LINES)('detects O win on line [%i,%i,%i] (RULE-GAME-06)', (a, b, c) => {
    // RULE-GAME-06
    const board = emptyBoard();
    board[a] = 'O';
    board[b] = 'O';
    board[c] = 'O';
    expect(checkWinner(board)).toBe('O');
  });

  it('returns null when cells are mixed (no winner) (RULE-GAME-06)', () => {
    // RULE-GAME-06
    const board: Cell[] = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', null];
    expect(checkWinner(board)).toBeNull();
  });
});

// ──────────────────────────────────────────
// isDraw — RULE-GAME-06
// ──────────────────────────────────────────
describe('isDraw', () => {
  it('returns true for a full board with no winner (RULE-GAME-06)', () => {
    // RULE-GAME-06: draw = board full, no winner
    // X O X / O X O / O X O — no winner, all filled
    const board: Cell[] = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
    expect(isDraw(board)).toBe(true);
  });

  it('returns false when there is a winner (RULE-GAME-06)', () => {
    // RULE-GAME-06
    const board: Cell[] = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    expect(isDraw(board)).toBe(false);
  });

  it('returns false when board is not yet full (RULE-GAME-06)', () => {
    // RULE-GAME-06
    expect(isDraw(emptyBoard())).toBe(false);
  });
});

// ──────────────────────────────────────────
// getAvailableMoves
// ──────────────────────────────────────────
describe('getAvailableMoves', () => {
  it('returns all 9 positions for an empty board (RULE-GAME-01)', () => {
    // RULE-GAME-01: board indices 0..8
    expect(getAvailableMoves(emptyBoard())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns only null-cell indices (RULE-GAME-01)', () => {
    // RULE-GAME-01
    const board: Cell[] = ['X', null, 'O', null, null, 'X', 'O', null, 'X'];
    expect(getAvailableMoves(board)).toEqual([1, 3, 4, 7]);
  });

  it('returns empty array for a full board', () => {
    const board: Cell[] = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
    expect(getAvailableMoves(board)).toEqual([]);
  });
});

// ──────────────────────────────────────────
// applyMove
// ──────────────────────────────────────────
describe('applyMove', () => {
  it('places the symbol at the given position (RULE-GAME-01)', () => {
    // RULE-GAME-01: board is a fixed-length array, indices 0..8
    const board = emptyBoard();
    const next = applyMove(board, 4, 'X');
    expect(next[4]).toBe('X');
  });

  it('does not mutate the original board (RULE-GAME-04)', () => {
    // RULE-GAME-04: invalid moves must not change state — immutability is the foundation
    const board = emptyBoard();
    applyMove(board, 4, 'X');
    expect(board[4]).toBeNull();
  });

  it('leaves other cells unchanged', () => {
    const board: Cell[] = ['X', null, null, null, null, null, null, null, 'O'];
    const next = applyMove(board, 1, 'X');
    expect(next[0]).toBe('X');
    expect(next[8]).toBe('O');
    expect(next[1]).toBe('X');
  });
});

// ──────────────────────────────────────────
// getGameStatus — RULE-GAME-07
// ──────────────────────────────────────────
describe('getGameStatus', () => {
  it('returns PLAYER_WIN when X wins (RULE-GAME-07)', () => {
    // RULE-GAME-07: status ∈ IN_PROGRESS|PLAYER_WIN|BOT_WIN|DRAW
    const board: Cell[] = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    expect(getGameStatus(board)).toBe('PLAYER_WIN');
  });

  it('returns BOT_WIN when O wins (RULE-GAME-07)', () => {
    // RULE-GAME-07
    const board: Cell[] = ['O', 'O', 'O', 'X', 'X', null, null, null, null];
    expect(getGameStatus(board)).toBe('BOT_WIN');
  });

  it('returns DRAW for a full board with no winner (RULE-GAME-07)', () => {
    // RULE-GAME-07
    const board: Cell[] = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
    expect(getGameStatus(board)).toBe('DRAW');
  });

  it('returns IN_PROGRESS when game is still going (RULE-GAME-07)', () => {
    // RULE-GAME-07
    expect(getGameStatus(emptyBoard())).toBe('IN_PROGRESS');
  });
});
