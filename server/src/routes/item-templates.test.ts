// =============================================================================
// Horizon — Item Template Routes Tests
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_SECRET = 'test-item-templates';
const TEST_DB_PATH = join(tmpdir(), `horizon-item-templates-${randomUUID()}.db`);
process.env.JWT_SECRET = TEST_SECRET;
process.env.DATABASE_PATH = TEST_DB_PATH;

const { config } = await import('../config.js');
config.jwtSecret = TEST_SECRET;
config.databasePath = TEST_DB_PATH;
const dbModule = await import('../models/db.js');
const db = dbModule.default;

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, avatar_url TEXT, password_hash TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS signature_item_templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    modifiers TEXT, rules TEXT, category TEXT, created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const { default: itemTemplateRoutes } = await import('./item-templates.js');
const { authMiddleware } = await import('../middleware/auth.js');

let app: ReturnType<typeof buildApp>;
function buildApp() {
  const i = Fastify({ logger: false });
  i.addHook('preHandler', authMiddleware);
  i.register(itemTemplateRoutes);
  return i;
}

function signToken(uid: string) {
  return jwt.sign({ userId: uid, displayName: 'Tester', email: 't@t.com' }, TEST_SECRET, {
    expiresIn: '15m',
  });
}

function seedUser(id: string) {
  db.prepare('INSERT INTO users (id, email, display_name) VALUES (?,?,?)').run(
    id,
    `${id}@t.com`,
    id,
  );
}

const USER_ID = 'user-1';
beforeAll(() => {
  seedUser(USER_ID);
  app = buildApp();
  app.ready();
});
afterAll(async () => {
  await app.close();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {
    /* ok */
  }
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('POST /api/items/templates', () => {
  it('creates a template and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/items/templates',
      headers: { authorization: `Bearer ${signToken(USER_ID)}` },
      payload: { name: 'Pirate Hat', description: 'A fine hat', category: 'headwear' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Pirate Hat');
    expect(body.category).toBe('headwear');
    expect(body.id).toBeTruthy();
    expect(body.createdBy).toBe(USER_ID);
  });

  it('rejects empty name with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/items/templates',
      headers: { authorization: `Bearer ${signToken(USER_ID)}` },
      payload: { name: '  ', description: 'no' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unauthenticated with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/items/templates',
      payload: { name: 'X', description: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/items/templates', () => {
  it('lists all templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/items/templates',
      headers: { authorization: `Bearer ${signToken(USER_ID)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('filters by category', async () => {
    const token = `Bearer ${signToken(USER_ID)}`;
    await app.inject({
      method: 'POST',
      url: '/api/items/templates',
      headers: { authorization: token },
      payload: { name: 'A', category: 'weapon' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/items/templates?category=weapon',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    for (const t of res.json()) expect(t.category).toBe('weapon');
  });
});

describe('GET /api/items/templates/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/items/templates/${randomUUID()}`,
      headers: { authorization: `Bearer ${signToken(USER_ID)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/items/templates/:id', () => {
  it('deletes a template and returns 204', async () => {
    const token = `Bearer ${signToken(USER_ID)}`;
    const create = await app.inject({
      method: 'POST',
      url: '/api/items/templates',
      headers: { authorization: token },
      payload: { name: 'ToDelete' },
    });
    const { id } = create.json();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/items/templates/${id}`,
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for missing id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/items/templates/${randomUUID()}`,
      headers: { authorization: `Bearer ${signToken(USER_ID)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
