// =============================================================================
// Horizon — NPC Service Tests
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_DB_PATH = join(tmpdir(), `horizon-npc-svc-test-${randomUUID()}.db`);
process.env.DATABASE_PATH = TEST_DB_PATH;

const { config } = await import('../config.js');
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

const {
  createNPC,
  getNPC,
  listUserNPCs,
  updateNPC,
  deleteNPC,
  addNPCToCampaign,
  removeNPCFromCampaign,
  listCampaignNPCs,
  NPCNotFoundError,
  NPCValidationError,
  DEFAULT_SHEET_DATA,
} = await import('./npc.js');

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

afterAll(() => {
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

describe('createNPC', () => {
  it('creates NPC in library', () => {
    seedUser('u1');
    const n = createNPC('u1', { name: 'Bandit', archetype: 'Thug' });
    expect(n.name).toBe('Bandit');
    expect(n.playerUserId).toBe('u1');
  });
  it('throws on empty name', () => {
    seedUser('u1');
    expect(() => createNPC('u1', { name: '', archetype: 'X' })).toThrow(NPCValidationError);
  });
});

describe('listUserNPCs', () => {
  it('returns user NPCs', () => {
    seedUser('u1');
    createNPC('u1', { name: 'Alpha', archetype: 'X' });
    createNPC('u1', { name: 'Bravo', archetype: 'Y' });
    expect(listUserNPCs('u1')).toHaveLength(2);
  });
});

describe('addNPCToCampaign', () => {
  it('adds NPC to campaign roster', () => {
    seedUser('gm');
    seedUser('u1');
    seedCampaign('c1', 'gm');
    seedMembership('c1', 'gm', 'gm');
    seedMembership('c1', 'u1', 'player');
    const n = createNPC('u1', { name: 'Bandit', archetype: 'Thug' });
    addNPCToCampaign('u1', 'c1', { npcId: n.id });
    expect(listCampaignNPCs('c1')).toHaveLength(1);
  });
  it('removes from roster only', () => {
    seedUser('gm');
    seedUser('u1');
    seedCampaign('c1', 'gm');
    seedMembership('c1', 'gm', 'gm');
    seedMembership('c1', 'u1', 'player');
    const n = createNPC('u1', { name: 'Bandit', archetype: 'Thug' });
    addNPCToCampaign('u1', 'c1', { npcId: n.id });
    removeNPCFromCampaign('u1', 'c1', n.id);
    expect(listCampaignNPCs('c1')).toHaveLength(0);
    expect(getNPC(n.id).name).toBe('Bandit');
  });
});

describe('deleteNPC', () => {
  it('deletes from library', () => {
    seedUser('u1');
    const n = createNPC('u1', { name: 'Bandit', archetype: 'Thug' });
    deleteNPC('u1', n.id);
    expect(() => getNPC(n.id)).toThrow(NPCNotFoundError);
  });
});
