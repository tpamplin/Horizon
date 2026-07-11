// =============================================================================
// Horizon — Upload Routes Tests
// =============================================================================
// Vitest integration tests for POST /api/upload and GET /uploads/:filename.
// Uses a temporary upload directory for isolation.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

// -----------------------------------------------------------------------------
// 1×1 pixel PNG in base64 (valid test image, ~68 bytes)
// -----------------------------------------------------------------------------

const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// A fake oversized "image" — generate a large base64 string
function fakeOversizedBase64(): string {
  // 6 MB of base64 data
  const size = 6 * 1024 * 1024;
  const buf = Buffer.alloc(size, 'A');
  return `data:image/png;base64,${buf.toString('base64')}`;
}

// -----------------------------------------------------------------------------
// Test Configuration
// -----------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-hzn134-upload';
const TEST_UPLOAD_DIR = join(tmpdir(), `horizon-upload-test-${randomUUID()}`);

// Set env before importing config
process.env.JWT_SECRET = TEST_SECRET;
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

const { config } = await import('../config.js');
config.jwtSecret = TEST_SECRET;
config.uploadDir = TEST_UPLOAD_DIR;

const { default: uploadRoutes } = await import('./upload.js');
const { authMiddleware } = await import('../middleware/auth.js');

// Create upload directory
mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// App Setup
// -----------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

function buildApp() {
  const instance = Fastify({ logger: false });
  instance.addHook('preHandler', authMiddleware);
  instance.register(uploadRoutes);
  return instance;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function signToken(userId = 'test-user'): string {
  return jwt.sign({ userId, displayName: 'Test User', email: 'test@test.com' }, TEST_SECRET, {
    expiresIn: '15m',
  });
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try {
    rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

beforeEach(() => {
  // Clean up uploaded files between tests
  try {
    const files = readdirSync(TEST_UPLOAD_DIR);
    for (const f of files) {
      try {
        unlinkSync(join(TEST_UPLOAD_DIR, f));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
});

// =============================================================================
// POST /api/upload
// =============================================================================

describe('POST /api/upload', () => {
  it('returns 201 with URL for valid PNG upload', async () => {
    const token = signToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { image: VALID_PNG_BASE64 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.url).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);

    // Verify the file exists on disk
    const filename = body.url.replace('/uploads/', '');
    const filePath = join(TEST_UPLOAD_DIR, filename);
    expect(existsSync(filePath)).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/upload',
      payload: { image: VALID_PNG_BASE64 },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for non-data-URL string', async () => {
    const token = signToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { image: 'not-a-valid-data-url' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for unsupported image type', async () => {
    const token = signToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { image: 'data:image/bmp;base64,AAAA' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 413 for oversized image', async () => {
    const token = signToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { image: fakeOversizedBase64() },
    });

    expect(res.statusCode).toBe(413);
  });
});

// =============================================================================
// GET /uploads/:filename
// =============================================================================

describe('GET /uploads/:filename', () => {
  it('serves an uploaded file without auth', async () => {
    const token = signToken();

    // First upload a file
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: { image: VALID_PNG_BASE64 },
    });

    const { url } = uploadRes.json<{ url: string }>();

    // Now fetch it without auth
    const getRes = await app.inject({
      method: 'GET',
      url,
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers['content-type']).toBe('image/png');
    expect(getRes.body).toBeTruthy();
  });

  it('returns 404 for nonexistent file', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/uploads/nonexistent-file.png',
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects path traversal attempts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/uploads/../../etc/passwd',
    });

    // Fastify normalizes the path, so the auth middleware catches it first
    expect(res.statusCode).toBe(401);
  });
});
