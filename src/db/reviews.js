/**
 * reviews.js - Read-write connection to reviews.db
 *
 * Production: /home/maira/abra-comms-staging/data/reviews.db (user creates)
 * Local Dev: data/reviews.db (auto-created on first run)
 *
 * This database stores user actions:
 * - callback_actions: Tab 1 callback worklist ticks
 * - ad_call_reviews: Tab 2 ad call review decisions
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine environment and database path
const IS_VPS = existsSync('/home/maira/abra-comms-staging');
const DATA_DIR = IS_VPS
  ? '/home/maira/abra-comms-staging/data'
  : join(__dirname, '../../data');
const DB_PATH = join(DATA_DIR, 'reviews.db');

let db = null;

/**
 * Run database migrations (create tables if they don't exist)
 */
function runMigrations(database) {
  console.log('[reviews.js] Running migrations...');

  // Create callback_actions table (Tab 1)
  database.exec(`
    CREATE TABLE IF NOT EXISTS callback_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_number TEXT NOT NULL,
      practice TEXT,
      most_recent_missed_at TEXT NOT NULL,
      actioned_by TEXT,
      actioned_at TEXT NOT NULL,
      outcome TEXT NOT NULL,
      notes TEXT,
      UNIQUE(caller_number, most_recent_missed_at)
    );

    CREATE INDEX IF NOT EXISTS idx_callback_caller ON callback_actions(caller_number);
    CREATE INDEX IF NOT EXISTS idx_callback_time ON callback_actions(most_recent_missed_at);
  `);

  // Create ad_call_reviews table (Tab 2)
  database.exec(`
    CREATE TABLE IF NOT EXISTS ad_call_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_call_id INTEGER NOT NULL,
      reviewed_by TEXT,
      reviewed_at TEXT NOT NULL,
      decision TEXT NOT NULL,
      notes TEXT,
      UNIQUE(ad_call_id)
    );

    CREATE INDEX IF NOT EXISTS idx_review_ad_call ON ad_call_reviews(ad_call_id);
  `);

  // Verify tables were created
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map(row => row.name);

  if (!tables.includes('callback_actions') || !tables.includes('ad_call_reviews')) {
    throw new Error('Migration failed: required tables not created');
  }

  console.log('[reviews.js] Migrations complete (callback_actions, ad_call_reviews)');
}

/**
 * Initialize connection to reviews.db and run migrations
 * @returns {Database} SQLite database instance
 */
export function getReviewsDb() {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[reviews.js] Created data directory: ${DATA_DIR}`);
  }

  // Open database in read-write mode (creates if doesn't exist)
  db = new Database(DB_PATH, { fileMustExist: false });

  // Enable foreign keys and WAL mode for better concurrency
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  console.log(`[reviews.js] Connected to reviews.db at ${DB_PATH}`);

  return db;
}

/**
 * Close the database connection (called on server shutdown)
 */
export function closeReviewsDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[reviews.js] Closed reviews.db connection');
  }
}

/**
 * Validate outcome enum for callback_actions
 * @param {string} outcome
 * @returns {boolean}
 */
export function isValidOutcome(outcome) {
  const validOutcomes = ['called_back', 'vm_left', 'booked', 'wrong_number', 'not_relevant'];
  return validOutcomes.includes(outcome);
}

/**
 * Validate decision enum for ad_call_reviews
 * @param {string} decision
 * @returns {boolean}
 */
export function isValidDecision(decision) {
  const validDecisions = ['new_patient', 'not_new_patient', 'booked', 'existing', 'spam_wrong'];
  return validDecisions.includes(decision);
}

/**
 * Validate notes length (max 500 chars)
 * @param {string|null} notes
 * @returns {boolean}
 */
export function isValidNotes(notes) {
  if (notes === null || notes === undefined || notes === '') {
    return true;
  }
  return typeof notes === 'string' && notes.length <= 500;
}

// Graceful shutdown
process.on('SIGTERM', closeReviewsDb);
process.on('SIGINT', closeReviewsDb);
