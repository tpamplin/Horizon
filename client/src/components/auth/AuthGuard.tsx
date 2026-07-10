import { useState, useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../api/client.js';
import './AuthGuard.css';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // Already authenticated — nothing to do
      if (user && accessToken) {
        if (!cancelled) setChecking(false);
        return;
      }

      // No tokens at all — redirect to login
      if (!accessToken) {
        if (!cancelled) setChecking(false);
        return;
      }

      // Have access token but no user (page refresh scenario) — re-hydrate
      // Uses api client so expired tokens trigger silent refresh via the 401 interceptor.
      try {
        const data = await api.get<{
          user: { id: string; email: string; displayName: string; avatarUrl: string | null; createdAt: string };
        }>('/api/auth/me');

        if (!cancelled) {
          const state = useAuthStore.getState();
          // Preserve tokens (api client may have refreshed them), update user
          setAuth(data.user, state.accessToken!, state.refreshToken!);
          setChecking(false);
        }
      } catch {
        clearAuth();
        if (!cancelled) setChecking(false);
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, []); // Run once on mount

  // Show loading spinner while checking
  if (checking) {
    return (
      <div className="auth-guard-loading" role="status" aria-label="Checking authentication">
        <div className="auth-guard-loading__spinner" />
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!user || !accessToken) {
    const returnPath = location.pathname + location.search;
    return <Navigate to={`/login?return=${encodeURIComponent(returnPath)}`} replace />;
  }

  // Authenticated — render children
  return <>{children}</>;
}
