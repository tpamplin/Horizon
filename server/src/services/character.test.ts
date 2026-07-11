// =============================================================================
// Horizon — Character Service Tests
// =============================================================================
// Vitest unit tests for character service functions. Uses a temporary
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

const TEST_DB_PATH = join(tmpdir(), `horizon-character-svc-test-${randomUUID()}.db`);

process.env.DATABASE_PATH = TEST_DB_PATH;

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
  createCharacter,
  getCharacter,
  listUserCharacters,
  updateSheet,
  deleteCharacter,
  CharacterNotFoundError,
  CharacterValidationError,
  CharacterAuthorizationError,
  DEFAULT_SHEET_DATA,
} = await import('./character.js');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function seedUser(id: string, displayName = 'Test User') {
  db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)').run(
    id,
    `${id}@test.com`,
    displayName,
  );
}

function seedCampaign(id: string, gmUserId: string) {
  db.prepare(
    `INSERT INTO campaigns (id, name, description, gm_user_id, invite_code)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, 'Test Campaign', 'A test campaign.', gmUserId, `${id}-code`);
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

// =============================================================================
// createCharacter
// =============================================================================

describe('createCharacter', () => {
  it('returns a Character with correct fields', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');

    const result = createCharacter('u1', { name: 'Hero', archetype: 'Warrior' });

    expect(result.id).toBeTruthy();
    expect(result.name).toBe('Hero');
    expect(result.archetype).toBe('Warrior');
    expect(result.playerUserId).toBe('u1');
    expect(result.playerUserId).toBe('u1');
    expect(result.portraitUrl).toBeNull();
    expect(result.sheetData).toEqual(DEFAULT_SHEET_DATA);
  });

  it('merges optional sheetData with defaults', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');

    const result = createCharacter('u1', {
      name: 'Mage',
      archetype: 'Wizard',
      sheetData: {
        stats: { cognition: 5, force: 1, reflex: 2, conflict: 1, influence: 4, stability: 3 },
      },
    });

    expect(result.sheetData.stats.cognition).toBe(5);
    expect(result.sheetData.stats.force).toBe(1);
    // Defaults filled in for untouched fields
    expect(result.sheetData.adversityTokens).toBe(0);
    expect(result.sheetData.inventory).toEqual([]);
  });

  it('throws CharacterValidationError when name is empty', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');

    expect(() => createCharacter('u1', { name: '', archetype: 'Warrior' })).toThrow(
      CharacterValidationError,
    );
  });

  it('throws CharacterValidationError when name is too short', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');

    expect(() => createCharacter('u1', { name: 'A', archetype: 'Warrior' })).toThrow(
      CharacterValidationError,
    );
  });

  it('throws CharacterValidationError when archetype is empty', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');

    expect(() => createCharacter('u1', { name: 'Hero', archetype: '' })).toThrow(
      CharacterValidationError,
    );
  });
});

// =============================================================================
// getCharacter
// =============================================================================

describe('getCharacter', () => {
  it('returns a Character for an existing ID', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');
    const created = createCharacter('u1', { name: 'Hero', archetype: 'Warrior' });

    const result = getCharacter(created.id);
    expect(result.name).toBe('Hero');
    expect(result.id).toBe(created.id);
  });

  it('throws CharacterNotFoundError for nonexistent ID', () => {
    expect(() => getCharacter('nonexistent')).toThrow(CharacterNotFoundError);
  });
});

// =============================================================================
// listUserCharacters
// =============================================================================

describe('listUserCharacters', () => {
  it('returns all characters in a campaign', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');
    seedMembership('camp1', 'u1', 'gm');
    createCharacter('u1', { name: 'Hero', archetype: 'Warrior' });
    createCharacter('u1', { name: 'Mage', archetype: 'Wizard' });

    const chars = listUserCharacters('u1');
    expect(chars).toHaveLength(2);
    expect(chars.map((c) => c.name).sort()).toEqual(['Hero', 'Mage']);
  });

  it('returns empty array for campaign with no characters', () => {
    seedUser('u1');
    seedCampaign('camp1', 'u1');

    const chars = listUserCharacters('u1');
    expect(chars).toEqual([]);
  });
});

// =============================================================================
// updateSheet
// =============================================================================

describe('updateSheet', () => {
  it('updates sheet data as GM', () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    const created = createCharacter('gm', { name: 'Hero', archetype: 'Warrior' });

    const updated = updateSheet('gm', created.id, {
      sheetData: { ...DEFAULT_SHEET_DATA, stats: { ...DEFAULT_SHEET_DATA.stats, cognition: 5 } },
    });

    expect(updated.sheetData.stats.cognition).toBe(5);
  });

  it('allows character owner (non-GM) to update own sheet', () => {
    seedUser('gm');
    seedUser('player');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    seedMembership('camp1', 'player', 'player');
    const created = createCharacter('player', { name: 'Hero', archetype: 'Warrior' });

    const updated = updateSheet('player', created.id, {
      sheetData: { ...DEFAULT_SHEET_DATA, stats: { ...DEFAULT_SHEET_DATA.stats, cognition: 3 } },
    });

    expect(updated.sheetData.stats.cognition).toBe(3);
  });

  it('throws CharacterAuthorizationError when non-GM non-owner tries to update', () => {
    seedUser('gm');
    seedUser('player1');
    seedUser('player2');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    seedMembership('camp1', 'player1', 'player');
    seedMembership('camp1', 'player2', 'player');
    const created = createCharacter('player1', { name: 'Hero', archetype: 'Warrior' });

    expect(() => updateSheet('player2', created.id, { sheetData: DEFAULT_SHEET_DATA })).toThrow(
      CharacterAuthorizationError,
    );
  });

  it('throws CharacterNotFoundError for nonexistent character', () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');

    expect(() => updateSheet('gm', 'nonexistent', { sheetData: DEFAULT_SHEET_DATA })).toThrow(
      CharacterNotFoundError,
    );
  });
});

// =============================================================================
// deleteCharacter
// =============================================================================

describe('deleteCharacter', () => {
  it('deletes character as GM', () => {
    seedUser('gm');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    const created = createCharacter('gm', { name: 'Hero', archetype: 'Warrior' });

    deleteCharacter('gm', created.id);

    expect(() => getCharacter(created.id)).toThrow(CharacterNotFoundError);
  });

  it('throws CharacterAuthorizationError when non-GM tries to delete', () => {
    seedUser('gm');
    seedUser('player');
    seedCampaign('camp1', 'gm');
    seedMembership('camp1', 'gm', 'gm');
    seedMembership('camp1', 'player', 'player');
    const created = createCharacter('gm', { name: 'Hero', archetype: 'Warrior' });

    expect(() => deleteCharacter('player', created.id)).toThrow(CharacterAuthorizationError);
  });
});
