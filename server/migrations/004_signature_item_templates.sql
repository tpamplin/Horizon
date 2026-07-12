-- =============================================================================
-- Horizon — Migration 004: Signature Item Templates
-- =============================================================================
-- Creates a shared library of reusable signature item templates.
-- Users define items once, then assign them to characters.
-- =============================================================================

CREATE TABLE IF NOT EXISTS signature_item_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    modifiers   TEXT,
    rules       TEXT,
    category    TEXT,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sit_created_by ON signature_item_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_sit_category ON signature_item_templates(category);
