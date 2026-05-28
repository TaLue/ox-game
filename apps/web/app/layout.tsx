import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OX Game',
  description: 'Tic-Tac-Toe with OAuth2 login, streaks, and real-time leaderboard',
};

const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme','dark');
    }
  } catch(e){}
})();
`;

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:              #fafafa;
    --fg:              #111111;
    --fg-muted:        #888888;
    --fg-subtle:       rgba(17,17,17,0.4);
    --border:          #111111;
    --border-subtle:   #e5e5e5;
    --border-inactive: #dddddd;
    --cell-hover:      #f5f5f5;
    --bot-cell:        #fffde7;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  [data-theme="dark"] {
    --bg:              #0a0a0a;
    --fg:              #f0f0f0;
    --fg-muted:        #888888;
    --fg-subtle:       #666666;
    --border:          #f0f0f0;
    --border-subtle:   #222222;
    --border-inactive: #333333;
    --cell-hover:      #1a1a1a;
    --bot-cell:        #1a1a00;
  }

  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font);
    transition: background 0.15s, color 0.15s;
  }

  button:disabled { opacity: 0.4; cursor: not-allowed !important; }

  /* Pulsing dot for turn indicator */
  @keyframes ox-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }
  .ox-pulse { animation: ox-pulse 1s ease-in-out infinite; }

  /* Board cell hover — can't do :hover with inline styles */
  .ox-cell:hover { background: var(--cell-hover) !important; }

  /* Ghost / primary button base resets */
  .ox-btn {
    display: block;
    width: 100%;
    padding: 13px 0;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: center;
    cursor: pointer;
    border-radius: 0;
    border: 2px solid var(--border);
    transition: opacity 0.1s;
  }
  .ox-btn:hover:not(:disabled) { opacity: 0.75; }
  .ox-btn-primary {
    background: var(--fg);
    color: var(--bg);
  }
  .ox-btn-ghost {
    background: transparent;
    color: var(--fg);
  }
  .ox-btn-ghost.active {
    background: var(--fg);
    color: var(--bg);
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* No-flash theme detection — must run before body renders */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
