'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Difficulty } from '@ox/shared';
import { Board } from '../../components/Board';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { getSocket, disconnectSocket } from '../../lib/socket';

const INDICATOR: Record<string, { text: string; sub: string; pulse: boolean }> = {
  IN_PROGRESS_PLAYER: { text: 'YOUR TURN', sub: 'Playing as ✕', pulse: true },
  IN_PROGRESS_BOT:    { text: 'BOT THINKING...', sub: '', pulse: true },
  PLAYER_WIN:         { text: 'YOU WIN', sub: '+1 point', pulse: false },
  BOT_WIN:            { text: 'BOT WINS', sub: '-1 point', pulse: false },
  DRAW:               { text: 'DRAW', sub: 'No change', pulse: false },
};

function indicatorKey(status: string, loading: boolean) {
  if (status === 'IN_PROGRESS') return loading ? 'IN_PROGRESS_BOT' : 'IN_PROGRESS_PLAYER';
  return status;
}

export default function PlayPage() {
  const router = useRouter();
  const { user, loading: authLoading, fetchMe, logout } = useAuthStore();
  const { game, score, lastResult, error, loading, startGame, makeMove, setScore, reset } = useGameStore();
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');

  useEffect(() => {
    fetchMe().then(() => {
      if (!useAuthStore.getState().user) router.replace('/login');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.on('score:update', setScore);
    return () => {
      socket.off('score:update', setScore);
      disconnectSocket();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => { await logout(); router.replace('/login'); };

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <span style={{ color: 'var(--fg-muted)', fontSize: 11, letterSpacing: '1.5px' }}>LOADING...</span>
    </div>
  );
  if (!user) return null;

  const isFinished = game && game.status !== 'IN_PROGRESS';
  const indicator = game ? INDICATOR[indicatorKey(game.status, loading)] : null;
  const diff = game?.difficulty as Difficulty | undefined ?? difficulty;

  const easyScore   = score?.easyScore ?? 0;
  const easyConsWin = score?.easyConsecutiveWins ?? 0;
  const hardScore   = score?.hardScore ?? 0;
  const hardConsWin = score?.hardConsecutiveWins ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '2px solid var(--border)',
        padding: '14px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.5 }}>✕○ OX</span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/leaderboard" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', color: 'var(--fg)', opacity: 0.5, textDecoration: 'none' }}>
            LEADERBOARD
          </a>
          <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{user.displayName}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '1px', color: 'var(--fg)', opacity: 0.5 }}>
            LOGOUT
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>

        {/* Score cards */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Score
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {(['EASY', 'HARD'] as Difficulty[]).map((d) => {
            const active   = diff === d;
            const pts      = d === 'EASY' ? easyScore   : hardScore;
            const consWins = d === 'EASY' ? easyConsWin : hardConsWin;
            return (
              <div key={d} style={{
                flex: 1,
                border: `2px solid ${active ? 'var(--border)' : 'var(--border-inactive)'}`,
                padding: '12px 14px',
                opacity: active ? 1 : 0.4,
              }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>
                  {d}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {pts}
                </div>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--fg-subtle)', marginTop: 2 }}>
                  {consWins > 0 ? `${consWins}/3 wins` : 'pts'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pre-game: difficulty + start */}
        {!game && (
          <>
            <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
              {(['EASY', 'HARD'] as Difficulty[]).map((d, i) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`ox-btn ox-btn-ghost${difficulty === d ? ' active' : ''}`}
                  style={{ borderLeft: i > 0 ? 'none' : undefined }}
                >
                  {d === 'EASY' ? 'Easy' : 'Hard'}
                </button>
              ))}
            </div>
            <button
              onClick={() => startGame(difficulty)}
              disabled={loading}
              className="ox-btn ox-btn-primary"
            >
              {loading ? 'Starting…' : 'Start Game'}
            </button>
          </>
        )}

        {/* Turn indicator + board */}
        {game && indicator && (
          <>
            <div style={{
              border: '2px solid var(--border)',
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div
                className={indicator.pulse ? 'ox-pulse' : undefined}
                style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '1px' }}>{indicator.text}</div>
                {indicator.sub && (
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--fg-subtle)', marginTop: 2 }}>{indicator.sub}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Board
                board={game.board}
                onMove={makeMove}
                disabled={loading || game.status !== 'IN_PROGRESS'}
                lastBotMove={lastResult?.botMove ?? null}
              />
            </div>

            {isFinished && (
              <button onClick={reset} className="ox-btn ox-btn-primary">
                New Game
              </button>
            )}
          </>
        )}

        {error && (
          <p style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.5px' }}>{error}</p>
        )}
      </main>
    </div>
  );
}
