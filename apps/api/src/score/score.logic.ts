export type GameResult = 'PLAYER_WIN' | 'BOT_WIN' | 'DRAW';

export interface ScoreState {
  score: number;
  consecutiveWins: number;
}

/**
 * Pure scoring rules — mirrors the Redis Lua script in ScoreService.
 * RULE-SCORE-01: win +1 pt; every 3rd consecutive win gives +1 bonus and resets counter.
 * RULE-SCORE-02: loss -1 pt (floor 0), consecutive win counter resets.
 * RULE-SCORE-03: draw is a no-op.
 */
export function applyScoreRules(
  state: ScoreState,
  result: GameResult,
): ScoreState {
  let { score, consecutiveWins } = state;

  if (result === 'PLAYER_WIN') {
    score += 1;
    consecutiveWins += 1;
    if (consecutiveWins === 3) {
      score += 1;
      consecutiveWins = 0;
    }
  } else if (result === 'BOT_WIN') {
    score = Math.max(0, score - 1);
    consecutiveWins = 0;
  }

  return { score, consecutiveWins };
}
