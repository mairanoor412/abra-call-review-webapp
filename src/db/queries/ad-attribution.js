/**
 * ad-attribution.js - Query Google Ads call attribution data
 *
 * Implements FR-017 through FR-019:
 * - Fetch ad_calls joined with recordings/transcripts/classifications
 * - Calculate headline metrics (total, Haiku NEW count, human confirmed, spend, cost per confirmed)
 * - Handle 94.3% of cases where matched_call_id = -1 (no recording)
 */

import { getCommsDb } from '../comms.js';
import { getReviewsDb } from '../reviews.js';
import { maskPhone } from '../../lib/phone-mask.js';
import { formatTimestamp } from '../../lib/date-utils.js';
import { timer, db as dbLogger } from '../../lib/logger.js';

/**
 * Fetch ad calls with attribution data for a specific date
 *
 * @param {Object} options
 * @param {string} [options.date] - Date in YYYY-MM-DD format (default: yesterday)
 * @param {string} [options.practice] - Practice filter or 'all'
 * @param {boolean} [options.unreviewed_only=true] - Show only unreviewed calls
 * @param {boolean} [options.new_patient_only=false] - Show only NEW_PATIENT classifications
 * @returns {Object} Ad calls with headline metrics
 */
export function fetchAdAttribution(options = {}) {
  const {
    date = getYesterday(),
    practice = 'all',
    unreviewed_only = true,
    new_patient_only = false,
  } = options;

  const elapsed = timer();
  const commsDb = getCommsDb();
  const reviewsDb = getReviewsDb();

  // Build WHERE clauses
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

  // FR-017: Query ad_calls joined to recordings → transcripts → classifications
  // Adapted for Sohail's database schema
  const adCallsQuery = `
    SELECT
      ac.id as ad_call_id,
      ac.caller_number,
      ac.call_time,
      ac.practice,
      ac.campaign as ad_campaign,
      ac.call_type,
      ac.call_source,
      ac.status as ad_status,
      ac.matched_call_id,
      ac.duration_sec,
      c.id as call_id,
      r.id as recording_id,
      r.filepath as file_path,
      t.text as transcript,
      cl.type as classification,
      cl.promised_callback
    FROM ad_calls ac
    LEFT JOIN calls c ON ac.matched_call_id = c.call_id
    LEFT JOIN recordings_v2 r ON c.call_id = r.call_id
    LEFT JOIN transcripts t ON r.id = t.recording_id
    LEFT JOIN classifications cl ON t.id = cl.transcript_id
    WHERE ac.call_time LIKE ?
      AND ac.call_time LIKE '2026-%'
      ${practiceWhere}
    ORDER BY ac.call_time DESC
  `;

  const params = practiceParam
    ? [`${date}%`, practiceParam]
    : [`${date}%`];

  const adCalls = commsDb.prepare(adCallsQuery).all(...params);

  // Get reviewed ad_call_ids from reviews.db
  const reviewedIds = new Set(
    reviewsDb
      .prepare('SELECT ad_call_id FROM ad_call_reviews')
      .all()
      .map(row => row.ad_call_id)
  );

  // Get review decisions for ad calls
  const reviews = new Map();
  reviewsDb
    .prepare('SELECT ad_call_id, decision, notes, reviewed_at FROM ad_call_reviews')
    .all()
    .forEach(row => {
      reviews.set(row.ad_call_id, {
        decision: row.decision,
        notes: row.notes,
        reviewed_at: row.reviewed_at,
      });
    });

  // Process ad calls and apply filters
  let processedCalls = adCalls.map(call => {
    const isReviewed = reviewedIds.has(call.ad_call_id);
    const review = reviews.get(call.ad_call_id);

    return {
      ad_call_id: call.ad_call_id,
      caller_number: call.caller_number,
      masked_phone: maskPhone(call.caller_number),
      call_time: call.call_time,
      call_time_formatted: formatTimestamp(call.call_time),
      practice: call.practice || 'unattributed',
      campaign: call.ad_campaign,
      ad_group: call.ad_group,
      keyword: call.keyword,
      match_type: call.match_type,
      spend_gbp: call.spend_gbp,
      duration_sec: call.duration_sec || 0,
      duration_formatted: formatDuration(call.duration_sec || 0),
      // FR-019: Handle matched_call_id = -1 cases (94.3%)
      matched_call_id: call.matched_call_id || -1,
      has_recording: call.recording_id !== null,
      has_transcript: call.transcript !== null,
      transcript_text: call.transcript || null,
      classification_type: call.classification || null,
      is_new_patient: call.classification === 'new_patient',
      is_unclear: call.classification === 'unclear',
      is_reviewed: isReviewed,
      review_decision: review?.decision || null,
      review_notes: review?.notes || null,
      reviewed_at: review?.reviewed_at || null,
    };
  });

  // Apply filters
  if (unreviewed_only) {
    processedCalls = processedCalls.filter(call => !call.is_reviewed);
  }

  if (new_patient_only) {
    processedCalls = processedCalls.filter(call => call.is_new_patient);
  }

  // FR-018: Calculate headline metrics
  const metrics = calculateHeadlineMetrics(adCalls, reviews, date);

  const duration = elapsed();
  dbLogger.query('comms+reviews', 'SELECT ad_calls', duration, { count: processedCalls.length });  // FR-038
  console.log(`[ad-attribution] Fetched ${processedCalls.length} ad calls in ${duration}ms`);

  return {
    ad_calls: processedCalls,
    metrics,
    filters: {
      date,
      practice,
      unreviewed_only,
      new_patient_only,
    },
  };
}

/**
 * FR-018: Calculate headline metrics
 *
 * @param {Array} adCalls - Raw ad calls from database
 * @param {Map} reviews - Map of ad_call_id to review data
 * @param {string} date - Date for ad spend lookup
 * @returns {Object} Headline metrics
 */
function calculateHeadlineMetrics(adCalls, reviews, date) {
  const totalAdCalls = adCalls.length;

  // Haiku-classified NEW patient count
  const haikuNewPatientCount = adCalls.filter(
    call => call.classification === 'new_patient'
  ).length;

  // Human-confirmed new patient count
  const humanConfirmedCount = Array.from(reviews.values()).filter(
    review => review.decision === 'new_patient'
  ).length;

  // Ad spend (sum spend_gbp for this date)
  const adSpend = adCalls.reduce((sum, call) => sum + (call.spend_gbp || 0), 0);

  // Cost per confirmed new patient
  const costPerConfirmed = humanConfirmedCount > 0
    ? adSpend / humanConfirmedCount
    : null;

  return {
    total_ad_calls: totalAdCalls,
    haiku_new_patient_count: haikuNewPatientCount,
    human_confirmed_count: humanConfirmedCount,
    ad_spend_gbp: parseFloat(adSpend.toFixed(2)),
    cost_per_confirmed: costPerConfirmed ? parseFloat(costPerConfirmed.toFixed(2)) : null,
  };
}

/**
 * Format duration in seconds to "Xm Ys" format
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) {
    return '0s';
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 *
 * @returns {string}
 */
function getYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Get ad attribution stats
 *
 * @returns {Object} Overall stats
 */
export function getAdAttributionStats() {
  const commsDb = getCommsDb();

  const totalAdCalls = commsDb
    .prepare('SELECT COUNT(*) as count FROM ad_calls')
    .get().count;

  const matchedCalls = commsDb
    .prepare("SELECT COUNT(*) as count FROM ad_calls WHERE matched_call_id IS NOT NULL AND matched_call_id != '-1'")
    .get().count;

  const unmatchedCalls = commsDb
    .prepare("SELECT COUNT(*) as count FROM ad_calls WHERE matched_call_id IS NULL OR matched_call_id = '-1'")
    .get().count;

  const matchRate = totalAdCalls > 0
    ? ((matchedCalls / totalAdCalls) * 100).toFixed(1)
    : 0;

  return {
    total_ad_calls: totalAdCalls,
    matched_calls: matchedCalls,
    unmatched_calls: unmatchedCalls,
    match_rate_percent: parseFloat(matchRate),
  };
}
