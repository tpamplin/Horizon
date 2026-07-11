// =============================================================================
// Horizon — Character Routes Tests (User-Scoped)
// =============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_SECRET = 'test-secret-hzn155-char-routes';
const TEST_DB_PATH = join(tmpdir(), `horizon-char-routes-test-${randomUUID()}.db`);
process.env.JWT_SECRET = TEST_SECRET;
process.env.DATABASE_PATH = TEST_DB_PATH;

const { config } = await import('../config.js');
config.jwtSecret = TEST_SECRET;
config.databasePath = TEST_DB_PATH;

const dbModule = await import('../models/db.js');
const db = dbModule.default;

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    avatar_url TEXT, password_hash TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    gm_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, active_background_url TEXT,
    invite_code TEXT NOT NULL UNIQUE, ruleset_version TEXT NOT NULL DEFAULT 'horizon-v1',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS campaign_players (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('gm', 'player')), PRIMARY KEY (campaign_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY, player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, archetype TEXT NOT NULL DEFAULT '', portrait_url TEXT,
    sheet_data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS campaign_characters (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    added_by TEXT NOT NULL REFERENCES users(id), added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, character_id)
  );
`);

const { default: characterRoutes } = await import('./characters.js');
const { authMiddleware } = await import('../middleware/auth.js');

let app: ReturnType<typeof buildApp>;
function buildApp() {
  const instance = Fastify({ logger: false });
  instance.addHook('preHandler', authMiddleware);
  instance.register(characterRoutes);
  return instance;
}

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
function seedCampaign(id: string, gmUserId: string, inviteCode = 'TSTCODE') {
  db.prepare(
    'INSERT INTO campaigns (id, name, description, gm_user_id, invite_code) VALUES (?, ?, ?, ?, ?)',
  ).run(id, 'Test Campaign', 'A test campaign.', gmUserId, inviteCode);
}
function seedMembership(campaignId: string, userId: string, role: 'gm' | 'player') {
  db.prepare('INSERT INTO campaign_players (campaign_id, user_id, role) VALUES (?, ?, ?)').run(
    campaignId,
    userId,
    role,
  );
}
function seedCharacter(
  id: string,
  playerUserId: string,
  name = 'Test Character',
  archetype = 'Warrior',
) {
  db.prepare(
    'INSERT INTO characters (id, player_user_id, name, archetype) VALUES (?, ?, ?, ?)',
  ).run(id, playerUserId, name, archetype);
}
function seedRoster(campaignId: string, characterId: string, addedBy: string) {
  db.prepare(
    'INSERT INTO campaign_characters (campaign_id, character_id, added_by) VALUES (?, ?, ?)',
  ).run(campaignId, characterId, addedBy);
}

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  db.close();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {}
});
beforeEach(() => {
  db.exec('DELETE FROM campaign_characters');
  db.exec('DELETE FROM characters');
  db.exec('DELETE FROM campaign_players');
  db.exec('DELETE FROM campaigns');
  db.exec('DELETE FROM refresh_tokens');
  db.exec('DELETE FROM users');
});

// =============================================================================
// Library Endpoints
// =============================================================================

describe('GET /api/characters', () => {
  it('returns user characters', async () => {
    seedUser('u1');
    seedCharacter('c1', 'u1', 'Hero');
    seedCharacter('c2', 'u1', 'Mage');
    const res = await app.inject({
      method: 'GET',
      url: '/api/characters',
      headers: { authorization: `Bearer ${signToken('u1')}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/characters' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/characters', () => {
  it('returns 201 with created character', async () => {
    seedUser('u1');
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      headers: { authorization: `Bearer ${signToken('u1')}` },
      payload: { name: 'Hero', archetype: 'Warrior' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Hero');
  });
  it('returns 400 for invalid input', async () => {
    seedUser('u1');
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      headers: { authorization: `Bearer ${signToken('u1')}` },
      payload: { name: '', archetype: '' },
    });
    expect(res.statusCode).toBe(400);
  });
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/characters',
      payload: { name: 'Hero', archetype: 'Warrior' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/characters/:id', () => {
  it('returns 200 with single character', async () => {
    seedUser('u1');
    seedCharacter('c1', 'u1', 'Hero');
    const res = await app.inject({
      method: 'GET',
      url: '/api/characters/c1',
      headers: { authorization: `Bearer ${signToken('u1')}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Hero');
  });
  it('returns 404 for nonexistent', async () => {
    seedUser('u1');
    const res = await app.inject({
      method: 'GET',
      url: '/api/characters/xyz',
      headers: { authorization: `Bearer ${signToken('u1')}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/characters/:id', () => {
  it('returns 200 with updated character', async () => {
    seedUser('u1');
    seedCharacter('c1', 'u1', 'Hero');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/characters/c1',
      headers: { authorization: `Bearer ${signToken('u1')}` },
      payload: {
        sheetData: {
          stats: { cognition: 5, force: 3, reflex: 2, conflict: 1, influence: 4, stability: 3 },
          adversityTokens: 0,
          strengths: [],
          flaws: [],
          traits: [],
          inventory: [],
          signatureItems: [],
          specialAbilities: [],
          conditions: [],
          customTracks: [],
          backstory: '',
          notes: '',
          campaignNotes: '',
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sheetData.stats.cognition).toBe(5);
  });
  it('returns 403 when non-owner updates', async () => {
    seedUser('u1');
    seedUser('u2');
    seedCharacter('c1', 'u1', 'Hero');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/characters/c1',
      headers: { authorization: `Bearer ${signToken('u2')}` },
      payload: {
        sheetData: {
          stats: { cognition: 5, force: 3, reflex: 2, conflict: 1, influence: 4, stability: 3 },
          adversityTokens: 0,
          strengths: [],
          flaws: [],
          traits: [],
          inventory: [],
          signatureItems: [],
          specialAbilities: [],
          conditions: [],
          customTracks: [],
          backstory: '',
          notes: '',
          campaignNotes: '',
        },
      },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/characters/:id', () => {
  it('returns 204 and deletes character', async () => {
    seedUser('u1');
    seedCharacter('c1', 'u1', 'Hero');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/characters/c1',
      headers: { authorization: `Bearer ${signToken('u1')}` },
    });
    expect(res.statusCode).toBe(204);
  });
  it('returns 403 when non-owner deletes', async () => {
    seedUser('u1');
    seedUser('u2');
    seedCharacter('c1', 'u1', 'Hero');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/characters/c1',
      headers: { authorization: `Bearer ${signToken('u2')}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// =============================================================================
// Campaign Roster Endpoints
// =============================================================================

describe('GET /api/campaigns/:id/characters', () => {
  it('returns campaign roster', async () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    seedCharacter('c1', 'gm', 'Hero');
    seedCharacter('c2', 'gm', 'Mage');
    seedRoster('camp1', 'c1', 'gm');
    seedRoster('camp1', 'c2', 'gm');
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/camp1/characters',
      headers: { authorization: `Bearer ${signToken('gm')}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
  it('returns 404 for non-member', async () => {
    seedUser('gm');
    seedUser('outsider');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/camp1/characters',
      headers: { authorization: `Bearer ${signToken('outsider')}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/campaigns/:id/characters', () => {
  it('returns 201 when adding character to roster', async () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    seedCharacter('c1', 'gm', 'Hero');
    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns/camp1/characters',
      headers: { authorization: `Bearer ${signToken('gm')}` },
      payload: { characterId: 'c1' },
    });
    expect(res.statusCode).toBe(201);
  });
  it('returns 404 when character does not exist', async () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    const res = await app.inject({
      method: 'POST',
      url: '/api/campaigns/camp1/characters',
      headers: { authorization: `Bearer ${signToken('gm')}` },
      payload: { characterId: 'nonexistent' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/campaigns/:id/characters/:cid', () => {
  it('returns 204 when removing from roster', async () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    seedCharacter('c1', 'gm', 'Hero');
    seedRoster('camp1', 'c1', 'gm');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/campaigns/camp1/characters/c1',
      headers: { authorization: `Bearer ${signToken('gm')}` },
    });
    expect(res.statusCode).toBe(204);
    // Verify it's removed from roster
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/campaigns/camp1/characters',
      headers: { authorization: `Bearer ${signToken('gm')}` },
    });
    expect(getRes.json()).toHaveLength(0);
  });
});
