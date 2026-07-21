-- Migration 006: Dice Logs — Redesigned schema for Phase 1.4 Dice Engine (HZN-244)
-- Replaces the original dice_logs table from 001_initial.sql with a new schema
-- that supports modifiers (modifiers_json), roll source tracking (roll_source),
-- structured JSON pool/results, and created_at timestamp.
--
-- SQLite does not support DROP COLUMN, so we recreate the table.

-- Step 1: Create the new table with the updated schema
CREATE TABLE IF NOT EXISTS dice_logs_new (
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

-- Step 2: Copy data from old table if the old schema exists
INSERT OR IGNORE INTO dice_logs_new (id, campaign_id, roller_user_id, pool_json, result_json, reason, created_at)
SELECT id, campaign_id, roller_user_id, pool, results, reason, rolled_at
FROM dice_logs
WHERE EXISTS (SELECT 1 FROM pragma_table_info('dice_logs') WHERE name = 'pool');

-- Step 3: Drop old table and rename
DROP TABLE IF EXISTS dice_logs;
ALTER TABLE dice_logs_new RENAME TO dice_logs;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_dl_campaign ON dice_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dl_created ON dice_logs(campaign_id, created_at);
