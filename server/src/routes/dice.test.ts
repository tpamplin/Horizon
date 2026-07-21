// =============================================================================
// Horizon — Dice Routes Integration Tests
// =============================================================================
// HTTP-level tests for POST /api/dice/roll and GET /api/campaigns/:id/dice-log
// using Fastify's inject() for full request-response lifecycle testing.
// Pre-seeds SQLite schema to avoid migration runner issues.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

// -----------------------------------------------------------------------------
// Schema Pre-seed (before importing modules that trigger migration runner)
// -----------------------------------------------------------------------------

const TEST_DB_PATH = join(tmpdir(), `horizon-dice-routes-test-${randomUUID()}.db`);
const rawDb = new Database(TEST_DB_PATH);
rawDb.pragma('journal_mode = WAL');
rawDb.pragma('foreign_keys = ON');

rawDb.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);
  INSERT OR IGNORE INTO _migrations (name) VALUES
    ('001_initial.sql'),('002_add_password_hash.sql'),('003_user_scoped_characters.sql'),
    ('004_signature_item_templates.sql'),('005_ability_templates.sql'),('006_dice_logs.sql');
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    avatar_url TEXT, password_hash TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    gm_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_background_url TEXT, invite_code TEXT NOT NULL UNIQUE,
    ruleset_version TEXT NOT NULL DEFAULT 'horizon-v1', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS dice_logs (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    character_id TEXT, roller_user_id TEXT NOT NULL REFERENCES users(id),
    pool_json TEXT NOT NULL, modifiers_json TEXT, roll_source TEXT NOT NULL DEFAULT 'custom',
    result_json TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_dl_campaign ON dice_logs(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_dl_created ON dice_logs(campaign_id, created_at);
`);

// Insert a test user and campaign so FK constraints pass for dice log inserts
rawDb
  .prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)')
  .run('test-user-1', 'test@test.com', 'Test Player');
rawDb
  .prepare(
    'INSERT INTO campaigns (id, name, description, gm_user_id, invite_code) VALUES (?, ?, ?, ?, ?)',
  )
  .run('freeform', 'Freeform', 'Freeform rolls', 'test-user-1', 'freeform-code');
rawDb
  .prepare(
    'INSERT INTO campaigns (id, name, description, gm_user_id, invite_code) VALUES (?, ?, ?, ?, ?)',
  )
  .run('camp-test', 'Test Campaign', 'Test', 'test-user-1', 'camp-test-code');

rawDb.close();

const TEST_SECRET = 'test-secret-dice-routes';
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = TEST_SECRET;

const { config } = await import('../config.js');
config.databasePath = TEST_DB_PATH;

// Now safe to import — migration runner finds all tables and migrations already applied,
// and config has the correct JWT secret loaded
const { authMiddleware } = await import('../middleware/auth.js');
const { default: diceRoutes } = await import('./dice.js');

// -----------------------------------------------------------------------------
// Test Setup
// -----------------------------------------------------------------------------

function signToken(userId = 'test-user-1', displayName = 'Test Player'): string {
  return jwt.sign({ userId, displayName, email: 'test@test.com' }, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
}

function buildApp() {
  const app = Fastify({ logger: false });
  app.addHook('preHandler', authMiddleware);
  app.register(diceRoutes);
  return app;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('POST /api/dice/roll', () => {
  const app = buildApp();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = signToken();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dice/roll',
      payload: { pool: { dice: [{ count: 1, sides: 6 }], adversity: 0, modifier: 0 } },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rolls 1d6 and returns DiceRollResponse', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dice/roll',
      headers: { authorization: `Bearer ${token}` },
      payload: { pool: { dice: [{ count: 1, sides: 6 }], adversity: 0, modifier: 0 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.result.dice).toHaveLength(1);
    expect(body.result.dice[0].sides).toBe(6);
    expect(body.result.dice[0].result).toBeGreaterThanOrEqual(1);
    expect(body.result.dice[0].result).toBeLessThanOrEqual(6);
    expect(body.roller_user_id).toBe('test-user-1');
  });

  it('rolls with modifiers applied', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dice/roll',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        pool: { dice: [{ count: 3, sides: 8 }], adversity: 0, modifier: 0, source: 'stat' },
        reason: 'Cognition check',
        character_id: 'char-123',
        modifiers: { statBonuses: { cognition: 5 }, source: 'Pirate Hat' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.modifiers.statBonuses.cognition).toBe(5);
    expect(body.reason).toBe('Cognition check');
    expect(body.character_id).toBe('char-123');
    expect(body.result.modifier).toBe(5);
  });

  it('rejects invalid die sides', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dice/roll',
      headers: { authorization: `Bearer ${token}` },
      payload: { pool: { dice: [{ count: 1, sides: 7 }], adversity: 0, modifier: 0 } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing pool', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dice/roll',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/campaigns/:id/dice-log', () => {
  const app = buildApp();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = signToken();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/campaigns/camp-1/dice-log' });
    expect(res.statusCode).toBe(401);
  });

  it('returns paginated response with entries array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/camp-test/dice-log?limit=10&offset=0',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.entries)).toBe(true);
    expect(typeof body.total).toBe('number');
  });
});

// Cleanup temp DB after all tests
afterAll(() => {
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {
    /* ignore */
  }
});
