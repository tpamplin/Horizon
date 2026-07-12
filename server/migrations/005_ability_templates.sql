-- Migration 005: Ability Templates
CREATE TABLE IF NOT EXISTS ability_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    effect      TEXT NOT NULL DEFAULT '',
    category    TEXT,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_at_created_by ON ability_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_at_category ON ability_templates(category);
