import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'comms-seed.db');

// Create database
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('Creating seed database schema...');

// Create tables matching production comms.db schema
db.exec(`
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_number TEXT NOT NULL,
    practice TEXT,
    direction TEXT NOT NULL,
    call_type TEXT NOT NULL,
    answered INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recordings_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    duration_sec INTEGER,
    FOREIGN KEY (call_id) REFERENCES calls(id)
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id INTEGER NOT NULL,
    transcript TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (recording_id) REFERENCES recordings_v2(id)
  );

  CREATE TABLE IF NOT EXISTS classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id INTEGER NOT NULL,
    classification TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (recording_id) REFERENCES recordings_v2(id)
  );

  CREATE TABLE IF NOT EXISTS ad_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id INTEGER,
    caller_number TEXT NOT NULL,
    gclid TEXT NOT NULL,
    ad_campaign TEXT,
    ad_group TEXT,
    keyword TEXT,
    match_type TEXT,
    spend_gbp REAL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (call_id) REFERENCES calls(id)
  );
`);

console.log('Inserting seed data...');

// Seed data: 10 calls (5 missed, 5 answered)
const now = new Date();
const yesterday = new Date(now - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);

const calls = [
  // Missed calls (need callbacks)
  { caller_number: '+447700900001', practice: 'practice1', direction: 'inbound', call_type: 'regular', answered: 0, duration_sec: 0, timestamp: twoDaysAgo.toISOString() },
  { caller_number: '+447700900002', practice: 'practice1', direction: 'inbound', call_type: 'regular', answered: 0, duration_sec: 0, timestamp: yesterday.toISOString() },
  { caller_number: '+447700900003', practice: 'practice2', direction: 'inbound', call_type: 'regular', answered: 0, duration_sec: 0, timestamp: yesterday.toISOString() },
  { caller_number: '+447700900004', practice: 'practice1', direction: 'inbound', call_type: 'regular', answered: 0, duration_sec: 0, timestamp: now.toISOString() },
  { caller_number: '+447700900005', practice: 'practice2', direction: 'inbound', call_type: 'regular', answered: 0, duration_sec: 0, timestamp: now.toISOString() },

  // Answered calls
  { caller_number: '+447700900006', practice: 'practice1', direction: 'inbound', call_type: 'regular', answered: 1, duration_sec: 120, timestamp: yesterday.toISOString() },
  { caller_number: '+447700900007', practice: 'practice2', direction: 'inbound', call_type: 'regular', answered: 1, duration_sec: 180, timestamp: yesterday.toISOString() },
  { caller_number: '+447700900008', practice: 'practice1', direction: 'inbound', call_type: 'regular', answered: 1, duration_sec: 90, timestamp: now.toISOString() },
  { caller_number: '+447700900009', practice: 'practice2', direction: 'inbound', call_type: 'regular', answered: 1, duration_sec: 240, timestamp: now.toISOString() },
  { caller_number: '+447700900010', practice: 'practice1', direction: 'inbound', call_type: 'regular', answered: 1, duration_sec: 60, timestamp: now.toISOString() },
];

const insertCall = db.prepare(`
  INSERT INTO calls (caller_number, practice, direction, call_type, answered, duration_sec, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const callIds = calls.map(call => {
  const result = insertCall.run(
    call.caller_number,
    call.practice,
    call.direction,
    call.call_type,
    call.answered,
    call.duration_sec,
    call.timestamp
  );
  return result.lastInsertRowid;
});

// Add recordings for answered calls (call IDs 6-10)
const insertRecording = db.prepare(`
  INSERT INTO recordings_v2 (call_id, file_path, duration_sec)
  VALUES (?, ?, ?)
`);

const recordingIds = [];
for (let i = 5; i < 10; i++) {
  const callId = callIds[i];
  const result = insertRecording.run(
    callId,
    `/recordings/call_${callId}.wav`,
    calls[i].duration_sec
  );
  recordingIds.push(result.lastInsertRowid);
}

// Add transcripts for 3 recordings
const insertTranscript = db.prepare(`
  INSERT INTO transcripts (recording_id, transcript, created_at)
  VALUES (?, ?, ?)
`);

const transcripts = [
  { recording_id: recordingIds[0], transcript: 'Hello, I would like to book an appointment for next week.', created_at: now.toISOString() },
  { recording_id: recordingIds[1], transcript: 'Hi, I am calling to confirm my appointment tomorrow at 2pm.', created_at: now.toISOString() },
  { recording_id: recordingIds[2], transcript: 'Good morning, I need to reschedule my appointment please.', created_at: now.toISOString() },
];

transcripts.forEach(t => {
  insertTranscript.run(t.recording_id, t.transcript, t.created_at);
});

// Add classifications for same 3 recordings
const insertClassification = db.prepare(`
  INSERT INTO classifications (recording_id, classification, created_at)
  VALUES (?, ?, ?)
`);

const classifications = [
  { recording_id: recordingIds[0], classification: 'new_booking', created_at: now.toISOString() },
  { recording_id: recordingIds[1], classification: 'appointment_confirmation', created_at: now.toISOString() },
  { recording_id: recordingIds[2], classification: 'reschedule_request', created_at: now.toISOString() },
];

classifications.forEach(c => {
  insertClassification.run(c.recording_id, c.classification, c.created_at);
});

// Add ad_calls for 5 calls (only 2 will match to actual calls)
const insertAdCall = db.prepare(`
  INSERT INTO ad_calls (call_id, caller_number, gclid, ad_campaign, ad_group, keyword, match_type, spend_gbp, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const adCalls = [
  // Matched calls (call_ids 1 and 6)
  { call_id: callIds[0], caller_number: '+447700900001', gclid: 'Cj0KCQjw1', ad_campaign: 'Eye Tests London', ad_group: 'Eye Test Near Me', keyword: 'eye test', match_type: 'phrase', spend_gbp: 3.45, timestamp: twoDaysAgo.toISOString() },
  { call_id: callIds[5], caller_number: '+447700900006', gclid: 'Cj0KCQjw2', ad_campaign: 'Contact Lenses', ad_group: 'Contact Lenses Online', keyword: 'contact lenses', match_type: 'exact', spend_gbp: 5.20, timestamp: yesterday.toISOString() },

  // Unmatched ad calls (caller_number doesn't exist in calls table)
  { call_id: null, caller_number: '+447700900099', gclid: 'Cj0KCQjw3', ad_campaign: 'Eye Tests London', ad_group: 'Eye Test Near Me', keyword: 'optician near me', match_type: 'broad', spend_gbp: 4.10, timestamp: yesterday.toISOString() },
  { call_id: null, caller_number: '+447700900098', gclid: 'Cj0KCQjw4', ad_campaign: 'Designer Frames', ad_group: 'Ray-Ban Glasses', keyword: 'ray ban glasses', match_type: 'phrase', spend_gbp: 6.75, timestamp: now.toISOString() },
  { call_id: null, caller_number: '+447700900097', gclid: 'Cj0KCQjw5', ad_campaign: 'Contact Lenses', ad_group: 'Dailies Lenses', keyword: 'daily contact lenses', match_type: 'exact', spend_gbp: 4.90, timestamp: now.toISOString() },
];

adCalls.forEach(ad => {
  insertAdCall.run(
    ad.call_id,
    ad.caller_number,
    ad.gclid,
    ad.ad_campaign,
    ad.ad_group,
    ad.keyword,
    ad.match_type,
    ad.spend_gbp,
    ad.timestamp
  );
});

console.log('Seed data inserted successfully!');
console.log('\nDatabase statistics:');
console.log('- Calls:', db.prepare('SELECT COUNT(*) as count FROM calls').get().count);
console.log('- Recordings:', db.prepare('SELECT COUNT(*) as count FROM recordings_v2').get().count);
console.log('- Transcripts:', db.prepare('SELECT COUNT(*) as count FROM transcripts').get().count);
console.log('- Classifications:', db.prepare('SELECT COUNT(*) as count FROM classifications').get().count);
console.log('- Ad Calls:', db.prepare('SELECT COUNT(*) as count FROM ad_calls').get().count);
console.log('\nMissed calls (need callbacks):', db.prepare('SELECT COUNT(*) as count FROM calls WHERE answered = 0').get().count);
console.log('Matched ad calls:', db.prepare('SELECT COUNT(*) as count FROM ad_calls WHERE call_id IS NOT NULL').get().count);
console.log('Unmatched ad calls:', db.prepare('SELECT COUNT(*) as count FROM ad_calls WHERE call_id IS NULL').get().count);

db.close();
console.log(`\nDatabase created at: ${DB_PATH}`);
