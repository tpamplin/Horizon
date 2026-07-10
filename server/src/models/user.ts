// =============================================================================
// Horizon — User Model
// =============================================================================
// Database query functions for the users table. All user DB access flows
// through this module — never write raw SQL in routes or services.
// =============================================================================

import db from './db.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw user row as returned from the database (snake_case columns). */
export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  password_hash: string;
  created_at: string;
}

/** Parameters for creating a new user. */
export interface CreateUserParams {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

// -----------------------------------------------------------------------------
// Prepared Statements (created once, reused)
// -----------------------------------------------------------------------------

const stmtFindByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

const stmtFindById = db.prepare('SELECT * FROM users WHERE id = ?');

const stmtCreateUser = db.prepare(`
  INSERT INTO users (id, email, display_name, avatar_url, password_hash, created_at)
  VALUES (@id, @email, @displayName, NULL, @passwordHash, datetime('now'))
`);

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Find a user by their email address.
 * Returns the raw database row or null if no user exists with that email.
 */
export function findByEmail(email: string): UserRow | null {
  const row = stmtFindByEmail.get(email) as UserRow | undefined;
  return row ?? null;
}

/**
 * Create a new user in the database.
 * The `id` should be generated via `crypto.randomUUID()` before calling.
 * Returns the raw database row of the newly created user.
 */
export function createUser(params: CreateUserParams): UserRow {
  stmtCreateUser.run({
    id: params.id,
    email: params.email,
    displayName: params.displayName,
    passwordHash: params.passwordHash,
  });

  // Re-fetch to get server-generated values (created_at)
  const row = stmtFindByEmail.get(params.email) as UserRow;
  return row!;
}

/**
 * Find a user by their unique ID.
 * Returns the raw database row or null if no user exists with that ID.
 */
export function findById(userId: string): UserRow | null {
  const row = stmtFindById.get(userId) as UserRow | undefined;
  return row ?? null;
}
