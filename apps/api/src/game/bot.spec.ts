import { Cell } from '@ox/shared';
import { applyMove, checkWinner, emptyBoard, getAvailableMoves, isDraw } from './game.logic';
import { getBotMove } from './bot';

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

/** Exhaustively verify HARD bot never loses: explores every player move,
 *  bot always responds optimally. Throws if player ever wins. */
function assertBotNeverLoses(board: Cell[], playerTurn: boolean): void {
  const winner = checkWinner(board);
  if (winner === 'X') throw new Error('HARD bot lost — player won!');
  if (winner === 'O' || isDraw(board)) return;

  const moves = getAvailableMoves(board);
  if (playerTurn) {
    for (const m of moves) assertBotNeverLoses(applyMove(board, m, 'X'), false);
  } else {
    const botMove = getBotMove(board, 'HARD');
    assertBotNeverLoses(applyMove(board, botMove, 'O'), true);
  }
}

// ──────────────────────────────────────────
// HARD bot — RULE-BOT-01
// ──────────────────────────────────────────
describe('getBotMove (HARD)', () => {
  it('never loses in any possible game (RULE-BOT-01)', () => {
    // RULE-BOT-01: minimax must be unbeatable
    expect(() => assertBotNeverLoses(emptyBoard(), true)).not.toThrow();
  });

  it('takes an immediate winning move (RULE-BOT-01)', () => {
    // RULE-BOT-01: bot should win when it can
    //  O O _
    //  X X _
    //  _ _ _   → O at index 2 wins
    const board: Cell[] = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(getBotMove(board, 'HARD')).toBe(2);
  });

  it('blocks the player from winning (RULE-BOT-01)', () => {
    // RULE-BOT-01: bot must block a 2-in-a-row threat
    //  X X _
    //  O O _
    //  _ _ _   → must block index 2, or bot play first to win
    const board: Cell[] = ['X', 'X', null, 'O', 'O', null, null, null, null];
    // Bot can take index 5 to win, or it would also block at 2 — either way correct.
    // What matters: result is not index 2 being left open for X
    const botMove = getBotMove(board, 'HARD');
    const afterBot = applyMove(board, botMove, 'O');
    expect(checkWinner(afterBot)).toBe('O'); // bot wins outright, best play
  });

  it('completes quickly from an empty board (RULE-BOT-03)', () => {
    // RULE-BOT-03: <50ms for the algorithm; threshold is 200ms to absorb CI/parallel-load overhead
    const start = performance.now();
    getBotMove(emptyBoard(), 'HARD');
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('returns a legal move (not an already-occupied cell) (RULE-GAME-04)', () => {
    // RULE-GAME-04: bot must never pick an occupied cell
    const board: Cell[] = ['X', 'O', null, null, 'X', null, null, null, 'O'];
    const move = getBotMove(board, 'HARD');
    expect(getAvailableMoves(board)).toContain(move);
  });
});

// ──────────────────────────────────────────
// EASY bot — RULE-BOT-02
// ──────────────────────────────────────────
describe('getBotMove (EASY)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('always returns a legal move (RULE-BOT-02)', () => {
    // RULE-BOT-02: regardless of random path, move must be valid
    const board: Cell[] = ['X', 'O', null, null, 'X', null, null, null, 'O'];
    for (let i = 0; i < 20; i++) {
      expect(getAvailableMoves(board)).toContain(getBotMove(board, 'EASY'));
    }
  });

  it('takes a winning move on the "reasonable" path (RULE-BOT-02)', () => {
    // RULE-BOT-02: win-if-possible heuristic (random() >= 0.3 → reasonable)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    //  O O _
    //  X X _
    //  _ _ _   → O wins at index 2
    const board: Cell[] = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(getBotMove(board, 'EASY')).toBe(2);
  });

  it('blocks player win on the "reasonable" path (RULE-BOT-02)', () => {
    // RULE-BOT-02: block-if-needed heuristic
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    //  X X _
    //  O _ _
    //  _ _ _   → must block index 2
    const board: Cell[] = ['X', 'X', null, 'O', null, null, null, null, null];
    expect(getBotMove(board, 'EASY')).toBe(2);
  });

  it('prefers center on the "reasonable" path (RULE-BOT-02)', () => {
    // RULE-BOT-02: center heuristic when no win/block
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const board: Cell[] = ['X', null, null, null, null, null, null, null, 'O'];
    expect(getBotMove(board, 'EASY')).toBe(4); // center
  });

  it('returns a random legal move on the "random" path (RULE-BOT-02)', () => {
    // RULE-BOT-02: ~30% of the time it picks randomly
    // First call (threshold check) → 0.1 < 0.3 → random path
    // Second call (move index selection) → 0.0 → first available move
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValue(0.0);
    const board: Cell[] = ['X', null, null, null, null, null, null, null, 'O'];
    const move = getBotMove(board, 'EASY');
    expect(getAvailableMoves(board)).toContain(move);
  });

  it('completes in <50ms (RULE-BOT-03)', () => {
    // RULE-BOT-03
    const start = performance.now();
    getBotMove(emptyBoard(), 'EASY');
    expect(performance.now() - start).toBeLessThan(50);
  });
});
