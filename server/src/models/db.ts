// =============================================================================
// Horizon — Database Connection
// =============================================================================
// Initializes the SQLite database via better-sqlite3, creates the data/
// directory on first run, auto-applies pending migrations, and exports a
// singleton db instance configured for WAL mode and foreign key enforcement.
// =============================================================================

import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// -----------------------------------------------------------------------------
// Auto-apply pending migrations (self-bootstrapping)
// -----------------------------------------------------------------------------

// Create the migration tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Determine the migrations directory relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, '..', '..', 'migrations');

// Read already-applied migrations
const applied = new Set(
  (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
);

// Find and apply pending migrations
let migrationFiles: string[] = [];
try {
  migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith('.sql'))
    .map((f) => f.name)
    .sort();
} catch {
  // migrations directory may not exist yet (Phase 0 scaffold)
}

for (const fileName of migrationFiles) {
  if (applied.has(fileName)) continue;

  const sql = readFileSync(join(migrationsDir, fileName), 'utf8');

  db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(fileName);
  })();
}

export { db };
export default db;
