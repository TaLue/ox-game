import { Cell, Difficulty } from '@ox/shared';
import { applyMove, checkWinner, getAvailableMoves, isDraw } from './game.logic';

/** RULE-BOT-02: corners preferred by EASY heuristic. */
const CORNERS = [0, 2, 6, 8] as const;

export function getBotMove(board: Cell[], difficulty: Difficulty): number {
  const moves = getAvailableMoves(board);
  if (moves.length === 0) throw new Error('No legal moves available');
  return difficulty === 'HARD' ? getBotMoveHard(board, moves) : getBotMoveEasy(board, moves);
}

// ──────────────────────────────────────────
// HARD: minimax with alpha-beta pruning (RULE-BOT-01)
// ──────────────────────────────────────────

function getBotMoveHard(board: Cell[], moves: number[]): number {
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const score = minimax(applyMove(board, move, 'O'), false, -Infinity, Infinity, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

/**
 * Depth-aware minimax with alpha-beta pruning.
 * Earlier wins score higher (10 - depth); later losses score less bad (-10 + depth).
 * This ensures the bot prefers the shortest win path — it won't pass up an immediate
 * victory in favour of a "will win eventually" line that evaluates to the same raw score.
 */
function minimax(
  board: Cell[],
  isMaximizing: boolean,
  alpha: number,
  beta: number,
  depth: number,
): number {
  const winner = checkWinner(board);
  if (winner === 'O') return 10 - depth;  // prefer winning sooner
  if (winner === 'X') return -10 + depth; // prefer losing later
  if (isDraw(board)) return 0;

  const moves = getAvailableMoves(board);

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(board, move, 'O'), false, alpha, beta, depth + 1));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      best = Math.min(best, minimax(applyMove(board, move, 'X'), true, alpha, beta, depth + 1));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ──────────────────────────────────────────
// EASY: heuristic with randomness (RULE-BOT-02)
// ──────────────────────────────────────────

function getBotMoveEasy(board: Cell[], moves: number[]): number {
  // ~30% of the time: pick a random legal cell (RULE-BOT-02)
  if (Math.random() < 0.3) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Win if possible
  for (const move of moves) {
    if (checkWinner(applyMove(board, move, 'O')) === 'O') return move;
  }

  // Block player from winning
  for (const move of moves) {
    if (checkWinner(applyMove(board, move, 'X')) === 'X') return move;
  }

  // Prefer center
  if (board[4] === null) return 4;

  // Prefer a random available corner
  const freeCorners = CORNERS.filter((i) => board[i] === null);
  if (freeCorners.length > 0) {
    return freeCorners[Math.floor(Math.random() * freeCorners.length)];
  }

  // Any remaining move
  return moves[Math.floor(Math.random() * moves.length)];
}
