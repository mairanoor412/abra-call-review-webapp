/**
 * callback-worklist.js - API routes for Tab 1 (Callback Worklist)
 *
 * Endpoints:
 * - GET  /api/callbacks       - Fetch callback queue (FR-001-010)
 * - POST /api/callbacks/tick  - Mark callback as actioned (FR-011-016)
 */

import { fetchCallbackQueue, getCallbackStats } from '../db/queries/callback-queue.js';
import { getReviewsDb, isValidOutcome, isValidNotes } from '../db/reviews.js';
import { now } from '../lib/date-utils.js';
import { user as userLogger, db as dbLogger, timer } from '../lib/logger.js';

/**
 * GET /api/callbacks
 *
 * Query params:
 * - practice: middleton | cheadle | heald_green | heckmondwike | winsford | unattributed | all (default: all)
 * - aged: true | false (default: false) - Show only calls >2 days old
 *
 * Response: JSON array of callbacks
 */
export function handleGetCallbacks(req, res) {
  const elapsed = timer();

  try {
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const practice = url.searchParams.get('practice') || 'all';
    const aged = url.searchParams.get('aged') === 'true';

    userLogger.filter('callbacks', `practice=${practice}, aged=${aged}`);

    // Fetch callbacks
    const callbacks = fetchCallbackQueue({ practice, aged });
    const stats = getCallbackStats();

    const response = {
      callbacks,
      stats,
      filters: {
        practice,
        aged,
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));

    dbLogger.query('comms', 'SELECT callbacks', elapsed());
  } catch (error) {
    console.error('[callback-worklist] GET /api/callbacks error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
  }
}

/**
 * POST /api/callbacks/tick
 *
 * Request body:
 * {
 *   "caller_number": "+447700900123",
 *   "practice": "middleton",
 *   "most_recent_missed_at": "2026-05-21T10:00:00.000Z",
 *   "outcome": "called_back",  // ENUM: called_back | vm_left | booked | wrong_number | not_relevant
 *   "notes": "Optional notes"  // max 500 chars
 * }
 *
 * Response: JSON { success: true, actioned_at: "..." }
 */
export function handleTickCallback(req, res) {
  const elapsed = timer();

  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      // FR-014: Validate required fields
      const { caller_number, practice, most_recent_missed_at, outcome, notes } = data;

      if (!caller_number || !most_recent_missed_at || !outcome) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Missing required fields',
          required: ['caller_number', 'most_recent_missed_at', 'outcome'],
        }));
        return;
      }

      // FR-012: Validate outcome enum
      if (!isValidOutcome(outcome)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Invalid outcome value',
          valid_outcomes: ['called_back', 'vm_left', 'booked', 'wrong_number', 'not_relevant'],
          received: outcome,
        }));
        return;
      }

      // FR-013: Validate notes length
      if (notes && !isValidNotes(notes)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Notes too long',
          max_length: 500,
          received_length: notes.length,
        }));
        return;
      }

      // FR-014: Write to reviews.db
      const reviewsDb = getReviewsDb();
      const actionedAt = now();

      try {
        reviewsDb
          .prepare(
            `INSERT INTO callback_actions
             (caller_number, practice, most_recent_missed_at, actioned_by, actioned_at, outcome, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            caller_number,
            practice || null,
            most_recent_missed_at,
            null, // Phase A: no auth
            actionedAt,
            outcome,
            notes || null
          );

        userLogger.tickCallback(caller_number, outcome, notes);
        dbLogger.query('reviews', 'INSERT callback_action', elapsed());

        // FR-015: Return success
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          actioned_at: actionedAt,
        }));
      } catch (dbError) {
        // FR-016: Handle database errors (e.g., unique constraint violation)
        if (dbError.message.includes('UNIQUE constraint failed')) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Callback already actioned',
            message: 'This callback has already been marked as handled',
          }));
        } else {
          throw dbError;
        }
      }
    } catch (error) {
      console.error('[callback-worklist] POST /api/callbacks/tick error:', error);

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
    console.error('[callback-worklist] Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Request error',
      message: error.message,
    }));
  });
}

/**
 * Route handler for callback-worklist endpoints
 */
export function callbackWorklistRouter(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/callbacks') {
    return handleGetCallbacks(req, res);
  } else if (req.method === 'POST' && url.pathname === '/api/callbacks/tick') {
    return handleTickCallback(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
