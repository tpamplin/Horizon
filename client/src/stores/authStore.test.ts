// =============================================================================
// Horizon — Auth Store Unit Tests
// =============================================================================
// Vitest unit tests for authStore actions. Mocks the API client and localStorage
// to verify state transitions, persistence, and error handling.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// -----------------------------------------------------------------------------
// Globals (must be set BEFORE importing the store — Node has no localStorage/window)
// -----------------------------------------------------------------------------

const store: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k];
  }),
});

vi.stubGlobal('window', {
  location: { href: '' },
});

vi.stubGlobal('fetch', vi.fn());

// -----------------------------------------------------------------------------
// Mock the API client
// -----------------------------------------------------------------------------

vi.mock('../api/client.js', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { useAuthStore } from './authStore.js';
import { api } from '../api/client.js';
import type { User } from 'shared';

const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockGet = api.get as ReturnType<typeof vi.fn>;

// -----------------------------------------------------------------------------
// Test Helpers
// -----------------------------------------------------------------------------

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test Player',
  avatarUrl: null,
  createdAt: '2026-07-09T00:00:00.000Z',
};

function resetStore() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // setAuth & clearAuth
  // ---------------------------------------------------------------------------

  describe('setAuth / clearAuth', () => {
    it('setAuth stores user and tokens, sets isLoading false', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('access-1');
      expect(state.refreshToken).toBe('refresh-1');
      expect(state.isLoading).toBe(false);
    });

    it('setAuth persists tokens to localStorage', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');

      expect(localStorage.getItem('horizon_access_token')).toBe('access-1');
      expect(localStorage.getItem('horizon_refresh_token')).toBe('refresh-1');
      expect(JSON.parse(localStorage.getItem('horizon_user')!)).toEqual(mockUser);
    });

    it('clearAuth removes user and tokens, sets isLoading false', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');
      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('clearAuth removes persisted tokens from localStorage', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');
      useAuthStore.getState().clearAuth();

      expect(localStorage.getItem('horizon_access_token')).toBeNull();
      expect(localStorage.getItem('horizon_refresh_token')).toBeNull();
      expect(localStorage.getItem('horizon_user')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isAuthenticated
  // ---------------------------------------------------------------------------

  describe('isAuthenticated', () => {
    it('returns true when user and accessToken are present', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');
      expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    });

    it('returns false when user is null', () => {
      useAuthStore.setState({ accessToken: 'access-1' });
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });

    it('returns false when accessToken is null', () => {
      useAuthStore.setState({ user: mockUser });
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });

    it('returns false when both are null', () => {
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------

  describe('login', () => {
    it('calls POST /api/auth/login and stores tokens on success', async () => {
      mockPost.mockResolvedValueOnce({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          displayName: mockUser.displayName,
          avatarUrl: null,
          createdAt: mockUser.createdAt,
        },
      });

      const user = await useAuthStore.getState().login('test@example.com', 'password123');

      expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(user.email).toBe('test@example.com');

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('access-1');
      expect(state.refreshToken).toBe('refresh-1');
      expect(state.user).toBeTruthy();
    });

    it('throws on failed login', async () => {
      mockPost.mockRejectedValueOnce(new Error('Invalid email or password.'));

      await expect(useAuthStore.getState().login('bad@example.com', 'wrong')).rejects.toThrow(
        'Invalid email or password.',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('calls POST /api/auth/register but does NOT set auth state', async () => {
      mockPost.mockResolvedValueOnce({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        user: mockUser,
      });

      await useAuthStore.getState().register('new@example.com', 'password123', 'New User');

      expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      });

      // Must NOT auto-login
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('throws on registration failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('A user with this email already exists.'));

      await expect(
        useAuthStore.getState().register('exists@example.com', 'password123', 'Exists'),
      ).rejects.toThrow('A user with this email already exists.');
    });
  });

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------

  describe('logout', () => {
    it('clears store and localStorage', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(localStorage.getItem('horizon_access_token')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // performTokenRefresh
  // ---------------------------------------------------------------------------

  describe('performTokenRefresh', () => {
    it('refreshes tokens and updates store on success', async () => {
      useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh');

      mockPost.mockResolvedValueOnce({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          displayName: mockUser.displayName,
          avatarUrl: null,
          createdAt: mockUser.createdAt,
        },
      });

      const result = await useAuthStore.getState().performTokenRefresh();

      expect(result).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('/api/auth/refresh', {
        refresh_token: 'old-refresh',
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('new-access');
      expect(state.refreshToken).toBe('new-refresh');
    });

    it('returns false and clears auth when refresh fails', async () => {
      useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh');

      mockPost.mockRejectedValueOnce(new Error('Invalid refresh token.'));

      const result = await useAuthStore.getState().performTokenRefresh();

      expect(result).toBe(false);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('returns false when no refresh token is stored', async () => {
      const result = await useAuthStore.getState().performTokenRefresh();
      expect(result).toBe(false);
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------------

  describe('initialize', () => {
    it('sets isLoading false immediately when no access token in localStorage', async () => {
      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
    });

    it('restores session from localStorage and validates via /api/auth/me', async () => {
      localStorage.setItem('horizon_access_token', 'stored-access');
      localStorage.setItem('horizon_refresh_token', 'stored-refresh');
      localStorage.setItem('horizon_user', JSON.stringify(mockUser));

      mockGet.mockResolvedValueOnce({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          displayName: mockUser.displayName,
          avatarUrl: null,
          createdAt: mockUser.createdAt,
        },
      });

      await useAuthStore.getState().initialize();

      expect(mockGet).toHaveBeenCalledWith('/api/auth/me');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeTruthy();
      expect(state.user!.email).toBe('test@example.com');
      expect(state.accessToken).toBe('stored-access');
    });

    it('clears auth when /me fails and no refresh token available', async () => {
      localStorage.setItem('horizon_access_token', 'stored-access');
      // No refresh token stored — fallback to refresh won't work
      localStorage.setItem('horizon_user', JSON.stringify(mockUser));

      mockGet.mockRejectedValueOnce(new Error('Unauthorized'));

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isLoading
  // ---------------------------------------------------------------------------

  describe('isLoading', () => {
    it('starts as true', () => {
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('setAuth sets isLoading to false', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-1', 'refresh-1');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('clearAuth sets isLoading to false', () => {
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
