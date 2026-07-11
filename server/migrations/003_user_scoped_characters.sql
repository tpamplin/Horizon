-- =============================================================================
-- Horizon — Migration 003: User-Scoped Characters
-- =============================================================================
-- Refactors characters to be user-scoped instead of campaign-scoped.
-- Characters now belong to the user's library and are added to campaigns
-- via a join table. Same character can be in multiple campaigns.
--
-- SQLite does not support ALTER TABLE DROP COLUMN, so we recreate the
-- characters table. Existing data is preserved via the join table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: Create campaign_characters join table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaign_characters (
    campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    added_by     TEXT NOT NULL REFERENCES users(id),
    added_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_campaign ON campaign_characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cc_character ON campaign_characters(character_id);

-- ---------------------------------------------------------------------------
-- Step 2: Migrate existing character-campaign relationships
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO campaign_characters (campaign_id, character_id, added_by)
SELECT campaign_id, id, player_user_id
FROM characters
WHERE campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3: Recreate characters table without campaign_id
-- ---------------------------------------------------------------------------

-- Create new table
CREATE TABLE characters_new (
    id             TEXT PRIMARY KEY,
    player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    archetype      TEXT NOT NULL DEFAULT '',
    portrait_url   TEXT,
    sheet_data     TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data (without campaign_id)
INSERT INTO characters_new (id, player_user_id, name, archetype, portrait_url, sheet_data, created_at)
SELECT id, player_user_id, name, archetype, portrait_url, sheet_data, created_at
FROM characters;

-- Drop old table and rename new one
DROP TABLE characters;
ALTER TABLE characters_new RENAME TO characters;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_characters_player ON characters(player_user_id);

-- ===========================================================================
-- NPCs — same user-scoped refactor
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Step 4: Create campaign_npcs join table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaign_npcs (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    npc_id      TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
    added_by    TEXT NOT NULL REFERENCES users(id),
    added_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, npc_id)
);

CREATE INDEX IF NOT EXISTS idx_cn_campaign ON campaign_npcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cn_npc ON campaign_npcs(npc_id);

-- ---------------------------------------------------------------------------
-- Step 5: Migrate existing NPC-campaign relationships
-- ---------------------------------------------------------------------------

INSERT OR IGNORE INTO campaign_npcs (campaign_id, npc_id, added_by)
SELECT campaign_id, id, campaign_id -- campaign_id as a proxy for the GM
FROM npcs
WHERE campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 6: Recreate npcs table without campaign_id, add player_user_id
-- ---------------------------------------------------------------------------

CREATE TABLE npcs_new (
    id             TEXT PRIMARY KEY,
    player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000000',
    name           TEXT NOT NULL,
    archetype      TEXT NOT NULL DEFAULT '',
    portrait_url   TEXT,
    template_id    TEXT,
    sheet_data     TEXT NOT NULL DEFAULT '{}',
    is_generated   INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data
INSERT INTO npcs_new (id, player_user_id, name, archetype, portrait_url, template_id, sheet_data, is_generated, created_at)
SELECT id, '00000000-0000-0000-0000-000000000000', name, archetype, portrait_url, template_id, sheet_data, is_generated, created_at
FROM npcs;

-- Drop old table and rename new one
DROP TABLE npcs;
ALTER TABLE npcs_new RENAME TO npcs;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_npcs_player ON npcs(player_user_id);
