// =============================================================================
// Horizon — Refresh Token Model
// =============================================================================
// Database query functions for the refresh_tokens table. All refresh token
// DB access flows through this module — never write raw SQL in routes or
// services.
// =============================================================================

import { randomUUID } from 'node:crypto';
import db from './db.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw refresh_token row as returned from the database (snake_case columns). */
export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

/** Parameters for storing a new refresh token. */
export interface StoreRefreshTokenParams {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

// -----------------------------------------------------------------------------
// Prepared Statements (created once, reused)
// -----------------------------------------------------------------------------

const stmtInsert = db.prepare(`
  INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
  VALUES (@id, @userId, @tokenHash, @expiresAt, datetime('now'))
`);

const stmtFindByHash = db.prepare(
  'SELECT id, user_id, token_hash, expires_at, created_at FROM refresh_tokens WHERE token_hash = ?',
);

const stmtDeleteById = db.prepare('DELETE FROM refresh_tokens WHERE id = ?');

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Store a new refresh token hash in the database.
 * The token itself is never stored — only its SHA-256 hash.
 */
export function storeRefreshToken(params: StoreRefreshTokenParams): void {
  stmtInsert.run({
    id: randomUUID(),
    userId: params.userId,
    tokenHash: params.tokenHash,
    expiresAt: params.expiresAt,
  });
}

/**
 * Find a refresh token row by its SHA-256 hash.
 * Returns the raw database row or null if no matching token exists.
 */
export function findRefreshTokenByHash(tokenHash: string): RefreshTokenRow | null {
  const row = stmtFindByHash.get(tokenHash) as RefreshTokenRow | undefined;
  return row ?? null;
}

/**
 * Delete a refresh token by its primary key.
 * Used during token rotation to invalidate the old token.
 */
export function deleteRefreshToken(id: string): void {
  stmtDeleteById.run(id);
}
