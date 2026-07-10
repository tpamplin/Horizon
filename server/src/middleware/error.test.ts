// =============================================================================
// Horizon — Error Handler Middleware Tests
// =============================================================================
// Tests the centralized error handler via Fastify inject():
// - Returns consistent { error, message, statusCode } JSON shape
// - Production mode hides error details
// - Development mode includes original error message
// - Defaults to 500 when no statusCode is set
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyError } from 'fastify';
import { errorHandler } from './error.js';
import { config } from '../config.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildApp(nodeEnv: 'development' | 'production' | 'test' = 'test') {
  // Directly override the config singleton (it was already loaded at import time)
  config.nodeEnv = nodeEnv;

  const app = Fastify({ logger: false });

  // Register error handler
  app.setErrorHandler(errorHandler);

  // Route that throws a FastifyError with a known statusCode
  app.get('/api/not-found', async () => {
    const err = new Error('Resource not found') as FastifyError;
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  });

  // Route that throws a generic Error (no statusCode → defaults to 500)
  app.get('/api/broken', async () => {
    throw new Error('Something exploded');
  });

  // Route that throws without a code property
  app.get('/api/no-code', async () => {
    const err = new Error('Weird error') as FastifyError;
    err.statusCode = 418;
    // no code set
    throw err;
  });

  return app;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('errorHandler', () => {
  describe('response shape', () => {
    let app: ReturnType<typeof buildApp>;

    beforeAll(async () => {
      app = buildApp('test');
      await app.ready();
    });

    it('returns { error, message, statusCode } for known FastifyError', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/not-found',
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('statusCode');
      expect(body.error).toBe('NOT_FOUND');
      expect(body.statusCode).toBe(404);
    });

    it('defaults error to "InternalServerError" when no code is set', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/no-code',
      });

      expect(res.statusCode).toBe(418);
      const body = res.json();
      expect(body.error).toBe('InternalServerError');
      expect(body.statusCode).toBe(418);
    });

    it('defaults statusCode to 500 for generic errors', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/broken',
      });

      expect(res.statusCode).toBe(500);
      const body = res.json();
      expect(body.statusCode).toBe(500);
    });

    it('all error fields are strings (except statusCode which is number)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/not-found',
      });

      const body = res.json();
      expect(typeof body.error).toBe('string');
      expect(typeof body.message).toBe('string');
      expect(typeof body.statusCode).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Production vs Development Behavior
  // ---------------------------------------------------------------------------

  describe('environment behavior', () => {
    it('in development/test mode, includes the real error message', async () => {
      const app = buildApp('development');
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/broken',
      });

      const body = res.json();
      expect(body.message).toBe('Something exploded');
    });

    it('in production mode, hides the real error message', async () => {
      const app = buildApp('production');
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/broken',
      });

      const body = res.json();
      expect(body.message).toBe('An unexpected error occurred.');
      // The error code should still be accurate
      expect(body.error).toBe('InternalServerError');
      expect(body.statusCode).toBe(500);
    });

    it('in production mode with a specific error code, hides message but preserves code', async () => {
      const app = buildApp('production');
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/not-found',
      });

      const body = res.json();
      expect(body.message).toBe('An unexpected error occurred.');
      expect(body.error).toBe('NOT_FOUND');
      expect(body.statusCode).toBe(404);
    });
  });
});
