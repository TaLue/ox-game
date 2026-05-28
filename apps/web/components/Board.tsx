'use client';
import type { Cell } from '@ox/shared';

interface BoardProps {
  board: Cell[];
  onMove?: (index: number) => void;
  disabled?: boolean;
  lastBotMove?: number | null;
}

export function Board({ board, onMove, disabled, lastBotMove }: BoardProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      border: '2px solid var(--border)',
      width: '100%',
      maxWidth: 320,
      margin: '0 auto',
    }}>
      {board.map((cell, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const clickable = !disabled && !cell;
        const isBot = i === lastBotMove;

        return (
          <button
            key={i}
            onClick={() => clickable && onMove?.(i)}
            disabled={!clickable}
            aria-label={cell ? `Cell ${i}: ${cell}` : `Cell ${i}: empty`}
            className={clickable ? 'ox-cell' : undefined}
            style={{
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: cell === 'X' ? 900 : 600,
              color: 'var(--fg)',
              opacity: cell === 'O' ? 0.55 : 1,
              background: isBot ? 'var(--bot-cell)' : 'transparent',
              borderRight: col < 2 ? '2px solid var(--border)' : 'none',
              borderBottom: row < 2 ? '2px solid var(--border)' : 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRadius: 0,
              cursor: clickable ? 'pointer' : 'default',
              transition: 'background 0.1s',
              padding: 0,
            }}
          >
            {cell ?? ''}
          </button>
        );
      })}
    </div>
  );
}
