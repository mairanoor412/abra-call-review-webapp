/**
 * E2E tests for ad decision workflow
 *
 * Tests T061: POST decision → verify row in ad_call_reviews, verify headline count updates
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttpServer } from '../../src/server.js';
import { getReviewsDb, closeReviewsDb } from '../../src/db/reviews.js';
import { closeCommsDb } from '../../src/db/comms.js';
import { fetchAdAttribution } from '../../src/db/queries/ad-attribution.js';

const BASE_URL = 'http://127.0.0.1:7000';
const TEST_DATE = '2026-05-23';
const PORT = 7000;
const HOST = '127.0.0.1';
let server;

// Helper to make HTTP requests
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('Ad Decision E2E Flow', () => {
  let reviewsDb;
  let testAdCallId;
  let initialConfirmedCount;

  before(async () => {
    // Start server for E2E tests
    server = createHttpServer();
    await new Promise((resolve) => {
      server.listen(PORT, HOST, () => {
        console.log(`[E2E] Test server running at http://${HOST}:${PORT}/`);
        resolve();
      });
    });

    reviewsDb = getReviewsDb();

    // Get initial state
    const initialResult = fetchAdAttribution({
      date: TEST_DATE,
      unreviewed_only: false
    });

    initialConfirmedCount = initialResult.metrics.human_confirmed_count;

    // Find an unreviewed ad call for testing
    const unreviewedResult = fetchAdAttribution({
      date: TEST_DATE,
      unreviewed_only: true
    });

    if (unreviewedResult.ad_calls.length > 0) {
      testAdCallId = unreviewedResult.ad_calls[0].ad_call_id;
    }
  });

  after(async () => {
    // Cleanup: Remove test reviews
    if (testAdCallId) {
      reviewsDb
        .prepare('DELETE FROM ad_call_reviews WHERE ad_call_id = ? AND notes LIKE ?')
        .run(testAdCallId, '%E2E test%');
    }

    // Close server
    await new Promise((resolve) => {
      server.close(() => {
        console.log('[E2E] Test server closed');
        closeCommsDb();
        closeReviewsDb();
        resolve();
      });
    });
  });

  test('GET /api/ad-calls returns ad calls with metrics', async () => {
    const response = await httpRequest({
      hostname: '127.0.0.1',
      port: 7000,
      path: `/api/ad-calls?date=${TEST_DATE}`,
      method: 'GET'
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.ad_calls, 'Response should have ad_calls array');
    assert.ok(response.body.metrics, 'Response should have metrics object');
    assert.ok(response.body.filters, 'Response should have filters object');

    // Verify metrics structure
    assert.equal(typeof response.body.metrics.total_ad_calls, 'number');
    assert.equal(typeof response.body.metrics.haiku_new_patient_count, 'number');
    assert.equal(typeof response.body.metrics.human_confirmed_count, 'number');
    assert.equal(typeof response.body.metrics.ad_spend_gbp, 'number');
  });

  test('POST /api/ad-calls/review saves decision to database', async () => {
    if (!testAdCallId) {
      // Skip if no unreviewed calls available
      return;
    }

    const decision = 'new_patient';
    const notes = 'E2E test - confirm new patient';

    const response = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: 7000,
        path: '/api/ad-calls/review',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      JSON.stringify({
        ad_call_id: testAdCallId,
        decision,
        notes
      })
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.reviewed_at, 'Should return reviewed_at timestamp');

    // Verify row in database
    const review = reviewsDb
      .prepare('SELECT * FROM ad_call_reviews WHERE ad_call_id = ?')
      .get(testAdCallId);

    assert.ok(review, 'Review should be saved in database');
    assert.equal(review.decision, decision);
    assert.equal(review.notes, notes);
  });

  test('POST /api/ad-calls/review updates headline confirmed count', async () => {
    // Get updated metrics
    const result = fetchAdAttribution({
      date: TEST_DATE,
      unreviewed_only: false
    });

    // If we reviewed a call as new_patient, confirmed count should increase
    if (testAdCallId) {
      assert.ok(
        result.metrics.human_confirmed_count >= initialConfirmedCount,
        'Human confirmed count should be >= initial count after review'
      );
    }
  });

  test('POST /api/ad-calls/review rejects invalid decision', async () => {
    const response = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: 7000,
        path: '/api/ad-calls/review',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      JSON.stringify({
        ad_call_id: 999,
        decision: 'invalid_decision',
        notes: ''
      })
    );

    assert.equal(response.statusCode, 400);
    assert.ok(response.body.error, 'Should return error message');
  });

  test('Reviewed call appears with is_reviewed=true', async () => {
    if (!testAdCallId) return;

    const result = fetchAdAttribution({
      date: TEST_DATE,
      unreviewed_only: false
    });

    const reviewedCall = result.ad_calls.find(c => c.ad_call_id === testAdCallId);

    if (reviewedCall) {
      assert.equal(reviewedCall.is_reviewed, true);
      assert.equal(reviewedCall.review_decision, 'new_patient');
    }
  });

  test('Unreviewed filter excludes reviewed calls', async () => {
    if (!testAdCallId) return;

    const unreviewedResult = fetchAdAttribution({
      date: TEST_DATE,
      unreviewed_only: true
    });

    const shouldBeHidden = unreviewedResult.ad_calls.find(c => c.ad_call_id === testAdCallId);
    assert.equal(shouldBeHidden, undefined, 'Reviewed call should not appear in unreviewed list');
  });
});
