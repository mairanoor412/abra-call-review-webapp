/**
 * Integration tests for callback-queue queries
 *
 * Tests FR-001 through FR-006 using seed database:
 * - Missed call retrieval
 * - Deduplication by caller_number
 * - Exclusion logic (outbound calls, actioned callbacks)
 * - Transcript/classification joins
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCallbackQueue, getCallbackStats } from '../../src/db/queries/callback-queue.js';
import { getReviewsDb } from '../../src/db/reviews.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup: Initialize databases for testing
before(() => {
  // Reviews DB will be created automatically in data/ directory
  getReviewsDb();
});

test('fetchCallbackQueue - returns missed calls from seed data', () => {
  const callbacks = fetchCallbackQueue();

  // Seed DB has 5 missed calls
  assert.ok(callbacks.length > 0, 'Should return at least some callbacks');

  // Check structure of first callback
  const first = callbacks[0];
  assert.ok(first.caller_number, 'Should have caller_number');
  assert.ok(first.masked_phone, 'Should have masked_phone');
  assert.ok(first.most_recent_call_time, 'Should have call_time');
  assert.equal(typeof first.attempt_count, 'number', 'Should have attempt_count');
  assert.ok(['unanswered', 'short_call'].includes(first.reason), 'Should have valid reason');
});

test('fetchCallbackQueue - masks phone numbers correctly', () => {
  const callbacks = fetchCallbackQueue();

  for (const callback of callbacks) {
    // FR-036: Phone numbers should be masked
    assert.match(callback.masked_phone, /\*\*\* \*\*\*\*/);
    assert.ok(callback.masked_phone.includes(callback.caller_number.slice(-4)));
  }
});

test('fetchCallbackQueue - sorts NEW_PATIENT first', () => {
  const callbacks = fetchCallbackQueue();

  // Find first new patient and first non-new patient
  const newPatientIndex = callbacks.findIndex(c => c.is_new_patient);
  const nonNewPatientIndex = callbacks.findIndex(c => !c.is_new_patient);

  if (newPatientIndex >= 0 && nonNewPatientIndex >= 0) {
    // FR-008: NEW_PATIENT should come before others
    assert.ok(newPatientIndex < nonNewPatientIndex, 'NEW_PATIENT should be sorted first');
  }
});

test('fetchCallbackQueue - practice filter works', () => {
  const practice1 = fetchCallbackQueue({ practice: 'practice1' });
  const practice2 = fetchCallbackQueue({ practice: 'practice2' });
  const all = fetchCallbackQueue({ practice: 'all' });

  // Practice-filtered results should be subset of all
  assert.ok(practice1.length <= all.length);
  assert.ok(practice2.length <= all.length);

  // Verify practice filtering
  for (const callback of practice1) {
    assert.equal(callback.practice, 'practice1');
  }
});

test('fetchCallbackQueue - deduplication aggregates attempts', () => {
  const callbacks = fetchCallbackQueue();

  // All caller_numbers should be unique (FR-005)
  const callerNumbers = callbacks.map(c => c.caller_number);
  const uniqueCallerNumbers = new Set(callerNumbers);

  assert.equal(callerNumbers.length, uniqueCallerNumbers.size,
    'Each caller_number should appear only once (deduplicated)');

  // Check that attempt_count is correctly set
  for (const callback of callbacks) {
    assert.ok(callback.attempt_count >= 1, 'Attempt count should be at least 1');
  }
});

test('fetchCallbackQueue - excludes actioned calls', () => {
  const reviewsDb = getReviewsDb();

  // Get initial count
  const before = fetchCallbackQueue();
  const beforeCount = before.length;

  // Action one of the callbacks
  if (beforeCount > 0) {
    const toAction = before[0];

    reviewsDb
      .prepare(
        `INSERT INTO callback_actions
         (caller_number, practice, most_recent_missed_at, actioned_at, outcome, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        toAction.caller_number,
        toAction.practice,
        toAction.most_recent_call_time,
        new Date().toISOString(),
        'called_back',
        'Integration test action'
      );

    // Fetch again - should exclude the actioned call
    const after = fetchCallbackQueue();

    // FR-004: Actioned calls should be excluded
    assert.equal(after.length, beforeCount - 1, 'Actioned call should be excluded');

    const found = after.find(c => c.caller_number === toAction.caller_number);
    assert.equal(found, undefined, 'Actioned caller should not appear in results');

    // Cleanup: Remove test action
    reviewsDb
      .prepare('DELETE FROM callback_actions WHERE notes = ?')
      .run('Integration test action');
  }
});

test('getCallbackStats - returns correct statistics', () => {
  const stats = getCallbackStats();

  assert.ok(stats.total_missed >= 0, 'Should have total_missed count');
  assert.ok(stats.total_actioned >= 0, 'Should have total_actioned count');
  assert.ok(stats.total_pending >= 0, 'Should have total_pending count');
  assert.ok(stats.unattributed_count >= 0, 'Should have unattributed_count');

  // Logical relationship
  assert.ok(stats.total_pending <= stats.total_missed,
    'Pending should be <= total missed');
});

test('fetchCallbackQueue - handles empty results gracefully', () => {
  // Filter for non-existent practice
  const results = fetchCallbackQueue({ practice: 'nonexistent_practice' });

  assert.ok(Array.isArray(results), 'Should return array even if empty');
  assert.equal(results.length, 0, 'Should return empty array for no matches');
});

test('fetchCallbackQueue - transcript snippet is truncated', () => {
  const callbacks = fetchCallbackQueue();

  for (const callback of callbacks) {
    if (callback.has_transcript) {
      // FR-007: Transcript snippet should be ~150 chars
      assert.ok(callback.transcript_snippet.length <= 153,
        'Transcript snippet should be truncated to ~150 chars');
    }
  }
});
