'use client';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@ox/shared';
import { api } from '../../lib/api';
import { ThemeToggle } from '../../components/ThemeToggle';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const GRID_SVG_LIGHT = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M 32 0 L 0 0 0 32' fill='none' stroke='%23000' stroke-width='1'/></svg>`;

export default function LoginPage() {
  const [top, setTop] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    api.getLeaderboard(3, 'HARD').then(setTop).catch(() => {});
  }, []);

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,${GRID_SVG_LIGHT}")`,
        backgroundSize: '32px 32px',
      }} />
      {/* Floating XO pattern */}
      <div style={{
        position: 'absolute', top: 16, left: 20,
        fontSize: 36, fontWeight: 900, lineHeight: 1.3,
        letterSpacing: 8, opacity: 0.05, color: 'var(--fg)',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        {['✕○✕', '○✕○', '✕○✕'].map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      {/* Theme toggle */}
      <div style={{ position: 'absolute', top: 16, right: 20 }}>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', textAlign: 'center', width: '100%', maxWidth: 360, padding: '0 20px' }}>
        {/* Title */}
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, marginBottom: 10 }}>
          ✕ ○<br />OX GAME
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '1.5px',
          textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 40,
        }}>
          Tic-Tac-Toe · Score · Leaderboard
        </div>

        {/* Top Streaks preview */}
        <div style={{ border: '2px solid var(--border)', maxWidth: 320, margin: '0 auto 24px', textAlign: 'left' }}>
          <div style={{
            borderBottom: '2px solid var(--border)', padding: '8px 14px',
            fontSize: 10, fontWeight: 700, letterSpacing: '1.5px',
            textTransform: 'uppercase', color: 'var(--fg-muted)',
          }}>
            Top Scores
          </div>
          {top.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fg-subtle)' }}>
              No scores yet — be the first!
            </div>
          ) : top.map((e, idx) => (
            <div key={e.userId} style={{
              padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: idx < top.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              opacity: idx === 0 ? 1 : idx === 1 ? 0.65 : 0.4,
            }}>
              <span style={{ fontWeight: idx === 0 ? 700 : 500, fontSize: 13 }}>
                {MEDAL[e.rank] ?? e.rank} {e.displayName}
              </span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{e.score} pts</span>
            </div>
          ))}
        </div>

        {/* Login button */}
        <a
          href="/api/auth/login?provider=auth0"
          className="ox-btn ox-btn-primary"
          style={{ display: 'block', maxWidth: 320, margin: '0 auto', textDecoration: 'none' }}
        >
          Login with Auth0
        </a>
      </div>
    </main>
  );
}
