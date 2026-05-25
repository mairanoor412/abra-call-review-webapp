/**
 * comms.js - Read-only connection to comms.db
 *
 * Production: /home/maira/abra-comms-staging/data/comms.db (symlink to live DB)
 * Local Dev: seed-data/comms-seed.db (test data)
 *
 * CRITICAL: This database is READ-ONLY. Never write to it.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine environment and database path
const IS_VPS = existsSync('/home/maira/abra-comms-staging');
const DB_PATH = IS_VPS
  ? '/home/maira/abra-comms-staging/data/comms-local.db'  // Local copy (avoids WAL mode issues with symlink)
  : join(__dirname, '../../seed-data/comms-seed.db');

let db = null;

/**
 * Initialize read-only connection to comms.db
 * @returns {Database} SQLite database instance
 */
export function getCommsDb() {
  if (db) {
    return db;
  }

  if (!existsSync(DB_PATH)) {
    throw new Error(`comms.db not found at: ${DB_PATH}`);
  }

  // Open in read-only mode
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  // Verify we can read from the database
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM calls').get();
    console.log(`[comms.js] Connected to comms.db (${result.count} calls) at ${DB_PATH}`);
  } catch (error) {
    db.close();
    db = null;
    throw new Error(`Failed to verify comms.db schema: ${error.message}`);
  }

  return db;
}

/**
 * Close the database connection (called on server shutdown)
 */
export function closeCommsDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[comms.js] Closed comms.db connection');
  }
}

/**
 * Verify database has expected tables
 * @returns {boolean} True if all required tables exist
 */
export function verifySchema() {
  const requiredTables = ['calls', 'recordings_v2', 'transcripts', 'classifications', 'ad_calls'];
  const commsDb = getCommsDb();

  const tables = commsDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map(row => row.name);

  const missing = requiredTables.filter(t => !tables.includes(t));

  if (missing.length > 0) {
    throw new Error(`comms.db missing required tables: ${missing.join(', ')}`);
  }

  return true;
}

// Graceful shutdown
process.on('SIGTERM', closeCommsDb);
process.on('SIGINT', closeCommsDb);
