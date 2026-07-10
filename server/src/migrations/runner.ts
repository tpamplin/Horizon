// =============================================================================
// Horizon — Migration Runner
// =============================================================================
// Reads .sql files from the migrations/ directory, applies them in sorted
// order, and tracks applied migrations in a _migrations table.
//
// Usage: npm run migrate -w server
// =============================================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { mkdirSync } from 'node:fs';

// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The server package root (server/)
const serverRoot = join(__dirname, '..', '..');

// SQL migration files live at server/migrations/
const migrationsDir = join(serverRoot, 'migrations');

// -----------------------------------------------------------------------------
// Database
// -----------------------------------------------------------------------------

// Ensure data directory exists
mkdirSync(dirname(config.databasePath), { recursive: true });

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// -----------------------------------------------------------------------------
// Tracking Table
// -----------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// -----------------------------------------------------------------------------
// Migration Runner
// -----------------------------------------------------------------------------

/**
 * Get list of already-applied migration names.
 */
function getAppliedMigrations(): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as {
    name: string;
  }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Get list of .sql files from the migrations directory, sorted by name.
 */
function getMigrationFiles(): string[] {
  const files = readdirSync(migrationsDir, { withFileTypes: true });
  return files
    .filter((f) => f.isFile() && f.name.endsWith('.sql'))
    .map((f) => f.name)
    .sort();
}

/**
 * Apply a single migration file within a transaction.
 * If the migration fails, the transaction is rolled back and the error is thrown.
 */
function applyMigration(fileName: string): void {
  const filePath = join(migrationsDir, fileName);
  const sql = readFileSync(filePath, 'utf8');

  const apply = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(fileName);
  });

  apply();
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

const applied = getAppliedMigrations();
const files = getMigrationFiles();
const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log('All migrations are up to date.');
  process.exit(0);
}

console.log(`Applying ${pending.length} migration(s):`);
let appliedCount = 0;

for (const file of pending) {
  try {
    applyMigration(file);
    console.log(`  ✓ ${file}`);
    appliedCount++;
  } catch (err) {
    console.error(`  ✗ ${file} FAILED:`);
    console.error(err instanceof Error ? err.message : String(err));
    console.error('\nMigration aborted. Fix the error and re-run `npm run migrate`.');
    process.exit(1);
  }
}

console.log(`\n${appliedCount} migration(s) applied successfully.`);
db.close();
process.exit(0);
