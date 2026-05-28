import { Cell, GameStatus } from '@ox/shared';

export const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export function emptyBoard(): Cell[] {
  return Array<Cell>(9).fill(null);
}

/** RULE-GAME-06: returns the winning symbol, or null if no winner. */
export function checkWinner(board: Cell[]): 'X' | 'O' | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as 'X' | 'O';
    }
  }
  return null;
}

/** RULE-GAME-06: board full with no winner. */
export function isDraw(board: Cell[]): boolean {
  return checkWinner(board) === null && board.every((cell) => cell !== null);
}

/** RULE-GAME-01: indices 0..8 where cell is null. */
export function getAvailableMoves(board: Cell[]): number[] {
  return board.reduce<number[]>((acc, cell, i) => {
    if (cell === null) acc.push(i);
    return acc;
  }, []);
}

/** Returns a new board with symbol placed at position. Does NOT mutate original (RULE-GAME-04). */
export function applyMove(board: Cell[], position: number, symbol: 'X' | 'O'): Cell[] {
  const next = [...board] as Cell[];
  next[position] = symbol;
  return next;
}

/** RULE-GAME-07: derive game status from board state. */
export function getGameStatus(board: Cell[]): GameStatus {
  const winner = checkWinner(board);
  if (winner === 'X') return 'PLAYER_WIN';
  if (winner === 'O') return 'BOT_WIN';
  if (isDraw(board)) return 'DRAW';
  return 'IN_PROGRESS';
}
