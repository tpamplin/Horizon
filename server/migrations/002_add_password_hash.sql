-- =============================================================================
-- Horizon — Migration 002: Add password_hash to users
-- =============================================================================
-- The initial schema (001_initial.sql) created the users table without a
-- password_hash column. This migration adds it so auth endpoints can store
-- bcrypt-hashed passwords.
--
-- Idempotency is handled by the migration runner: the _migrations tracking
-- table prevents re-execution after the first successful run.
-- =============================================================================

ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
