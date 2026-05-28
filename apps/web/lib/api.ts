import type { Difficulty, GameDto, LeaderboardEntry, MeDto, MoveResultDto, ScoreDto } from '@ox/shared';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => apiFetch<MeDto>('/me'),
  logout: () => fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }),
  createGame: (difficulty: Difficulty) =>
    apiFetch<GameDto>('/games', { method: 'POST', body: JSON.stringify({ difficulty }) }),
  makeMove: (id: string, position: number) =>
    apiFetch<MoveResultDto>(`/games/${id}/move`, { method: 'POST', body: JSON.stringify({ position }) }),
  getScore: () => apiFetch<ScoreDto>('/scores/me'),
  getLeaderboard: (limit = 10, difficulty: Difficulty = 'HARD') =>
    apiFetch<LeaderboardEntry[]>(`/leaderboard?limit=${limit}&difficulty=${difficulty}`),
};

export { ApiError };
