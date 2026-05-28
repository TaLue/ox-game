'use client';
import { useEffect, useState } from 'react';
import type { Difficulty, LeaderboardEntry } from '@ox/shared';
import { api } from '../../lib/api';
import { ThemeToggle } from '../../components/ThemeToggle';
import { getSocket, disconnectSocket } from '../../lib/socket';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function rowOpacity(rank: number) {
  if (rank === 1) return 1;
  if (rank === 2) return 0.8;
  return 0.55;
}

function rowBorder(rank: number) {
  if (rank === 1) return 'var(--border)';
  if (rank === 2) return 'var(--border-inactive)';
  return 'var(--border-subtle)';
}

export default function LeaderboardPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>('HARD');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getLeaderboard(20, difficulty)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [difficulty]);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.on('leaderboard:update', (data: { difficulty: Difficulty; entries: LeaderboardEntry[] }) => {
      if (data.difficulty === difficulty) setEntries(data.entries);
    });
    return () => {
      socket.off('leaderboard:update');
      disconnectSocket();
    };
  }, [difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '2px solid var(--border)',
        padding: '14px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.3 }}>LEADERBOARD</span>
          <a href="/play" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', color: 'var(--fg)', opacity: 0.5, textDecoration: 'none' }}>
            ← PLAY
          </a>
        </div>
        <ThemeToggle />
      </header>

      {/* Content */}
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>

        {/* Difficulty tabs */}
        <div style={{ display: 'flex', border: '2px solid var(--border)', marginBottom: 24 }}>
          {(['HARD', 'EASY'] as Difficulty[]).map((d, i) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              style={{
                flex: 1,
                padding: '9px 0',
                fontSize: 10, fontWeight: 900, letterSpacing: '1.5px',
                textTransform: 'uppercase',
                border: 'none',
                borderLeft: i > 0 ? '2px solid var(--border)' : 'none',
                borderRadius: 0,
                cursor: 'pointer',
                background: difficulty === d ? 'var(--fg)' : 'transparent',
                color: difficulty === d ? 'var(--bg)' : 'var(--fg)',
                opacity: difficulty === d ? 1 : 0.35,
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--fg-muted)', textAlign: 'center', padding: '32px 0' }}>
            LOADING...
          </div>
        )}

        {/* Empty */}
        {!loading && entries.length === 0 && (
          <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--fg-muted)', textAlign: 'center', padding: '32px 0' }}>
            NO SCORES YET
          </div>
        )}

        {/* Entry cards */}
        {!loading && entries.map((e) => (
          <div
            key={e.userId}
            style={{
              border: `2px solid ${rowBorder(e.rank)}`,
              padding: '14px 16px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              opacity: rowOpacity(e.rank),
            }}
          >
            <div style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }}>
              {MEDAL[e.rank] ?? e.rank}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.displayName}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{e.score}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--fg-subtle)', marginTop: 2 }}>pts</div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
