// =============================================================================
// Horizon — Campaign Service Tests
// =============================================================================
// Vitest unit tests for campaign service functions. Uses a temporary
// file-based SQLite database for isolation.
// =============================================================================

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// -----------------------------------------------------------------------------
// Test Configuration
// -----------------------------------------------------------------------------

const TEST_DB_PATH = join(tmpdir(), `horizon-campaign-svc-test-${randomUUID()}.db`);

process.env.DATABASE_PATH = TEST_DB_PATH;

// Dynamic imports so config picks up env vars
const { config } = await import('../config.js');
config.databasePath = TEST_DB_PATH;

const dbModule = await import('../models/db.js');
const db = dbModule.default;

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    avatar_url    TEXT,
    password_hash TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
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
    player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    archetype      TEXT NOT NULL DEFAULT '',
    portrait_url   TEXT,
    sheet_data     TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS campaign_characters (
    campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    added_by     TEXT NOT NULL REFERENCES users(id),
    added_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, character_id)
  );
`);

const {
  createCampaign,
  listUserCampaigns,
  getCampaignDetail,
  CampaignNotFoundError,
  CampaignValidationError,
} = await import('./campaign.js');

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

afterAll(() => {
  db.close();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {
    /* ignore */
  }
});

beforeEach(() => {
  db.exec('DELETE FROM campaign_characters');
  db.exec('DELETE FROM characters');
  db.exec('DELETE FROM campaign_players');
  db.exec('DELETE FROM campaigns');
  db.exec('DELETE FROM users');
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function seedUser(id = 'user-1', displayName = 'Test User') {
  db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)').run(
    id,
    `${id}@test.com`,
    displayName,
  );
}

function seedCampaign(
  id: string,
  gmUserId: string,
  name = 'Test Campaign',
  inviteCode = 'TESTCODE',
) {
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

function seedCharacter(id: string, playerUserId: string, name: string, archetype: string) {
  db.prepare(
    'INSERT INTO characters (id, player_user_id, name, archetype) VALUES (?, ?, ?, ?)',
  ).run(id, playerUserId, name, archetype);
}

function seedRoster(campaignId: string, characterId: string, addedBy: string) {
  db.prepare(
    'INSERT INTO campaign_characters (campaign_id, character_id, added_by) VALUES (?, ?, ?)',
  ).run(campaignId, characterId, addedBy);
}

// =============================================================================
// createCampaign
// =============================================================================

describe('createCampaign', () => {
  it('creates a campaign and assigns the creator as GM', () => {
    seedUser('gm-user');

    const result = createCampaign('gm-user', {
      name: 'My Campaign',
      description: 'A grand adventure.',
    });

    expect(result.id).toBeTruthy();
    expect(result.name).toBe('My Campaign');
    expect(result.description).toBe('A grand adventure.');
    expect(result.gmUserId).toBe('gm-user');
    expect(result.inviteCode).toBeTruthy();
    expect(result.inviteCode).toHaveLength(8);
    expect(result.rulesetVersion).toBe('horizon-v1');

    // Verify GM membership was created
    const membership = db
      .prepare('SELECT role FROM campaign_players WHERE campaign_id = ? AND user_id = ?')
      .get(result.id, 'gm-user') as { role: string } | undefined;
    expect(membership).toBeTruthy();
    expect(membership!.role).toBe('gm');
  });

  it('trims whitespace from name and description', () => {
    seedUser('gm-user');

    const result = createCampaign('gm-user', {
      name: '  Trimmed Name  ',
      description: '  Trimmed Desc  ',
    });

    expect(result.name).toBe('Trimmed Name');
    expect(result.description).toBe('Trimmed Desc');
  });

  it('throws CampaignValidationError when name is empty', () => {
    seedUser('gm-user');

    expect(() => createCampaign('gm-user', { name: '   ' })).toThrow(CampaignValidationError);
  });

  it('throws CampaignValidationError when name is shorter than 2 characters', () => {
    seedUser('gm-user');

    expect(() => createCampaign('gm-user', { name: 'A' })).toThrow(CampaignValidationError);
  });

  it('generates a unique invite code', () => {
    seedUser('gm-user');

    const c1 = createCampaign('gm-user', { name: 'Campaign 1' });
    const c2 = createCampaign('gm-user', { name: 'Campaign 2' });

    expect(c1.inviteCode).not.toBe(c2.inviteCode);
  });
});

// =============================================================================
// listUserCampaigns
// =============================================================================

describe('listUserCampaigns', () => {
  it('returns only campaigns the user belongs to', () => {
    seedUser('alice', 'Alice');
    seedUser('bob', 'Bob');
    seedCampaign('camp-1', 'alice', "Alice's Campaign", 'CODE1');
    seedCampaign('camp-2', 'bob', "Bob's Campaign", 'CODE2');
    seedMembership('camp-1', 'alice', 'gm');
    seedMembership('camp-1', 'bob', 'player');
    seedMembership('camp-2', 'bob', 'gm');

    const aliceCampaigns = listUserCampaigns('alice');
    const bobCampaigns = listUserCampaigns('bob');

    expect(aliceCampaigns).toHaveLength(1);
    expect(aliceCampaigns[0]!.id).toBe('camp-1');

    expect(bobCampaigns).toHaveLength(2);
    const bobIds = bobCampaigns.map((c) => c.id);
    expect(bobIds).toContain('camp-1');
    expect(bobIds).toContain('camp-2');
  });

  it('returns empty array when user has no campaigns', () => {
    seedUser('lonely', 'Lonely User');

    const result = listUserCampaigns('lonely');

    expect(result).toEqual([]);
  });

  it('returns campaigns ordered by most recently created first', () => {
    seedUser('gm', 'GM');

    // Create campaigns with explicit created_at to control ordering
    db.prepare(
      `INSERT INTO campaigns (id, name, description, gm_user_id, invite_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('old-camp', 'Old Campaign', '', 'gm', 'OLDCODE', '2025-01-01T00:00:00Z');
    db.prepare(
      `INSERT INTO campaigns (id, name, description, gm_user_id, invite_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('new-camp', 'New Campaign', '', 'gm', 'NEWCODE', '2026-01-01T00:00:00Z');
    seedMembership('old-camp', 'gm', 'gm');
    seedMembership('new-camp', 'gm', 'gm');

    const result = listUserCampaigns('gm');

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('new-camp');
    expect(result[1]!.id).toBe('old-camp');
  });

  it('includes player count in results', () => {
    seedUser('gm', 'GM');
    seedUser('p1', 'Player 1');
    seedUser('p2', 'Player 2');
    seedCampaign('camp', 'gm', 'Multiplayer', 'MPCODE');
    seedMembership('camp', 'gm', 'gm');
    seedMembership('camp', 'p1', 'player');
    seedMembership('camp', 'p2', 'player');

    const result = listUserCampaigns('gm');

    expect(result[0]!.playerCount).toBe(3); // GM + 2 players
  });
});

// =============================================================================
// getCampaignDetail
// =============================================================================

describe('getCampaignDetail', () => {
  it('returns campaign with players and characters', () => {
    seedUser('gm', 'GM');
    seedUser('player', 'Player');
    seedCampaign('camp', 'gm', 'Detailed Campaign', 'DETCODE');
    seedMembership('camp', 'gm', 'gm');
    seedMembership('camp', 'player', 'player');
    seedCharacter('char-1', 'player', 'Hero', 'Warrior');
    seedCharacter('char-2', 'player', 'Sidekick', 'Rogue');
    seedRoster('camp', 'char-1', 'player');
    seedRoster('camp', 'char-2', 'player');

    const detail = getCampaignDetail('camp');

    expect(detail.id).toBe('camp');
    expect(detail.name).toBe('Detailed Campaign');
    expect(detail.gmUserId).toBe('gm');
    expect(detail.players).toHaveLength(2);
    expect(detail.players.map((p) => p.displayName).sort()).toEqual(['GM', 'Player']);
    expect(detail.characters).toHaveLength(2);
    expect(detail.characters.map((c) => c.name).sort()).toEqual(['Hero', 'Sidekick']);
  });

  it('throws CampaignNotFoundError when campaign does not exist', () => {
    expect(() => getCampaignDetail('nonexistent')).toThrow(CampaignNotFoundError);
  });

  it('returns empty players and characters for a campaign with none', () => {
    seedUser('gm', 'GM');
    seedCampaign('empty-camp', 'gm', 'Empty', 'EMPTYCD');
    seedMembership('empty-camp', 'gm', 'gm');

    const detail = getCampaignDetail('empty-camp');

    expect(detail.players).toHaveLength(1); // GM always present
    expect(detail.characters).toEqual([]);
  });
});
