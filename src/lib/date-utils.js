/**
 * date-utils.js - Date utilities for rolling windows and age calculations
 *
 * Implements:
 * - FR-002: Rolling 2-day window (today + yesterday)
 * - FR-010: Aged calls (>2 days old)
 *
 * All dates are in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
 */

/**
 * Get the start of the rolling 2-day window (now minus 2 days)
 *
 * @param {Date} [now=new Date()] - Current time (injectable for testing)
 * @returns {string} ISO 8601 timestamp for 2 days ago
 *
 * Example: If now is 2026-05-23T10:00:00Z, returns 2026-05-21T10:00:00Z
 */
export function getTwoDaysAgo(now = new Date()) {
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return twoDaysAgo.toISOString();
}

/**
 * Check if a call timestamp is aged (more than 2 days old)
 *
 * @param {string} timestamp - ISO 8601 timestamp to check
 * @param {Date} [now=new Date()] - Current time (injectable for testing)
 * @returns {boolean} True if timestamp is more than 2 days old
 *
 * Example:
 *   isAged("2026-05-20T10:00:00Z", new Date("2026-05-23T10:00:00Z")) → true
 *   isAged("2026-05-22T10:00:00Z", new Date("2026-05-23T10:00:00Z")) → false
 */
export function isAged(timestamp, now = new Date()) {
  const cutoff = getTwoDaysAgo(now);
  return timestamp < cutoff;
}

/**
 * Check if a call timestamp is within the rolling 2-day window
 *
 * @param {string} timestamp - ISO 8601 timestamp to check
 * @param {Date} [now=new Date()] - Current time (injectable for testing)
 * @returns {boolean} True if timestamp is within last 2 days
 */
export function isWithinTwoDays(timestamp, now = new Date()) {
  return !isAged(timestamp, now);
}

/**
 * Format a timestamp for display (human-readable)
 *
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {string} Formatted string (e.g., "23 May 2026, 10:30")
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '(no time)';
  }

  const date = new Date(timestamp);

  // Check if valid date
  if (isNaN(date.getTime())) {
    return '(invalid date)';
  }

  const options = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleString('en-GB', options);
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "yesterday")
 *
 * @param {string} timestamp - ISO 8601 timestamp
 * @param {Date} [now=new Date()] - Current time (injectable for testing)
 * @returns {string} Relative time string
 */
export function formatRelativeTime(timestamp, now = new Date()) {
  if (!timestamp) {
    return '(no time)';
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return '(invalid date)';
  }

  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return formatTimestamp(timestamp);
  }
}

/**
 * Get current timestamp in ISO 8601 format
 *
 * @returns {string} Current timestamp
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Parse a date string to ISO 8601 (handles various formats)
 *
 * @param {string} dateStr - Date string to parse
 * @returns {string|null} ISO 8601 timestamp or null if invalid
 */
export function parseDate(dateStr) {
  if (!dateStr) {
    return null;
  }

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}
