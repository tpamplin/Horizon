// =============================================================================
// Horizon — Auth Store (Expanded)
// =============================================================================
// Stores JWT tokens, user info, and provides auth action methods.
// Persists tokens to localStorage for session survival across page refreshes.
// =============================================================================

import { create } from 'zustand';
import { api } from '../api/client.js';
import type { User } from 'shared';

// -----------------------------------------------------------------------------
// localStorage Keys
// -----------------------------------------------------------------------------

const LS_ACCESS_TOKEN = 'horizon_access_token';
const LS_REFRESH_TOKEN = 'horizon_refresh_token';
const LS_USER = 'horizon_user';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function persistTokens(accessToken: string, refreshToken: string, user: User): void {
  try {
    localStorage.setItem(LS_ACCESS_TOKEN, accessToken);
    localStorage.setItem(LS_REFRESH_TOKEN, refreshToken);
    localStorage.setItem(LS_USER, JSON.stringify(user));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

function clearPersistedTokens(): void {
  try {
    localStorage.removeItem(LS_ACCESS_TOKEN);
    localStorage.removeItem(LS_REFRESH_TOKEN);
    localStorage.removeItem(LS_USER);
  } catch {
    // noop
  }
}

function readPersistedTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
} {
  try {
    const accessToken = localStorage.getItem(LS_ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);
    const userRaw = localStorage.getItem(LS_USER);
    const user = userRaw ? (JSON.parse(userRaw) as User) : null;
    return { accessToken, refreshToken, user };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  // Computed
  isAuthenticated: () => boolean;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  performTokenRefresh: () => Promise<boolean>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  isAuthenticated: () => {
    const state = get();
    return state.user !== null && state.accessToken !== null;
  },

  setAuth: (user, accessToken, refreshToken) => {
    persistTokens(accessToken, refreshToken, user);
    set({ user, accessToken, refreshToken, isLoading: false });
  },

  clearAuth: () => {
    clearPersistedTokens();
    set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
  },

  login: async (email, password) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        createdAt: string;
      };
    }>('/api/auth/login', { email, password });

    const user: User = {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName,
      avatarUrl: data.user.avatarUrl ?? null,
      createdAt: data.user.createdAt,
    };

    get().setAuth(user, data.access_token, data.refresh_token);
    return user;
  },

  register: async (email, password, displayName) => {
    await api.post('/api/auth/register', { email, password, displayName });
    // Do NOT auto-login — user must log in separately
  },

  logout: () => {
    get().clearAuth();
    window.location.href = '/';
  },

  performTokenRefresh: async () => {
    const { refreshToken: rt } = get();
    if (!rt) return false;

    try {
      const data = await api.post<{
        access_token: string;
        refresh_token: string;
        user: {
          id: string;
          email: string;
          displayName: string;
          avatarUrl: string | null;
          createdAt: string;
        };
      }>('/api/auth/refresh', { refresh_token: rt });

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl ?? null,
        createdAt: data.user.createdAt,
      };

      get().setAuth(user, data.access_token, data.refresh_token);
      return true;
    } catch {
      get().clearAuth();
      return false;
    }
  },

  initialize: async () => {
    const { accessToken, refreshToken, user } = readPersistedTokens();

    if (!accessToken) {
      set({ isLoading: false });
      return;
    }

    // Pre-populate store with persisted tokens so the api client can use them
    set({ user, accessToken, refreshToken, isLoading: true });

    try {
      const data = await api.get<{
        user: {
          id: string;
          email: string;
          displayName: string;
          avatarUrl: string | null;
          createdAt: string;
        };
      }>('/api/auth/me');

      const validatedUser: User = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl ?? null,
        createdAt: data.user.createdAt,
      };

      set({ user: validatedUser, isLoading: false });
    } catch {
      // api client's 401 interceptor already attempted token refresh —
      // if we reach here, both access and refresh tokens are invalid.
      get().clearAuth();
    }
  },
}));
