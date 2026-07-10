// =============================================================================
// Horizon — Auth Routes Tests (Register)
// =============================================================================
// Vitest integration tests for POST /api/auth/register using Fastify inject().
// Uses a temporary file-based SQLite database so tests are isolated.
// Overrides config at module load time via env vars + dynamic imports.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// -----------------------------------------------------------------------------
// Test Configuration — set BEFORE any module imports
// -----------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-hzn72-register';
const TEST_DB_PATH = join(tmpdir(), `horizon-test-${randomUUID()}.db`);

process.env.JWT_SECRET = TEST_SECRET;
process.env.DATABASE_PATH = TEST_DB_PATH;

// Dynamic imports so config picks up our env vars
const { config } = await import('../config.js');
config.jwtSecret = TEST_SECRET;
config.databasePath = TEST_DB_PATH;

const dbModule = await import('../models/db.js');
const db = dbModule.default;

// Create schema (migration runner not used in tests)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    avatar_url    TEXT,
    password_hash TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
`);

const { default: authRoutes } = await import('./auth.js');
const { authMiddleware } = await import('../middleware/auth.js');

// -----------------------------------------------------------------------------
// App Setup
// -----------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

function buildApp() {
  const instance = Fastify({ logger: false });
  // Register auth middleware for protected routes (/me)
  instance.addHook('preHandler', authMiddleware);
  instance.register(authRoutes);
  return instance;
}

// -----------------------------------------------------------------------------
// Lifecycle (shared across all describe blocks)
// -----------------------------------------------------------------------------

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  db.close();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {
    /* ignore */
  }
});

// -----------------------------------------------------------------------------
// Register Tests
// -----------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    db.exec('DELETE FROM refresh_tokens');
    db.exec('DELETE FROM users');
  });

  const validUser = {
    email: 'test@example.com',
    password: 'password123',
    displayName: 'Test Player',
  };

  // -------------------------------------------------------------------------
  // Happy Path
  // -------------------------------------------------------------------------

  it('returns 201 with JWT pair and user on valid registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    expect(res.statusCode).toBe(201);

    const body = res.json<{
      access_token: string;
      refresh_token: string;
      user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        createdAt: string;
      };
    }>();

    expect(body.access_token).toBeTruthy();
    const decoded = jwt.verify(body.access_token, TEST_SECRET) as {
      userId: string;
      displayName: string;
      email: string;
    };
    expect(decoded.userId).toBeTruthy();
    expect(decoded.displayName).toBe('Test Player');
    expect(decoded.email).toBe('test@example.com');

    expect(body.refresh_token).toBeTruthy();
    expect(body.refresh_token.length).toBe(96);

    expect(body.user.email).toBe('test@example.com');
    expect(body.user.displayName).toBe('Test Player');
    expect(body.user.id).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Password Security
  // -------------------------------------------------------------------------

  it('stores password as bcrypt hash, not plaintext', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    const row = db
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .get('test@example.com') as
      | {
          password_hash: string;
        }
      | undefined;

    expect(row).toBeTruthy();
    expect(row!.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(row!.password_hash).not.toBe(validUser.password);
    const match = await bcrypt.compare(validUser.password, row!.password_hash);
    expect(match).toBe(true);
  });

  it('does not include password in the response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    const body = res.json<Record<string, unknown>>();
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('password_hash');
  });

  // -------------------------------------------------------------------------
  // Refresh Token Storage
  // -------------------------------------------------------------------------

  it('stores refresh token hash in the database', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    const body = res.json<{ refresh_token: string; user: { id: string } }>();

    const expectedHash = createHash('sha256').update(body.refresh_token).digest('hex');

    const row = db
      .prepare('SELECT token_hash, user_id FROM refresh_tokens WHERE user_id = ?')
      .get(body.user.id) as
      | {
          token_hash: string;
          user_id: string;
        }
      | undefined;

    expect(row).toBeTruthy();
    expect(row!.token_hash).toBe(expectedHash);
    expect(row!.user_id).toBe(body.user.id);
  });

  // -------------------------------------------------------------------------
  // Duplicate Email
  // -------------------------------------------------------------------------

  it('returns 409 on duplicate email', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json<{ error: string; message: string }>();
    expect(body.error).toBe('Conflict');
    expect(body.message).toContain('already exists');
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { password: 'password123', displayName: 'Test' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', displayName: 'Test' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when displayName is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'short', displayName: 'Test' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when displayName is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123', displayName: 'A' },
    });

    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Access Token Validity
  // -------------------------------------------------------------------------

  it('access token decodes to the correct user payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    const body = res.json<{ access_token: string; user: { id: string } }>();

    const decoded = jwt.verify(body.access_token, TEST_SECRET) as {
      userId: string;
      displayName: string;
      email: string;
    };

    expect(decoded.userId).toBe(body.user.id);
    expect(decoded.displayName).toBe('Test Player');
    expect(decoded.email).toBe('test@example.com');
  });
});

// =============================================================================
// Login Tests
// =============================================================================

describe('POST /api/auth/login', () => {
  const credentials = {
    email: 'login-test@example.com',
    password: 'password123',
    displayName: 'Login Test',
  };

  // Register a user before each login test
  async function registerTestUser() {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: credentials,
    });
  }

  beforeEach(async () => {
    db.exec('DELETE FROM refresh_tokens');
    db.exec('DELETE FROM users');
  });

  it('returns 200 with JWT pair and user on valid login', async () => {
    await registerTestUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: credentials.email, password: credentials.password },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json<{
      access_token: string;
      refresh_token: string;
      user: { id: string; email: string; displayName: string };
    }>();

    expect(body.access_token).toBeTruthy();
    const decoded = jwt.verify(body.access_token, TEST_SECRET) as {
      userId: string;
      displayName: string;
      email: string;
    };
    expect(decoded.email).toBe(credentials.email);
    expect(decoded.displayName).toBe(credentials.displayName);

    expect(body.refresh_token).toBeTruthy();
    expect(body.user.email).toBe(credentials.email);
  });

  it('returns 401 with generic message for wrong password', async () => {
    await registerTestUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: credentials.email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: string; message: string }>();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Invalid email or password.');
  });

  it('returns 401 with same generic message for non-existent email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: string; message: string }>();
    expect(body.error).toBe('Unauthorized');
    // Same message as wrong password — no user enumeration
    expect(body.message).toBe('Invalid email or password.');
  });

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('creates a new refresh token on each login', async () => {
    await registerTestUser();

    // Login twice
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: credentials.email, password: credentials.password },
    });

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: credentials.email, password: credentials.password },
    });
    const body2 = res2.json<{ user: { id: string } }>();

    // Registration creates 1 refresh token + 2 logins = 3 total
    const count = db
      .prepare('SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = ?')
      .get(body2.user.id) as { count: number };

    expect(count.count).toBe(3);
  });

  it('access token decodes to the correct user info', async () => {
    await registerTestUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: credentials.email, password: credentials.password },
    });

    const body = res.json<{ access_token: string; user: { id: string } }>();

    const decoded = jwt.verify(body.access_token, TEST_SECRET) as {
      userId: string;
      displayName: string;
      email: string;
    };

    expect(decoded.userId).toBe(body.user.id);
    expect(decoded.displayName).toBe(credentials.displayName);
    expect(decoded.email).toBe(credentials.email);
  });
});

// =============================================================================
// Refresh Tests
// =============================================================================

describe('POST /api/auth/refresh', () => {
  const user = { email: 'refresh@example.com', password: 'password123', displayName: 'Refresh Test' };

  async function registerAndGetTokens() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: user,
    });
    return res.json<{ access_token: string; refresh_token: string; user: { id: string } }>();
  }

  beforeEach(async () => {
    db.exec('DELETE FROM refresh_tokens');
    db.exec('DELETE FROM users');
  });

  it('returns 200 with new JWT pair on valid refresh', async () => {
    const tokens = await registerAndGetTokens();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: tokens.refresh_token },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ access_token: string; refresh_token: string; user: { email: string } }>();
    expect(body.access_token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
    expect(body.user.email).toBe(user.email);
  });

  it('rotates the refresh token (old token deleted, new token created)', async () => {
    const tokens = await registerAndGetTokens();
    const oldTokenHash = createHash('sha256').update(tokens.refresh_token).digest('hex');

    // Refresh
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: tokens.refresh_token },
    });
    const body = res.json<{ refresh_token: string }>();

    // Old token hash should be gone
    const oldRow = db.prepare('SELECT id FROM refresh_tokens WHERE token_hash = ?').get(oldTokenHash);
    expect(oldRow).toBeFalsy();

    // New token hash should exist
    const newTokenHash = createHash('sha256').update(body.refresh_token).digest('hex');
    const newRow = db.prepare('SELECT id FROM refresh_tokens WHERE token_hash = ?').get(newTokenHash);
    expect(newRow).toBeTruthy();
  });

  it('returns 401 when reusing the old refresh token', async () => {
    const tokens = await registerAndGetTokens();

    // First refresh
    await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: tokens.refresh_token },
    });

    // Reuse the same old token
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: tokens.refresh_token },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for an invalid/malformed refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: 'not-a-real-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when refresh_token is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// =============================================================================
// Me Tests (requires auth middleware)
// =============================================================================

describe('GET /api/auth/me', () => {
  const user = { email: 'me@example.com', password: 'password123', displayName: 'Me Test' };

  async function registerAndGetAccessToken() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: user,
    });
    const body = res.json<{ access_token: string }>();
    return body.access_token;
  }

  beforeEach(async () => {
    db.exec('DELETE FROM refresh_tokens');
    db.exec('DELETE FROM users');
  });

  it('returns 200 with user object for valid Bearer token', async () => {
    const accessToken = await registerAndGetAccessToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ user: { email: string; displayName: string } }>();
    expect(body.user.email).toBe(user.email);
    expect(body.user.displayName).toBe(user.displayName);
  });

  it('returns 401 when no Authorization header is present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with an expired access token', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test', displayName: 'Test', email: 'test@test.com' },
      TEST_SECRET,
      { expiresIn: '-1s' } as jwt.SignOptions,
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with a malformed Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'NotBearer blah' },
    });

    expect(res.statusCode).toBe(401);
  });
});
