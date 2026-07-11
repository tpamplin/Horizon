// =============================================================================
// Horizon — NPC Routes Tests
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_SECRET = 'test-npc-routes';
const TEST_DB_PATH = join(tmpdir(), `horizon-npc-routes-${randomUUID()}.db`);
process.env.JWT_SECRET = TEST_SECRET;
process.env.DATABASE_PATH = TEST_DB_PATH;

const { config } = await import('../config.js');
config.jwtSecret = TEST_SECRET;
config.databasePath = TEST_DB_PATH;
const dbModule = await import('../models/db.js');
const db = dbModule.default;

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, avatar_url TEXT, password_hash TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', gm_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, active_background_url TEXT, invite_code TEXT NOT NULL UNIQUE, ruleset_version TEXT NOT NULL DEFAULT 'horizon-v1', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS campaign_players (campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('gm','player')), PRIMARY KEY (campaign_id, user_id));
  CREATE TABLE IF NOT EXISTS npcs (id TEXT PRIMARY KEY, player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, archetype TEXT NOT NULL DEFAULT '', portrait_url TEXT, template_id TEXT, sheet_data TEXT NOT NULL DEFAULT '{}', is_generated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS campaign_npcs (campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE, added_by TEXT NOT NULL REFERENCES users(id), added_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (campaign_id, npc_id));
`);

const { default: npcRoutes } = await import('./npcs.js');
const { authMiddleware } = await import('../middleware/auth.js');

let app: ReturnType<typeof buildApp>;
function buildApp() {
  const i = Fastify({ logger: false });
  i.addHook('preHandler', authMiddleware);
  i.register(npcRoutes);
  return i;
}

function signToken(uid: string) {
  return jwt.sign({ userId: uid, displayName: 'T', email: 't@t.com' }, TEST_SECRET, {
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
function seedCampaign(id: string, gm: string) {
  db.prepare(
    'INSERT INTO campaigns (id, name, description, gm_user_id, invite_code) VALUES (?,?,?,?,?)',
  ).run(id, 'Test', '', gm, `${id}-c`);
}
function seedMembership(cid: string, uid: string, role: string) {
  db.prepare('INSERT INTO campaign_players (campaign_id, user_id, role) VALUES (?,?,?)').run(
    cid,
    uid,
    role,
  );
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
  db.exec(
    'DELETE FROM campaign_npcs; DELETE FROM npcs; DELETE FROM campaign_players; DELETE FROM campaigns; DELETE FROM users;',
  );
});

describe('POST /api/npcs', () => {
  it('returns 201', async () => {
    seedUser('u1');
    const t = signToken('u1');
    const r = await app.inject({
      method: 'POST',
      url: '/api/npcs',
      headers: { authorization: `Bearer ${t}` },
      payload: { name: 'Bandit', archetype: 'Thug' },
    });
    expect(r.statusCode).toBe(201);
  });
  it('returns 401 unauth', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/npcs',
      payload: { name: 'Bandit', archetype: 'Thug' },
    });
    expect(r.statusCode).toBe(401);
  });
});

describe('GET /api/npcs', () => {
  it('returns library', async () => {
    seedUser('u1');
    const t = signToken('u1');
    await app.inject({
      method: 'POST',
      url: '/api/npcs',
      headers: { authorization: `Bearer ${t}` },
      payload: { name: 'Alpha', archetype: 'X' },
    });
    const r = await app.inject({
      method: 'GET',
      url: '/api/npcs',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toHaveLength(1);
  });
});

describe('POST /api/campaigns/:id/npcs', () => {
  it('adds to roster', async () => {
    seedUser('gm');
    seedCampaign('c1', 'gm');
    seedMembership('c1', 'gm', 'gm');
    const t = signToken('gm');
    const cr = await app.inject({
      method: 'POST',
      url: '/api/npcs',
      headers: { authorization: `Bearer ${t}` },
      payload: { name: 'Bandit', archetype: 'Thug' },
    });
    const nid = cr.json().id;
    const rr = await app.inject({
      method: 'POST',
      url: '/api/campaigns/c1/npcs',
      headers: { authorization: `Bearer ${t}` },
      payload: { npcId: nid },
    });
    expect(rr.statusCode).toBe(201);
  });
});

describe('DELETE /api/campaigns/:id/npcs/:nid', () => {
  it('removes from roster only', async () => {
    seedUser('gm');
    seedCampaign('c1', 'gm');
    seedMembership('c1', 'gm', 'gm');
    const t = signToken('gm');
    const cr = await app.inject({
      method: 'POST',
      url: '/api/npcs',
      headers: { authorization: `Bearer ${t}` },
      payload: { name: 'Bandit', archetype: 'Thug' },
    });
    const nid = cr.json().id;
    await app.inject({
      method: 'POST',
      url: '/api/campaigns/c1/npcs',
      headers: { authorization: `Bearer ${t}` },
      payload: { npcId: nid },
    });
    const dr = await app.inject({
      method: 'DELETE',
      url: `/api/campaigns/c1/npcs/${nid}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(dr.statusCode).toBe(204);
    const gr = await app.inject({
      method: 'GET',
      url: `/api/npcs/${nid}`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(gr.statusCode).toBe(200);
  });
});
