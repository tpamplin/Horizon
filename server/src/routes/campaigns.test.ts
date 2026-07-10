// =============================================================================
// Horizon — Campaign Routes Tests
// =============================================================================
// Vitest integration tests for /api/campaigns/* endpoints using Fastify inject().
// Uses a temporary file-based SQLite database so tests are isolated.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// -----------------------------------------------------------------------------
// Test Configuration — set BEFORE any module imports
// -----------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-hzn72-campaign-routes';
const TEST_DB_PATH = join(tmpdir(), `horizon-campaign-routes-test-${randomUUID()}.db`);

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
  CREATE TABLE IF NOT EXISTS campaigns (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    gm_user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_background_url TEXT,
    invite_code           TEXT NOT NULL UNIQUE,
    ruleset_version       TEXT NOT NULL DEFAULT 'horizon-v1',
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS campaign_players (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('gm', 'player')),
    PRIMARY KEY (campaign_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS characters (
    id             TEXT PRIMARY KEY,
    campaign_id    TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    archetype      TEXT NOT NULL DEFAULT '',
    portrait_url   TEXT,
    sheet_data     TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const { default: campaignRoutes } = await import('./campaigns.js');
const { authMiddleware } = await import('../middleware/auth.js');

// -----------------------------------------------------------------------------
// App Setup
// -----------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

function buildApp() {
  const instance = Fastify({ logger: false });
  instance.addHook('preHandler', authMiddleware);
  instance.register(campaignRoutes);
  return instance;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function signToken(userId: string, displayName = 'Test User', email = 'test@test.com'): string {
  return jwt.sign({ userId, displayName, email }, TEST_SECRET, { expiresIn: '15m' });
}

function seedUser(id: string, displayName = 'Test User') {
  db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)').run(
    id,
    `${id}@test.com`,
    displayName,
  );
}

function seedCampaign(id: string, gmUserId: string, name = 'Test Campaign', inviteCode = 'TSTCD') {
  db.prepare(
    `INSERT INTO campaigns (id, name, description, gm_user_id, invite_code)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, name, 'A test campaign.', gmUserId, inviteCode);
}

function seedMembership(campaignId: string, userId: string, role: 'gm' | 'player') {
  db.prepare('INSERT INTO campaign_players (campaign_id, user_id, role) VALUES (?, ?, ?)').run(
    campaignId,
    userId,
    role,
  );
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
  db.close();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {
    /* ignore */
  }
});

beforeEach(() => {
  db.exec('DELETE FROM characters');
  db.exec('DELETE FROM campaign_players');
  db.exec('DELETE FROM campaigns');
  db.exec('DELETE FROM refresh_tokens');
  db.exec('DELETE FROM users');
});

// =============================================================================
// POST /api/campaigns
// =============================================================================

describe('POST /api/campaigns', () => {
  it('returns 201 with the created campaign for authenticated user', async () => {
    seedUser('gm-user', 'GM');
    const token = signToken('gm-user', 'GM');

    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Campaign', description: 'An epic tale.' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{
      id: string;
      name: string;
      description: string;
      gmUserId: string;
      inviteCode: string;
    }>();
    expect(body.name).toBe('New Campaign');
    expect(body.description).toBe('An epic tale.');
    expect(body.gmUserId).toBe('gm-user');
    expect(body.inviteCode).toHaveLength(8);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      payload: { name: 'Unauthorized' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when name is empty', async () => {
    seedUser('gm-user', 'GM');
    const token = signToken('gm-user', 'GM');

    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// =============================================================================
// GET /api/campaigns
// =============================================================================

describe('GET /api/campaigns', () => {
  it('returns 200 with user campaigns for authenticated user', async () => {
    seedUser('alice', 'Alice');
    seedUser('bob', 'Bob');
    seedCampaign('camp-1', 'alice', "Alice's Campaign", 'CODE1');
    seedCampaign('camp-2', 'bob', "Bob's Campaign", 'CODE2');
    seedMembership('camp-1', 'alice', 'gm');
    seedMembership('camp-1', 'bob', 'player');
    seedMembership('camp-2', 'bob', 'gm');

    const token = signToken('alice', 'Alice');

    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; name: string; playerCount: number }[]>();
    expect(body).toHaveLength(1);
    expect(body[0]!.name).toBe("Alice's Campaign");
    expect(body[0]!.playerCount).toBe(2); // Alice (GM) + Bob (player)
  });

  it('returns 200 with empty array when user has no campaigns', async () => {
    seedUser('lonely', 'Lonely');
    const token = signToken('lonely', 'Lonely');

    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns',
    });

    expect(res.statusCode).toBe(401);
  });
});

// =============================================================================
// GET /api/campaigns/:id
// =============================================================================

describe('GET /api/campaigns/:id', () => {
  it('returns 200 with campaign detail for a member', async () => {
    seedUser('gm', 'GM');
    seedUser('player', 'Player One');
    seedCampaign('camp', 'gm', 'Campaign Detail', 'DETCD');
    seedMembership('camp', 'gm', 'gm');
    seedMembership('camp', 'player', 'player');

    const token = signToken('gm', 'GM');

    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/camp',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      id: string;
      name: string;
      players: { displayName: string; role: string }[];
      characters: { name: string }[];
    }>();
    expect(body.name).toBe('Campaign Detail');
    expect(body.players).toHaveLength(2);
    expect(body.characters).toEqual([]);
  });

  it('returns 404 when the user is not a member', async () => {
    seedUser('gm', 'GM');
    seedUser('outsider', 'Outsider');
    seedCampaign('camp', 'gm', 'Private Campaign', 'PRIVCD');
    seedMembership('camp', 'gm', 'gm');

    const token = signToken('outsider', 'Outsider');

    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/camp',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when the campaign does not exist', async () => {
    seedUser('gm', 'GM');
    const token = signToken('gm', 'GM');

    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/nonexistent',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/some-camp',
    });

    expect(res.statusCode).toBe(401);
  });
});
