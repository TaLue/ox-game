export type GameResult = 'PLAYER_WIN' | 'BOT_WIN' | 'DRAW';

export interface StreakState {
  currentStreak: number;
  bestStreak: number;
}

/** Pure streak rules — mirrors the Redis Lua script in ScoreService (RULE-SCORE-01..03). */
export function applyStreakRules(
  state: StreakState,
  result: GameResult,
): StreakState {
  let { currentStreak, bestStreak } = state;

  if (result === 'PLAYER_WIN') {
    // RULE-SCORE-01: win increments current streak; updates best if new record
    currentStreak += 1;
    if (currentStreak > bestStreak) bestStreak = currentStreak;
  } else if (result === 'BOT_WIN') {
    // RULE-SCORE-02: loss resets current streak; best streak is preserved
    currentStreak = 0;
  }
  // RULE-SCORE-03: draw does not affect streak at all

  return { currentStreak, bestStreak };
}
