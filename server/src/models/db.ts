// =============================================================================
// Horizon — Database Connection
// =============================================================================
// Initializes the SQLite database via better-sqlite3, creates the data/
// directory on first run, and exports a singleton db instance configured
// for WAL mode and foreign key enforcement.
// =============================================================================

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config.js';

// -----------------------------------------------------------------------------
// Ensure data directory exists
// -----------------------------------------------------------------------------

const dbDir = dirname(config.databasePath);
mkdirSync(dbDir, { recursive: true });

// -----------------------------------------------------------------------------
// Initialize database
// -----------------------------------------------------------------------------

const db: DatabaseType = new Database(config.databasePath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enforce foreign key constraints
db.pragma('foreign_keys = ON');

export { db };
export default db;
