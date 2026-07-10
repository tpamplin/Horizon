// =============================================================================
// Horizon — Auth Middleware Tests
// =============================================================================
// Tests JWT authentication middleware via Fastify inject():
// - Public path skip
// - Missing / malformed / expired / invalid token → 401
// - Valid token → attaches user payload to request
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.js';

// -----------------------------------------------------------------------------
// Test Setup
// -----------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-for-auth-middleware-tests';
const VALID_USER_PAYLOAD = {
  userId: 'user-123',
  displayName: 'Test Player',
  email: 'test@example.com',
};

function buildApp() {
  const app = Fastify({ logger: false });

  // Register the auth middleware as a preHandler
  app.addHook('preHandler', authMiddleware);

  // Health check — public path, no auth required
  app.get('/api/health', async () => {
    return { status: 'ok' };
  });

  // A protected route that echoes the authenticated user
  app.get('/api/protected', async (request) => {
    return { user: request.user };
  });

  return app;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function signToken(payload: object, expiresIn: string | number = '1h'): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn } as jwt.SignOptions);
}

function expiredToken(): string {
  // Sign with an expiry in the past
  return jwt.sign(VALID_USER_PAYLOAD, TEST_SECRET, { expiresIn: '-1s' } as jwt.SignOptions);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('authMiddleware', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    // Override config.jwtSecret for testing
    process.env.JWT_SECRET = TEST_SECRET;
    // Re-import config so the override takes effect
    const { config } = await import('../config.js');
    config.jwtSecret = TEST_SECRET;

    app = buildApp();
    await app.ready();
  });

  // ---------------------------------------------------------------------------
  // Public Paths
  // ---------------------------------------------------------------------------

  it('skips auth for /api/health (public path)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(res.statusCode).toBe(200);
  });

  it('skips auth for /api/auth/register (public path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
    });
    expect(res.statusCode).not.toBe(401);
  });

  it('skips auth for /api/auth/login (public path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
    });
    expect(res.statusCode).not.toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Missing / Malformed Authorization Header
  // ---------------------------------------------------------------------------

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Missing Authorization header.',
      statusCode: 401,
    });
  });

  it('returns 401 for non-Bearer scheme (Basic auth)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('Bearer scheme');
    expect(body.statusCode).toBe(401);
  });

  it('returns 401 for empty Authorization header value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: '' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for malformed Authorization header (single part)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: 'just-a-string' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.message).toContain('Bearer scheme');
  });

  // ---------------------------------------------------------------------------
  // Valid Token
  // ---------------------------------------------------------------------------

  it('attaches user payload to request for valid Bearer token', async () => {
    const token = signToken(VALID_USER_PAYLOAD);

    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.user.userId).toBe(VALID_USER_PAYLOAD.userId);
    expect(body.user.displayName).toBe(VALID_USER_PAYLOAD.displayName);
    expect(body.user.email).toBe(VALID_USER_PAYLOAD.email);
  });

  // ---------------------------------------------------------------------------
  // Expired / Invalid Token
  // ---------------------------------------------------------------------------

  it('returns 401 for expired token with descriptive message', async () => {
    const token = expiredToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('expired');
    expect(body.statusCode).toBe(401);
  });

  it('returns 401 for invalid (garbage) token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: 'Bearer not.a.real.jwt.token' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Invalid token.');
    expect(body.statusCode).toBe(401);
  });

  it('returns 401 for token signed with wrong secret', async () => {
    const token = jwt.sign(VALID_USER_PAYLOAD, 'wrong-secret', { expiresIn: '1h' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.message).toBe('Invalid token.');
  });

  // ---------------------------------------------------------------------------
  // Response Shape Consistency
  // ---------------------------------------------------------------------------

  it('all 401 responses have the { error, message, statusCode } shape', async () => {
    const scenarios = [
      { headers: {} },
      { headers: { authorization: 'Basic xxx' } },
      { headers: { authorization: 'Bearer bad-token' } },
    ];

    for (const scenario of scenarios) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/protected',
        headers: scenario.headers,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('statusCode', 401);
      expect(typeof body.error).toBe('string');
      expect(typeof body.message).toBe('string');
    }
  });
});
