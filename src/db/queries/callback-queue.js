/**
 * callback-queue.js - Query missed calls needing callbacks
 *
 * Implements FR-001 through FR-006:
 * - Fetch missed/unanswered inbound calls from last 2 days
 * - Exclude calls with outbound follow-ups
 * - Exclude calls already actioned in reviews.db
 * - Deduplicate by caller_number
 * - Join with recordings/transcripts/classifications
 */

import { getCommsDb } from '../comms.js';
import { getReviewsDb } from '../reviews.js';
import { getTwoDaysAgo } from '../../lib/date-utils.js';
import { maskPhone } from '../../lib/phone-mask.js';
import { timer, db as dbLogger } from '../../lib/logger.js';

/**
 * Fetch callback queue for a specific practice or all
 *
 * @param {Object} options
 * @param {string} [options.practice] - Practice filter (middleton, cheadle, etc., or 'all')
 * @param {boolean} [options.aged=false] - If true, only return calls >2 days old
 * @returns {Array} List of callbacks needed
 */
export function fetchCallbackQueue(options = {}) {
  const { practice = 'all', aged = false } = options;
  const elapsed = timer();

  const commsDb = getCommsDb();
  const reviewsDb = getReviewsDb();

  // FR-002: Calculate time window
  const twoDaysAgo = getTwoDaysAgo();

  // Build WHERE clause for practice filter
  let practiceWhere = '';
  let practiceParam = null;

  if (practice !== 'all') {
    if (practice === 'unattributed') {
      practiceWhere = 'AND c.practice IS NULL';
    } else {
      practiceWhere = 'AND c.practice = ?';
      practiceParam = practice;
    }
  }

  // FR-001, FR-002: Fetch missed calls from comms.db
  // Criteria: inbound, within time window, unanswered or short duration or redirected
  // Adapted for Sohail's database schema
  const missedCallsQuery = `
    SELECT
      c.id as call_id,
      c.call_id as external_call_id,
      c.caller_number,
      c.practice,
      c.call_time,
      c.status,
      c.talking_sec as duration_sec,
      r.id as recording_id,
      r.filepath as file_path,
      t.text as transcript,
      cl.type as classification,
      cl.promised_callback
    FROM calls c
    LEFT JOIN recordings_v2 r ON c.call_id = r.call_id
    LEFT JOIN transcripts t ON r.id = t.recording_id
    LEFT JOIN classifications cl ON t.id = cl.transcript_id
    WHERE c.direction = 'inbound'
      AND c.call_time >= ?
      AND c.call_time LIKE '2026-%'
      ${practiceWhere}
      AND (
        c.status = 'unanswered'
        OR c.status = 'redirected'
        OR (c.status = 'answered' AND c.talking_sec < 10)
      )
    ORDER BY c.call_time DESC
  `;

  const params = practiceParam
    ? [twoDaysAgo, practiceParam]
    : [twoDaysAgo];

  const missedCalls = commsDb.prepare(missedCallsQuery).all(...params);

  // FR-003: Get caller numbers with subsequent outbound calls
  const outboundCallersQuery = `
    SELECT DISTINCT caller_number
    FROM calls
    WHERE direction = 'outbound'
      AND call_time >= ?
  `;
  const outboundCallers = new Set(
    commsDb
      .prepare(outboundCallersQuery)
      .all(twoDaysAgo)
      .map(row => row.caller_number)
  );

  // FR-004: Get caller numbers already actioned in reviews.db
  const actionedCallersQuery = `
    SELECT DISTINCT caller_number
    FROM callback_actions
    WHERE actioned_at >= ?
  `;
  const actionedCallers = new Set(
    reviewsDb
      .prepare(actionedCallersQuery)
      .all(twoDaysAgo)
      .map(row => row.caller_number)
  );

  // FR-005: Deduplicate by caller_number, aggregate attempt count
  const callbackMap = new Map();

  for (const call of missedCalls) {
    const { caller_number } = call;

    // FR-003: Skip if outbound call exists
    if (outboundCallers.has(caller_number)) {
      continue;
    }

    // FR-004: Skip if already actioned
    if (actionedCallers.has(caller_number)) {
      continue;
    }

    // FR-005: Deduplicate - keep most recent call per caller
    if (!callbackMap.has(caller_number)) {
      callbackMap.set(caller_number, {
        caller_number,
        masked_phone: maskPhone(caller_number),
        practice: call.practice || 'unattributed',
        most_recent_call_time: call.call_time,
        attempt_count: 1,
        total_duration_sec: call.duration_sec || 0,
        has_recording: call.recording_id !== null,
        has_transcript: call.transcript !== null,
        transcript_snippet: call.transcript
          ? call.transcript.substring(0, 150) + (call.transcript.length > 150 ? '...' : '')
          : null,
        classification: call.classification || null,
        is_new_patient: call.classification === 'new_patient',
        reason: call.status === 'unanswered' ? 'unanswered' : (call.status === 'redirected' ? 'redirected' : 'short_call'),
      });
    } else {
      // Increment attempt count for this caller
      const existing = callbackMap.get(caller_number);
      existing.attempt_count++;
      existing.total_duration_sec += call.duration_sec || 0;

      // Keep the most recent transcript if available
      if (!existing.has_transcript && call.transcript) {
        existing.has_transcript = true;
        existing.transcript_snippet = call.transcript.substring(0, 150) + (call.transcript.length > 150 ? '...' : '');
        existing.classification = call.classification;
        existing.is_new_patient = call.classification === 'new_patient';
      }
    }
  }

  // Convert map to array and apply sorting
  let callbacks = Array.from(callbackMap.values());

  // FR-008: Sort - NEW_PATIENT first, then by duration descending
  callbacks.sort((a, b) => {
    if (a.is_new_patient && !b.is_new_patient) return -1;
    if (!a.is_new_patient && b.is_new_patient) return 1;
    return b.total_duration_sec - a.total_duration_sec;
  });

  const duration = elapsed();
  dbLogger.query('comms+reviews', 'SELECT callbacks', duration, { count: callbacks.length });  // FR-038
  console.log(`[callback-queue] Fetched ${callbacks.length} callbacks in ${duration}ms`);

  return callbacks;
}

/**
 * Get callback queue statistics
 *
 * @returns {Object} Stats about callback queue
 */
export function getCallbackStats() {
  const commsDb = getCommsDb();
  const reviewsDb = getReviewsDb();
  const twoDaysAgo = getTwoDaysAgo();

  const totalMissed = commsDb
    .prepare(
      `SELECT COUNT(*) as count FROM calls
       WHERE direction = 'inbound'
         AND call_time >= ?
         AND (status = 'unanswered' OR status = 'redirected')`
    )
    .get(twoDaysAgo).count;

  const totalActioned = reviewsDb
    .prepare(
      `SELECT COUNT(*) as count FROM callback_actions
       WHERE actioned_at >= ?`
    )
    .get(twoDaysAgo).count;

  const unattributed = commsDb
    .prepare(
      `SELECT COUNT(*) as count FROM calls
       WHERE direction = 'inbound'
         AND call_time >= ?
         AND practice IS NULL`
    )
    .get(twoDaysAgo).count;

  return {
    total_missed: totalMissed,
    total_actioned: totalActioned,
    total_pending: totalMissed - totalActioned,
    unattributed_count: unattributed,
  };
}
