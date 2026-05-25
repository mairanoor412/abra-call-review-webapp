/**
 * Unit tests for phone-mask.js
 *
 * Tests FR-036: Phone number masking (+44 *** **** [last4])
 *
 * Coverage:
 * - UK mobile numbers (07xxx)
 * - UK landline numbers (01xxx, 02xxx)
 * - Numbers with +44 prefix
 * - Numbers without country code
 * - Null/empty cases
 * - Edge cases
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskPhone, isValidUKPhone } from '../../src/lib/phone-mask.js';

test('maskPhone - UK mobile with +44 prefix', () => {
  const result = maskPhone('+447700900123');
  assert.equal(result, '+44 *** **** 0123');
});

test('maskPhone - UK mobile without + prefix', () => {
  const result = maskPhone('447700900123');
  assert.equal(result, '+44 *** **** 0123');
});

test('maskPhone - UK mobile with 07 prefix', () => {
  const result = maskPhone('07700900123');
  assert.equal(result, '*** **** 0123');
});

test('maskPhone - UK landline with +44 prefix (London)', () => {
  const result = maskPhone('+442012345678');
  assert.equal(result, '+44 *** **** 5678');
});

test('maskPhone - UK landline with 01 prefix', () => {
  const result = maskPhone('01234567890');
  assert.equal(result, '*** **** 7890');
});

test('maskPhone - UK landline with 02 prefix', () => {
  const result = maskPhone('02012345678');
  assert.equal(result, '*** **** 5678');
});

test('maskPhone - null input', () => {
  const result = maskPhone(null);
  assert.equal(result, '(no number)');
});

test('maskPhone - empty string', () => {
  const result = maskPhone('');
  assert.equal(result, '(no number)');
});

test('maskPhone - undefined input', () => {
  const result = maskPhone(undefined);
  assert.equal(result, '(no number)');
});

test('maskPhone - short number (less than 4 digits)', () => {
  const result = maskPhone('123');
  assert.equal(result, '*** **** 123');
});

test('maskPhone - number with spaces preserves spacing in last 4', () => {
  const result = maskPhone('+44 7700 900 123');
  // Last 4 chars are " 123" (includes space before 1)
  assert.equal(result, '+44 *** ****  123');
});

test('maskPhone - preserves last 4 characters exactly', () => {
  const result = maskPhone('+447700900001');
  assert.equal(result, '+44 *** **** 0001');
});

test('isValidUKPhone - valid UK mobile with +44', () => {
  assert.equal(isValidUKPhone('+447700900123'), true);
});

test('isValidUKPhone - valid UK mobile with 07', () => {
  assert.equal(isValidUKPhone('07700900123'), true);
});

test('isValidUKPhone - valid UK landline with +44', () => {
  assert.equal(isValidUKPhone('+442012345678'), true);
});

test('isValidUKPhone - valid UK landline with 01', () => {
  assert.equal(isValidUKPhone('01234567890'), true);
});

test('isValidUKPhone - valid UK landline with 02', () => {
  assert.equal(isValidUKPhone('02012345678'), true);
});

test('isValidUKPhone - invalid: too short', () => {
  assert.equal(isValidUKPhone('07700'), false);
});

test('isValidUKPhone - invalid: wrong country code', () => {
  assert.equal(isValidUKPhone('+15551234567'), false);
});

test('isValidUKPhone - invalid: null', () => {
  assert.equal(isValidUKPhone(null), false);
});

test('isValidUKPhone - invalid: empty string', () => {
  assert.equal(isValidUKPhone(''), false);
});

test('isValidUKPhone - invalid: non-UK number', () => {
  assert.equal(isValidUKPhone('9876543210'), false);
});
