'use client';
import { create } from 'zustand';
import type { Difficulty, GameDto, MoveResultDto, ScoreDto } from '@ox/shared';
import { api, ApiError } from '../lib/api';

interface GameState {
  game: GameDto | null;
  score: ScoreDto | null;
  lastResult: MoveResultDto | null;
  error: string | null;
  loading: boolean;

  startGame: (difficulty: Difficulty) => Promise<void>;
  makeMove: (position: number) => Promise<void>;
  setScore: (score: ScoreDto) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  score: null,
  lastResult: null,
  error: null,
  loading: false,

  startGame: async (difficulty) => {
    set({ loading: true, error: null, lastResult: null });
    try {
      const [game, score] = await Promise.all([api.createGame(difficulty), api.getScore()]);
      set({ game, score, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  makeMove: async (position) => {
    const { game } = get();
    if (!game || game.status !== 'IN_PROGRESS') return;
    set({ loading: true, error: null });
    try {
      const result = await api.makeMove(game.id, position);
      set({
        game: { ...game, board: result.board, status: result.status },
        score: result.score,
        lastResult: result,
        loading: false,
      });
    } catch (e) {
      const err = e as ApiError;
      // 409 = occupied cell or finished game — show message but don't crash
      set({ error: err.message ?? 'Move failed', loading: false });
    }
  },

  setScore: (score) => set({ score }),

  reset: () => set({ game: null, lastResult: null, error: null }),
}));
