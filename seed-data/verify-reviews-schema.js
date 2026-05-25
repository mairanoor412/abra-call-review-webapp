import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/reviews.db');

const db = new Database(DB_PATH, { readonly: true });

console.log('Verifying reviews.db schema...\n');

// Get all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Get callback_actions schema
console.log('\n--- callback_actions schema ---');
const cbSchema = db.prepare("PRAGMA table_info(callback_actions)").all();
cbSchema.forEach(col => {
  console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
});

// Get ad_call_reviews schema
console.log('\n--- ad_call_reviews schema ---');
const adSchema = db.prepare("PRAGMA table_info(ad_call_reviews)").all();
adSchema.forEach(col => {
  console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
});

// Get indexes
console.log('\n--- Indexes ---');
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
indexes.forEach(idx => {
  console.log(`  ${idx.name} on ${idx.tbl_name}`);
});

db.close();
console.log('\n✅ Schema verification complete!');
