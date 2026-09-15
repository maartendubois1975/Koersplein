import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, 'migrations');

export function databasePath() {
  const dataDir = resolve(process.env.KOERSPLEIN_DATA_DIR || join(here, '../../var'));
  mkdirSync(dataDir, { recursive: true });
  return process.env.KOERSPLEIN_DATABASE_PATH || join(dataDir, 'koersplein.sqlite');
}

export function openDatabase(path = databasePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
  for (const filename of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
    if (applied.has(filename)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(join(migrationsDir, filename), 'utf8'));
      db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(filename, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
