// =============================================================================
// Horizon — Dice Model & Service Tests
// =============================================================================
// Tests for dice_logs model queries and the server-side dice roll service.
// Creates the SQLite schema directly before importing the db module so the
// migration runner finds all tables pre-existing (CREATE IF NOT EXISTS).
// =============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

// -----------------------------------------------------------------------------
// Test Configuration — create schema BEFORE importing db.ts
// -----------------------------------------------------------------------------

const TEST_DB_PATH = join(tmpdir(), `horizon-dice-test-${randomUUID()}.db`);

// Create database and schema directly so the migration runner finds
// all tables already exist when db.ts is imported.
const rawDb = new Database(TEST_DB_PATH);
rawDb.pragma('journal_mode = WAL');
rawDb.pragma('foreign_keys = ON');

rawDb.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);
  INSERT OR IGNORE INTO _migrations (name) VALUES
    ('001_initial.sql'),
    ('002_add_password_hash.sql'),
    ('003_user_scoped_characters.sql'),
    ('004_signature_item_templates.sql'),
    ('005_ability_templates.sql'),
    ('006_dice_logs.sql');

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
  CREATE TABLE IF NOT EXISTS npcs (
    id             TEXT PRIMARY KEY,
    player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    archetype      TEXT NOT NULL DEFAULT '',
    portrait_url   TEXT,
    template_id    TEXT,
    sheet_data     TEXT NOT NULL DEFAULT '{}',
    is_generated   INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS campaign_npcs (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    npc_id      TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    added_by    TEXT NOT NULL REFERENCES users(id),
    added_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, npc_id)
  );
  CREATE TABLE IF NOT EXISTS signature_item_templates (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    modifiers     TEXT,
    rules         TEXT,
    category      TEXT,
    item_type     TEXT,
    weapon_type   TEXT,
    weapon_stat   TEXT,
    attack_bonus  INTEGER,
    damage_bonus  INTEGER,
    structured_modifiers TEXT,
    created_by    TEXT NOT NULL REFERENCES users(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ability_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    effect      TEXT NOT NULL DEFAULT '',
    category    TEXT,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS dice_logs (
    id              TEXT PRIMARY KEY,
    campaign_id     TEXT NOT NULL REFERENCES campaigns(id),
    character_id    TEXT,
    roller_user_id  TEXT NOT NULL REFERENCES users(id),
    pool_json       TEXT NOT NULL,
    modifiers_json  TEXT,
    roll_source     TEXT NOT NULL DEFAULT 'custom',
    result_json     TEXT NOT NULL,
    reason          TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_dl_campaign ON dice_logs(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_dl_created ON dice_logs(campaign_id, created_at);
`);

rawDb.close();

// Set env before importing db.ts — migration runner will see all tables exist
process.env.DATABASE_PATH = TEST_DB_PATH;

const { config } = await import('../config.js');
config.databasePath = TEST_DB_PATH;

const dbModule = await import('../models/db.js');
const db = dbModule.default;

const { insertDiceLog, getDiceLog } = await import('../models/dice.js');
const { roll } = await import('../services/dice.js');

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

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

afterAll(() => {
  try {
    db.close();
    unlinkSync(TEST_DB_PATH);
  } catch {
    /* ignore */
  }
});

// -----------------------------------------------------------------------------
// Model Tests
// -----------------------------------------------------------------------------

describe('dice model', () => {
  it('insertDiceLog stores and getDiceLog retrieves', () => {
    const userId = randomUUID();
    const campaignId = randomUUID();
    const logId = randomUUID();

    seedUser(userId, 'Roller');
    seedCampaign(campaignId, userId);

    insertDiceLog({
      id: logId,
      campaignId,
      characterId: null,
      rollerUserId: userId,
      poolJson: JSON.stringify({ dice: [{ count: 1, sides: 10 }], adversity: 0, modifier: 0 }),
      modifiersJson: JSON.stringify({ statBonuses: { cognition: 5 }, source: 'Pirate Hat' }),
      rollSource: 'stat',
      resultJson: JSON.stringify({
        dice: [{ sides: 10, result: 7 }],
        adversityResults: [],
        modifier: 5,
        total: 12,
      }),
      reason: 'Cognition check',
    });

    const { entries, total } = getDiceLog(campaignId);
    expect(total).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe(logId);
    expect(entries[0]!.roll_source).toBe('stat');
    expect(entries[0]!.roller_display_name).toBe('Roller');
  });

  it('getDiceLog respects pagination', () => {
    const userId = randomUUID();
    const campaignId = randomUUID();
    seedUser(userId, 'Pager');
    seedCampaign(campaignId, userId);

    for (let i = 0; i < 5; i++) {
      insertDiceLog({
        id: randomUUID(),
        campaignId,
        characterId: null,
        rollerUserId: userId,
        poolJson: '{}',
        modifiersJson: null,
        rollSource: 'custom',
        resultJson: '{}',
        reason: `Roll ${i}`,
      });
    }

    const { entries, total } = getDiceLog(campaignId, { limit: 2, offset: 1 });
    expect(total).toBe(5);
    expect(entries).toHaveLength(2);
  });

  it('returns newest first', () => {
    const userId = randomUUID();
    const campaignId = randomUUID();
    seedUser(userId, 'Sorter');
    seedCampaign(campaignId, userId);

    const id1 = randomUUID();
    const id2 = randomUUID();

    insertDiceLog({
      id: id1,
      campaignId,
      characterId: null,
      rollerUserId: userId,
      poolJson: '{}',
      modifiersJson: null,
      rollSource: 'custom',
      resultJson: '{}',
      reason: 'First',
    });
    insertDiceLog({
      id: id2,
      campaignId,
      characterId: null,
      rollerUserId: userId,
      poolJson: '{}',
      modifiersJson: null,
      rollSource: 'custom',
      resultJson: '{}',
      reason: 'Second',
    });

    const { entries } = getDiceLog(campaignId);
    expect(entries[0]!.id).toBe(id2);
  });

  it('returns empty for no rolls', () => {
    const { entries, total } = getDiceLog(randomUUID());
    expect(total).toBe(0);
    expect(entries).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// Service Tests
// -----------------------------------------------------------------------------

describe('dice service', () => {
  it('roll produces valid RollResult', () => {
    const pool = { dice: [{ count: 1, sides: 10 }], adversity: 0, modifier: 0 };
    const result = roll(pool);
    expect(result.dice).toHaveLength(1);
    expect(result.dice[0]!.sides).toBe(10);
    expect(result.dice[0]!.result).toBeGreaterThanOrEqual(1);
    expect(result.dice[0]!.result).toBeLessThanOrEqual(10);
  });

  it('roll applies ModifierSet', () => {
    const pool = { dice: [{ count: 1, sides: 10 }], adversity: 0, modifier: 0 };
    const mods = { statBonuses: { cognition: 5 }, source: 'Pirate Hat' };
    const result = roll(pool, mods);
    expect(result.modifier).toBe(5);
  });

  it('roll handles no modifiers', () => {
    const pool = { dice: [{ count: 3, sides: 6 }], adversity: 0, modifier: 0 };
    const result = roll(pool);
    expect(result.dice).toHaveLength(3);
    expect(result.modifier).toBe(0);
  });

  it('roll with adversity dice', () => {
    const pool = { dice: [{ count: 2, sides: 6 }], adversity: 2, modifier: 0 };
    const result = roll(pool);
    expect(result.dice).toHaveLength(2);
    expect(result.adversityResults).toHaveLength(2);
  });

  it('roll sums pool modifier and ModifierSet', () => {
    const pool = { dice: [{ count: 1, sides: 6 }], adversity: 0, modifier: 3 };
    const mods = { flatBonus: 2 };
    const result = roll(pool, mods);
    expect(result.modifier).toBe(5);
  });
});
