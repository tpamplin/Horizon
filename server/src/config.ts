// =============================================================================
// Horizon — Server Configuration
// =============================================================================
// Centralized, typed configuration from environment variables.
// All process.env access flows through this module — no scattered reads.
// =============================================================================

// -----------------------------------------------------------------------------
// Config Interface
// -----------------------------------------------------------------------------

export interface ServerConfig {
  /** Network port the server listens on. */
  port: number;
  /** Bind address for the server. */
  host: string;
  /** Path to the SQLite database file. */
  databasePath: string;
  /** Secret key for signing JWT access tokens. */
  jwtSecret: string;
  /** Directory for uploaded files (portraits, backgrounds). */
  uploadDir: string;
  /** Current environment: development, production, or test. */
  nodeEnv: 'development' | 'production' | 'test';
}

// -----------------------------------------------------------------------------
// Environment Helpers
// -----------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer. Got: "${raw}"`);
  }
  return parsed;
}

function envNodeEnv(): 'development' | 'production' | 'test' {
  const raw = (process.env.NODE_ENV || 'development').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'test' || raw === 'testing') return 'test';
  return 'development';
}

// -----------------------------------------------------------------------------
// Config Factory
// -----------------------------------------------------------------------------

/**
 * Build the server configuration from environment variables.
 *
 * In production, `JWT_SECRET` is required and will throw if missing.
 * In development and test, it defaults to a non-secret placeholder.
 *
 * @throws {Error} If JWT_SECRET is missing in production.
 */
export function loadConfig(): ServerConfig {
  const nodeEnv = envNodeEnv();

  const jwtSecret = process.env.JWT_SECRET;
  if (nodeEnv === 'production' && !jwtSecret) {
    throw new Error(
      'JWT_SECRET environment variable is required in production. ' +
        'Generate a strong random secret (e.g. `openssl rand -hex 64`).',
    );
  }

  return {
    port: envInt('PORT', 3001),
    host: envStr('HOST', '0.0.0.0'),
    databasePath: envStr('DATABASE_PATH', './data/horizon.db'),
    jwtSecret: jwtSecret || 'dev-secret-do-not-use-in-production',
    uploadDir: envStr('UPLOAD_DIR', './data/uploads'),
    nodeEnv,
  };
}

/**
 * Singleton config instance — loaded once at startup.
 */
export const config: ServerConfig = loadConfig();
