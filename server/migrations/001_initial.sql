-- =============================================================================
-- Horizon — Migration 001: Initial Schema
-- =============================================================================
-- Creates all core tables for the Horizon VTT. Uses CREATE TABLE IF NOT EXISTS
-- so this migration is safely re-runnable. All timestamps use ISO 8601 text
-- format (SQLite has no native datetime type). Foreign keys are enforced at
-- the connection level (PRAGMA foreign_keys = ON in db.ts).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Users & Authentication
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Campaigns & Membership
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaigns (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    gm_user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_background_url TEXT,
    invite_code           TEXT NOT NULL UNIQUE,
    ruleset_version        TEXT NOT NULL DEFAULT 'horizon-v1',
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_gm ON campaigns(gm_user_id);

CREATE TABLE IF NOT EXISTS campaign_players (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('gm', 'player')),
    PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_players_user ON campaign_players(user_id);

-- ---------------------------------------------------------------------------
-- Characters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS characters (
    id             TEXT PRIMARY KEY,
    campaign_id    TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    player_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    archetype      TEXT NOT NULL DEFAULT '',
    portrait_url   TEXT,
    sheet_data     TEXT NOT NULL DEFAULT '{}',  -- JSON column
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_characters_player ON characters(player_user_id);

-- ---------------------------------------------------------------------------
-- NPCs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS npcs (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    archetype   TEXT NOT NULL DEFAULT '',
    portrait_url TEXT,
    template_id TEXT,
    sheet_data  TEXT NOT NULL DEFAULT '{}',  -- JSON column
    is_generated INTEGER NOT NULL DEFAULT 0,  -- boolean: 0 = manual, 1 = generated
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs(campaign_id);

-- ---------------------------------------------------------------------------
-- Sessions & Attendance
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,  -- ISO 8601 date of the play session
    summary     TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON sessions(campaign_id);

CREATE TABLE IF NOT EXISTS session_attendance (
    session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
    PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON session_attendance(user_id);

-- ---------------------------------------------------------------------------
-- Dice Logs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dice_logs (
    id            TEXT PRIMARY KEY,
    campaign_id   TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    session_id    TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    roller_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id  TEXT REFERENCES characters(id) ON DELETE SET NULL,
    pool          TEXT NOT NULL,   -- dice pool expression (e.g. "3d6+2a")
    results       TEXT NOT NULL,   -- JSON array of DieResult objects
    total         INTEGER NOT NULL,
    reason        TEXT NOT NULL DEFAULT '',
    rolled_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dice_logs_campaign ON dice_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dice_logs_session ON dice_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_dice_logs_roller ON dice_logs(roller_user_id);

-- ---------------------------------------------------------------------------
-- Chat Messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK (type IN ('text', 'dice', 'system')),
    content     TEXT NOT NULL DEFAULT '""',  -- JSON: string, DiceChatContent, or SystemChatContent
    sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_campaign ON chat_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
