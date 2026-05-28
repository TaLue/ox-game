'use client';
import { create } from 'zustand';
import type { MeDto } from '@ox/shared';
import { api } from '../lib/api';

interface AuthState {
  user: MeDto | null;
  loading: boolean;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  fetchMe: async () => {
    set({ loading: true });
    try {
      const user = await api.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  logout: async () => {
    await api.logout().catch(() => {});
    set({ user: null });
  },
}));
