/**
 * ad-review.js - API routes for Tab 2 (Google Ads Call Review)
 *
 * Endpoints:
 * - GET  /api/ad-calls        - Fetch ad attribution data (FR-017-021)
 * - POST /api/ad-calls/review - Submit human review decision (FR-023-026)
 */

import { fetchAdAttribution, getAdAttributionStats } from '../db/queries/ad-attribution.js';
import { getReviewsDb, isValidDecision, isValidNotes } from '../db/reviews.js';
import { now } from '../lib/date-utils.js';
import { user as userLogger, db as dbLogger, timer } from '../lib/logger.js';

/**
 * GET /api/ad-calls
 *
 * Query params:
 * - date: YYYY-MM-DD (default: yesterday)
 * - practice: middleton | cheadle | heald_green | heckmondwike | winsford | unattributed | all (default: all)
 * - unreviewed_only: true | false (default: true)
 * - new_patient_only: true | false (default: false)
 *
 * Response: JSON with ad_calls array and headline metrics
 */
export function handleGetAdCalls(req, res) {
  const elapsed = timer();

  try {
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const date = url.searchParams.get('date') || undefined; // Use default yesterday
    const practice = url.searchParams.get('practice') || 'all';
    const unreviewed_only = url.searchParams.get('unreviewed_only') !== 'false'; // Default true
    const new_patient_only = url.searchParams.get('new_patient_only') === 'true';

    userLogger.filter('ad-review', `date=${date}, practice=${practice}, unreviewed=${unreviewed_only}`);

    // Fetch ad attribution data
    const result = fetchAdAttribution({
      date,
      practice,
      unreviewed_only,
      new_patient_only,
    });

    const stats = getAdAttributionStats();

    const response = {
      ...result,
      overall_stats: stats,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));

    dbLogger.query('comms', 'SELECT ad_calls', elapsed());
  } catch (error) {
    console.error('[ad-review] GET /api/ad-calls error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
  }
}

/**
 * POST /api/ad-calls/review
 *
 * Request body:
 * {
 *   "ad_call_id": 123,
 *   "decision": "new_patient",  // ENUM: new_patient | not_new_patient | booked | existing | spam_wrong
 *   "notes": "Optional notes"   // max 500 chars
 * }
 *
 * Response: JSON { success: true, reviewed_at: "..." }
 */
export function handleReviewAdCall(req, res) {
  const elapsed = timer();

  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      // FR-025: Validate required fields
      const { ad_call_id, decision, notes } = data;

      if (!ad_call_id || !decision) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Missing required fields',
          required: ['ad_call_id', 'decision'],
        }));
        return;
      }

      // FR-023/025: Validate decision enum
      if (!isValidDecision(decision)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid decision value',
          valid_decisions: ['new_patient', 'not_new_patient', 'booked', 'existing', 'spam_wrong'],
          received: decision,
        }));
        return;
      }

      // FR-024: Validate notes length
      if (notes && !isValidNotes(notes)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Notes too long',
          max_length: 500,
          received_length: notes.length,
        }));
        return;
      }

      // FR-025: Write to reviews.db
      const reviewsDb = getReviewsDb();
      const reviewedAt = now();

      try {
        reviewsDb
          .prepare(
            `INSERT INTO ad_call_reviews
             (ad_call_id, reviewed_by, reviewed_at, decision, notes)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(
            ad_call_id,
            null, // Phase A: no auth
            reviewedAt,
            decision,
            notes || null
          );

        userLogger.reviewAdCall(ad_call_id, decision, notes);
        dbLogger.query('reviews', 'INSERT ad_call_review', elapsed());

        // FR-026: Return success
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          reviewed_at: reviewedAt,
        }));
      } catch (dbError) {
        // Handle duplicate review (UNIQUE constraint)
        if (dbError.message.includes('UNIQUE constraint failed')) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Ad call already reviewed',
            message: 'This ad call has already been reviewed',
          }));
        } else {
          throw dbError;
        }
      }
    } catch (error) {
      console.error('[ad-review] POST /api/ad-calls/review error:', error);

      if (error instanceof SyntaxError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid JSON',
          message: error.message,
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message,
        }));
      }
    }
  });

  req.on('error', error => {
    console.error('[ad-review] Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Request error',
      message: error.message,
    }));
  });
}

/**
 * Route handler for ad-review endpoints
 */
export function adReviewRouter(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/ad-calls') {
    return handleGetAdCalls(req, res);
  } else if (req.method === 'POST' && url.pathname === '/api/ad-calls/review') {
    return handleReviewAdCall(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
