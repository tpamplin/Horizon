// =============================================================================
// Horizon — Auth Store (Minimal)
// =============================================================================
// Stores JWT tokens and user info. Expanded in HZN-70.
// =============================================================================

import { create } from 'zustand';
import type { User } from 'shared';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
  clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
}));
