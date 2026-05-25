/**
 * Unit tests for date-utils.js
 *
 * Tests:
 * - FR-002: Rolling 2-day window calculation
 * - FR-010: Aged call detection (>2 days)
 *
 * Coverage:
 * - Today timestamps
 * - Yesterday timestamps
 * - 2 days ago timestamps (boundary case)
 * - 3+ days ago timestamps (aged)
 * - Timestamp formatting
 * - Relative time formatting
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTwoDaysAgo,
  isAged,
  isWithinTwoDays,
  formatTimestamp,
  formatRelativeTime,
  now,
  parseDate,
} from '../../src/lib/date-utils.js';

// Fixed reference time for consistent testing
const NOW = new Date('2026-05-23T10:00:00.000Z');

test('getTwoDaysAgo - returns timestamp exactly 2 days ago', () => {
  const result = getTwoDaysAgo(NOW);
  const expected = new Date('2026-05-21T10:00:00.000Z').toISOString();
  assert.equal(result, expected);
});

test('getTwoDaysAgo - with different reference time', () => {
  const customNow = new Date('2026-01-15T14:30:00.000Z');
  const result = getTwoDaysAgo(customNow);
  const expected = new Date('2026-01-13T14:30:00.000Z').toISOString();
  assert.equal(result, expected);
});

test('isAged - timestamp from today is NOT aged', () => {
  const today = new Date('2026-05-23T09:00:00.000Z').toISOString();
  assert.equal(isAged(today, NOW), false);
});

test('isAged - timestamp from yesterday is NOT aged', () => {
  const yesterday = new Date('2026-05-22T10:00:00.000Z').toISOString();
  assert.equal(isAged(yesterday, NOW), false);
});

test('isAged - timestamp from 2 days ago (boundary) is NOT aged', () => {
  const twoDaysAgo = new Date('2026-05-21T10:00:00.000Z').toISOString();
  assert.equal(isAged(twoDaysAgo, NOW), false);
});

test('isAged - timestamp from 2 days ago minus 1 second is aged', () => {
  const justOverTwoDays = new Date('2026-05-21T09:59:59.000Z').toISOString();
  assert.equal(isAged(justOverTwoDays, NOW), true);
});

test('isAged - timestamp from 3 days ago IS aged', () => {
  const threeDaysAgo = new Date('2026-05-20T10:00:00.000Z').toISOString();
  assert.equal(isAged(threeDaysAgo, NOW), true);
});

test('isAged - timestamp from 1 week ago IS aged', () => {
  const oneWeekAgo = new Date('2026-05-16T10:00:00.000Z').toISOString();
  assert.equal(isAged(oneWeekAgo, NOW), true);
});

test('isWithinTwoDays - today is within window', () => {
  const today = new Date('2026-05-23T09:00:00.000Z').toISOString();
  assert.equal(isWithinTwoDays(today, NOW), true);
});

test('isWithinTwoDays - yesterday is within window', () => {
  const yesterday = new Date('2026-05-22T10:00:00.000Z').toISOString();
  assert.equal(isWithinTwoDays(yesterday, NOW), true);
});

test('isWithinTwoDays - 3 days ago is NOT within window', () => {
  const threeDaysAgo = new Date('2026-05-20T10:00:00.000Z').toISOString();
  assert.equal(isWithinTwoDays(threeDaysAgo, NOW), false);
});

test('formatTimestamp - formats ISO timestamp correctly', () => {
  const timestamp = '2026-05-23T14:30:00.000Z';
  const result = formatTimestamp(timestamp);
  // Expected format: "23 May 2026, HH:MM" (time will vary by timezone)
  assert.match(result, /23.*May.*2026.*\d{2}:\d{2}/);
});

test('formatTimestamp - handles null input', () => {
  const result = formatTimestamp(null);
  assert.equal(result, '(no time)');
});

test('formatTimestamp - handles invalid date', () => {
  const result = formatTimestamp('invalid-date');
  assert.equal(result, '(invalid date)');
});

test('formatRelativeTime - just now (less than 1 minute)', () => {
  const recent = new Date(NOW.getTime() - 30 * 1000).toISOString(); // 30 seconds ago
  const result = formatRelativeTime(recent, NOW);
  assert.equal(result, 'just now');
});

test('formatRelativeTime - minutes ago', () => {
  const fiveMinsAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
  const result = formatRelativeTime(fiveMinsAgo, NOW);
  assert.equal(result, '5 mins ago');
});

test('formatRelativeTime - 1 minute ago (singular)', () => {
  const oneMinAgo = new Date(NOW.getTime() - 1 * 60 * 1000).toISOString();
  const result = formatRelativeTime(oneMinAgo, NOW);
  assert.equal(result, '1 min ago');
});

test('formatRelativeTime - hours ago', () => {
  const twoHoursAgo = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const result = formatRelativeTime(twoHoursAgo, NOW);
  assert.equal(result, '2 hours ago');
});

test('formatRelativeTime - 1 hour ago (singular)', () => {
  const oneHourAgo = new Date(NOW.getTime() - 1 * 60 * 60 * 1000).toISOString();
  const result = formatRelativeTime(oneHourAgo, NOW);
  assert.equal(result, '1 hour ago');
});

test('formatRelativeTime - yesterday', () => {
  const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const result = formatRelativeTime(yesterday, NOW);
  assert.equal(result, 'yesterday');
});

test('formatRelativeTime - days ago', () => {
  const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const result = formatRelativeTime(threeDaysAgo, NOW);
  assert.equal(result, '3 days ago');
});

test('formatRelativeTime - over 7 days ago shows formatted date', () => {
  const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const result = formatRelativeTime(tenDaysAgo, NOW);
  // Should return formatted timestamp instead of relative time
  assert.match(result, /May 2026/);
});

test('formatRelativeTime - handles null input', () => {
  const result = formatRelativeTime(null, NOW);
  assert.equal(result, '(no time)');
});

test('formatRelativeTime - handles invalid date', () => {
  const result = formatRelativeTime('invalid-date', NOW);
  assert.equal(result, '(invalid date)');
});

test('now - returns ISO 8601 timestamp', () => {
  const result = now();
  // Check format: YYYY-MM-DDTHH:mm:ss.sssZ
  assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('parseDate - parses valid ISO timestamp', () => {
  const input = '2026-05-23T10:00:00.000Z';
  const result = parseDate(input);
  assert.equal(result, input);
});

test('parseDate - parses date-only string', () => {
  const input = '2026-05-23';
  const result = parseDate(input);
  assert.match(result, /2026-05-23/);
});

test('parseDate - handles null input', () => {
  const result = parseDate(null);
  assert.equal(result, null);
});

test('parseDate - handles empty string', () => {
  const result = parseDate('');
  assert.equal(result, null);
});

test('parseDate - handles invalid date', () => {
  const result = parseDate('not-a-date');
  assert.equal(result, null);
});
