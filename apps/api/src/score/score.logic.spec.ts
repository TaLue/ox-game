import { applyStreakRules, StreakState } from './score.logic';

const s = (currentStreak: number, bestStreak: number): StreakState => ({ currentStreak, bestStreak });

describe('applyStreakRules', () => {
  // ── RULE-SCORE-01: win ────────────────────────────────────────────────────

  it('win from 0 → currentStreak=1, bestStreak=1 (RULE-SCORE-01)', () => {
    expect(applyStreakRules(s(0, 0), 'PLAYER_WIN')).toEqual({ currentStreak: 1, bestStreak: 1 });
  });

  it('win from 1 → currentStreak=2, bestStreak=2 (RULE-SCORE-01)', () => {
    expect(applyStreakRules(s(1, 1), 'PLAYER_WIN')).toEqual({ currentStreak: 2, bestStreak: 2 });
  });

  it('win when current < best keeps best unchanged (RULE-SCORE-01)', () => {
    const result = applyStreakRules(s(2, 5), 'PLAYER_WIN');
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(5);
  });

  it('win that ties best sets new record (RULE-SCORE-01)', () => {
    const result = applyStreakRules(s(5, 5), 'PLAYER_WIN');
    expect(result.currentStreak).toBe(6);
    expect(result.bestStreak).toBe(6);
  });

  it('10 consecutive wins → bestStreak=10 (RULE-SCORE-01)', () => {
    let state = s(0, 0);
    for (let i = 0; i < 10; i++) state = applyStreakRules(state, 'PLAYER_WIN');
    expect(state).toEqual({ currentStreak: 10, bestStreak: 10 });
  });

  // ── RULE-SCORE-02: loss ───────────────────────────────────────────────────

  it('loss resets currentStreak to 0, bestStreak preserved (RULE-SCORE-02)', () => {
    expect(applyStreakRules(s(3, 3), 'BOT_WIN')).toEqual({ currentStreak: 0, bestStreak: 3 });
  });

  it('loss from 0 is a no-op on best streak (RULE-SCORE-02)', () => {
    expect(applyStreakRules(s(0, 7), 'BOT_WIN')).toEqual({ currentStreak: 0, bestStreak: 7 });
  });

  // ── RULE-SCORE-03: draw ───────────────────────────────────────────────────

  it('draw does not change currentStreak or bestStreak (RULE-SCORE-03)', () => {
    expect(applyStreakRules(s(4, 7), 'DRAW')).toEqual({ currentStreak: 4, bestStreak: 7 });
  });

  it('draw from 0 is a no-op (RULE-SCORE-03)', () => {
    expect(applyStreakRules(s(0, 0), 'DRAW')).toEqual({ currentStreak: 0, bestStreak: 0 });
  });

  // ── Post-loss recovery ────────────────────────────────────────────────────

  it('best streak preserved after loss then recovers to new record (RULE-SCORE-01, RULE-SCORE-02)', () => {
    let state = s(0, 0);
    for (let i = 0; i < 5; i++) state = applyStreakRules(state, 'PLAYER_WIN');
    expect(state.bestStreak).toBe(5);
    state = applyStreakRules(state, 'BOT_WIN');
    expect(state).toEqual({ currentStreak: 0, bestStreak: 5 });
    for (let i = 0; i < 3; i++) state = applyStreakRules(state, 'PLAYER_WIN');
    expect(state.bestStreak).toBe(5); // not yet a record
    for (let i = 0; i < 3; i++) state = applyStreakRules(state, 'PLAYER_WIN');
    expect(state.currentStreak).toBe(6);
    expect(state.bestStreak).toBe(6); // new record
  });
});
