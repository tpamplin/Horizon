// =============================================================================
// Horizon — API Client
// =============================================================================
// Thin fetch wrapper with automatic JWT header injection and silent token
// refresh on 401 responses. All client-server communication flows through this
// module — never call fetch() directly.
// =============================================================================

import { useAuthStore } from '../stores/authStore.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiOptions {
  /** Request body (serialized to JSON for POST/PUT/PATCH). */
  body?: unknown;
  /** Additional headers to merge with defaults. */
  headers?: Record<string, string>;
  /** Override the default base URL. */
  baseUrl?: string;
}

// -----------------------------------------------------------------------------
// Refresh State (prevents concurrent refresh attempts)
// -----------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true if the refresh succeeded, false otherwise.
 * Only one refresh attempt is in flight at a time.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();

  if (!refreshToken) {
    return false;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        clearAuth();
        return false;
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string; displayName: string; avatarUrl: string | null };
      };

      setAuth(
        {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          avatarUrl: data.user.avatarUrl ?? null,
          createdAt: '',
        },
        data.access_token,
        data.refresh_token,
      );

      return true;
    } catch {
      clearAuth();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

async function request<T = unknown>(
  method: HttpMethod,
  url: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, baseUrl = '' } = options;

  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  const fullUrl = `${baseUrl}${url}`;

  let response = await fetch(fullUrl, fetchOptions);

  // Attempt silent token refresh on 401
  if (response.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      // Retry with the new token
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      response = await fetch(fullUrl, { ...fetchOptions, headers });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      (errorBody as { message?: string }).message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export const api = {
  get<T = unknown>(url: string, options?: ApiOptions): Promise<T> {
    return request<T>('GET', url, options);
  },

  post<T = unknown>(url: string, body?: unknown, options?: ApiOptions): Promise<T> {
    return request<T>('POST', url, { ...options, body });
  },

  put<T = unknown>(url: string, body?: unknown, options?: ApiOptions): Promise<T> {
    return request<T>('PUT', url, { ...options, body });
  },

  delete<T = unknown>(url: string, options?: ApiOptions): Promise<T> {
    return request<T>('DELETE', url, options);
  },

  patch<T = unknown>(url: string, body?: unknown, options?: ApiOptions): Promise<T> {
    return request<T>('PATCH', url, { ...options, body });
  },
};
