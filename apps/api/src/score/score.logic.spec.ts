import { applyScoreRules, ScoreState } from './score.logic';

const s = (score: number, consecutiveWins: number): ScoreState => ({ score, consecutiveWins });

describe('applyScoreRules', () => {
  // ── RULE-SCORE-01: win ────────────────────────────────────────────────────

  it('win from 0 → score=1, consecutiveWins=1 (RULE-SCORE-01)', () => {
    expect(applyScoreRules(s(0, 0), 'PLAYER_WIN')).toEqual({ score: 1, consecutiveWins: 1 });
  });

  it('second consecutive win → score=2, consecutiveWins=2 (RULE-SCORE-01)', () => {
    expect(applyScoreRules(s(1, 1), 'PLAYER_WIN')).toEqual({ score: 2, consecutiveWins: 2 });
  });

  it('third consecutive win → bonus +1, consecutiveWins resets to 0 (RULE-SCORE-01)', () => {
    // win +1, bonus +1: 2 → 4
    expect(applyScoreRules(s(2, 2), 'PLAYER_WIN')).toEqual({ score: 4, consecutiveWins: 0 });
  });

  it('4th win after bonus → score=5, consecutiveWins=1 (RULE-SCORE-01)', () => {
    expect(applyScoreRules(s(4, 0), 'PLAYER_WIN')).toEqual({ score: 5, consecutiveWins: 1 });
  });

  it('6 consecutive wins → 2 bonuses, score=8, consecutiveWins=0 (RULE-SCORE-01)', () => {
    let state = s(0, 0);
    for (let i = 0; i < 6; i++) state = applyScoreRules(state, 'PLAYER_WIN');
    expect(state).toEqual({ score: 8, consecutiveWins: 0 });
  });

  it('7 consecutive wins → score=9, consecutiveWins=1 (RULE-SCORE-01)', () => {
    let state = s(0, 0);
    for (let i = 0; i < 7; i++) state = applyScoreRules(state, 'PLAYER_WIN');
    expect(state).toEqual({ score: 9, consecutiveWins: 1 });
  });

  // ── RULE-SCORE-02: loss ───────────────────────────────────────────────────

  it('loss deducts 1 point and resets consecutiveWins (RULE-SCORE-02)', () => {
    expect(applyScoreRules(s(5, 2), 'BOT_WIN')).toEqual({ score: 4, consecutiveWins: 0 });
  });

  it('loss cannot bring score below 0 (RULE-SCORE-02)', () => {
    expect(applyScoreRules(s(0, 0), 'BOT_WIN')).toEqual({ score: 0, consecutiveWins: 0 });
  });

  it('loss from score=1 → score=0 (RULE-SCORE-02)', () => {
    expect(applyScoreRules(s(1, 0), 'BOT_WIN')).toEqual({ score: 0, consecutiveWins: 0 });
  });

  it('loss resets consecutiveWins mid-streak (RULE-SCORE-02)', () => {
    const after2wins = applyScoreRules(applyScoreRules(s(0, 0), 'PLAYER_WIN'), 'PLAYER_WIN');
    expect(after2wins).toEqual({ score: 2, consecutiveWins: 2 });
    expect(applyScoreRules(after2wins, 'BOT_WIN')).toEqual({ score: 1, consecutiveWins: 0 });
  });

  // ── RULE-SCORE-03: draw ───────────────────────────────────────────────────

  it('draw does not change score or consecutiveWins (RULE-SCORE-03)', () => {
    expect(applyScoreRules(s(5, 2), 'DRAW')).toEqual({ score: 5, consecutiveWins: 2 });
  });

  it('draw from zero is a no-op (RULE-SCORE-03)', () => {
    expect(applyScoreRules(s(0, 0), 'DRAW')).toEqual({ score: 0, consecutiveWins: 0 });
  });

  it('draw preserves consecutiveWins mid-streak (RULE-SCORE-03)', () => {
    const after2wins = applyScoreRules(applyScoreRules(s(0, 0), 'PLAYER_WIN'), 'PLAYER_WIN');
    expect(applyScoreRules(after2wins, 'DRAW')).toEqual({ score: 2, consecutiveWins: 2 });
  });
});
