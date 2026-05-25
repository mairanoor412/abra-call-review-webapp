/**
 * Integration tests for ad-attribution queries
 *
 * Tests FR-017 through FR-019 using seed database:
 * - Ad call retrieval with joins
 * - Headline metrics calculation
 * - Handling of unmatched calls (matched_call_id = -1)
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAdAttribution, getAdAttributionStats } from '../../src/db/queries/ad-attribution.js';
import { getReviewsDb } from '../../src/db/reviews.js';

// Setup: Initialize databases for testing
before(() => {
  getReviewsDb();
});

test('fetchAdAttribution - returns ad calls from seed data', () => {
  // Seed DB has 5 ad calls
  const result = fetchAdAttribution({ date: '2026-05-23' });

  assert.ok(result.ad_calls, 'Should return ad_calls array');
  assert.ok(result.metrics, 'Should return metrics object');
  assert.ok(result.filters, 'Should return filters object');

  // Check structure of metrics
  assert.equal(typeof result.metrics.total_ad_calls, 'number');
  assert.equal(typeof result.metrics.haiku_new_patient_count, 'number');
  assert.equal(typeof result.metrics.human_confirmed_count, 'number');
  assert.equal(typeof result.metrics.ad_spend_gbp, 'number');
});

test('fetchAdAttribution - masks phone numbers correctly', () => {
  const result = fetchAdAttribution({ date: '2026-05-23' });

  for (const call of result.ad_calls) {
    // FR-036: Phone numbers should be masked
    assert.match(call.masked_phone, /\*\*\* \*\*\*\*/);
    assert.ok(call.masked_phone.includes(call.caller_number.slice(-4)));
  }
});

test('fetchAdAttribution - handles unmatched calls gracefully', () => {
  const result = fetchAdAttribution({ date: '2026-05-23' });

  // FR-019: Check that unmatched calls (matched_call_id = -1) are handled
  const unmatchedCalls = result.ad_calls.filter(call => call.matched_call_id === -1);

  for (const call of unmatchedCalls) {
    assert.equal(call.has_recording, false, 'Unmatched calls should not have recordings');
    assert.equal(call.has_transcript, false, 'Unmatched calls should not have transcripts');
    assert.equal(call.transcript_text, null, 'Unmatched calls should have null transcript');
  }
});

test('fetchAdAttribution - calculates headline metrics correctly', () => {
  const result = fetchAdAttribution({ date: '2026-05-23' });

  // FR-018: Verify all headline metrics are present
  assert.ok(result.metrics.total_ad_calls >= 0);
  assert.ok(result.metrics.haiku_new_patient_count >= 0);
  assert.ok(result.metrics.human_confirmed_count >= 0);
  assert.ok(result.metrics.ad_spend_gbp >= 0);

  // Cost per confirmed should be null if no confirmations
  if (result.metrics.human_confirmed_count === 0) {
    assert.equal(result.metrics.cost_per_confirmed, null);
  } else {
    assert.equal(typeof result.metrics.cost_per_confirmed, 'number');
    assert.ok(result.metrics.cost_per_confirmed > 0);
  }
});

test('fetchAdAttribution - practice filter works', () => {
  const practice1 = fetchAdAttribution({ date: '2026-05-23', practice: 'practice1' });
  const practice2 = fetchAdAttribution({ date: '2026-05-23', practice: 'practice2' });
  const all = fetchAdAttribution({ date: '2026-05-23', practice: 'all' });

  // Practice-filtered results should be subset of all
  assert.ok(practice1.ad_calls.length <= all.ad_calls.length);
  assert.ok(practice2.ad_calls.length <= all.ad_calls.length);

  // Verify practice filtering
  for (const call of practice1.ad_calls) {
    assert.equal(call.practice, 'practice1');
  }
});

test('fetchAdAttribution - unreviewed_only filter works', () => {
  const reviewsDb = getReviewsDb();

  // Get unreviewed calls
  const unreviewedResult = fetchAdAttribution({
    date: '2026-05-23',
    unreviewed_only: true
  });
  const unreviewedCount = unreviewedResult.ad_calls.length;

  // If there are calls, review one
  if (unreviewedCount > 0) {
    const callToReview = unreviewedResult.ad_calls[0];

    reviewsDb
      .prepare(
        `INSERT INTO ad_call_reviews
         (ad_call_id, reviewed_by, reviewed_at, decision, notes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        callToReview.ad_call_id,
        null,
        new Date().toISOString(),
        'new_patient',
        'Integration test review'
      );

    // Fetch again with unreviewed_only
    const afterReview = fetchAdAttribution({
      date: '2026-05-23',
      unreviewed_only: true
    });

    // Should have one less unreviewed call
    assert.equal(afterReview.ad_calls.length, unreviewedCount - 1);

    // Fetch with unreviewed_only=false to see all
    const allCalls = fetchAdAttribution({
      date: '2026-05-23',
      unreviewed_only: false
    });

    // Should include the reviewed call
    const reviewedCall = allCalls.ad_calls.find(c => c.ad_call_id === callToReview.ad_call_id);
    assert.ok(reviewedCall, 'Reviewed call should appear when unreviewed_only=false');
    assert.equal(reviewedCall.is_reviewed, true);
    assert.equal(reviewedCall.review_decision, 'new_patient');

    // Cleanup
    reviewsDb
      .prepare('DELETE FROM ad_call_reviews WHERE notes = ?')
      .run('Integration test review');
  }
});

test('fetchAdAttribution - new_patient_only filter works', () => {
  const newPatientOnly = fetchAdAttribution({
    date: '2026-05-23',
    new_patient_only: true
  });

  // All results should be classified as new_patient
  for (const call of newPatientOnly.ad_calls) {
    assert.equal(call.is_new_patient, true);
    assert.equal(call.classification_type, 'new_patient');
  }
});

test('fetchAdAttribution - formats duration correctly', () => {
  const result = fetchAdAttribution({ date: '2026-05-23' });

  for (const call of result.ad_calls) {
    // Duration should be formatted as "Xm Ys" or "Ys" or "0s"
    assert.match(call.duration_formatted, /^\d+m \d+s$|^\d+s$/);
  }
});

test('getAdAttributionStats - returns overall statistics', () => {
  const stats = getAdAttributionStats();

  assert.ok(stats.total_ad_calls >= 0);
  assert.ok(stats.matched_calls >= 0);
  assert.ok(stats.unmatched_calls >= 0);
  assert.ok(stats.match_rate_percent >= 0);
  assert.ok(stats.match_rate_percent <= 100);

  // Logical relationship
  assert.equal(
    stats.total_ad_calls,
    stats.matched_calls + stats.unmatched_calls,
    'Total should equal matched + unmatched'
  );
});

test('fetchAdAttribution - handles empty results gracefully', () => {
  // Use a date with no ad calls
  const result = fetchAdAttribution({ date: '2020-01-01' });

  assert.ok(Array.isArray(result.ad_calls));
  assert.equal(result.ad_calls.length, 0);
  assert.equal(result.metrics.total_ad_calls, 0);
});
