// =============================================================================
// Horizon — useAuth Hook
// =============================================================================
// Convenience hook wrapping useAuthStore with a selector for commonly needed
// values. Components should use this hook instead of reading the store directly.
// =============================================================================

import { useAuthStore } from '../stores/authStore.js';

export function useAuth() {
  return useAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated(),
    isLoading: state.isLoading,
    login: state.login,
    register: state.register,
    logout: state.logout,
    refreshToken: state.performTokenRefresh,
  }));
}
