/**
 * phone-mask.js - Phone number masking utility
 *
 * Implements FR-036: Mask phone numbers showing only last 4 digits
 * Format: +44 *** **** 1234
 *
 * Privacy requirement: Prevents accidental disclosure of full phone numbers
 */

/**
 * Mask a UK phone number showing only last 4 digits
 *
 * @param {string|null} phoneNumber - Phone number to mask (e.g., "+447700900123")
 * @returns {string} Masked phone number (e.g., "+44 *** **** 0123")
 *
 * Examples:
 *   +447700900123 → +44 *** **** 0123
 *   +441234567890 → +44 *** **** 7890
 *   07700900123   → *** **** 0123
 *   null          → (no number)
 *   ""            → (no number)
 */
export function maskPhone(phoneNumber) {
  // Handle null/empty cases
  if (!phoneNumber || phoneNumber === '') {
    return '(no number)';
  }

  const phone = String(phoneNumber).trim();

  // Extract last 4 digits
  const last4 = phone.slice(-4);

  // Determine country code prefix
  if (phone.startsWith('+44')) {
    return `+44 *** **** ${last4}`;
  } else if (phone.startsWith('44')) {
    return `+44 *** **** ${last4}`;
  } else if (phone.startsWith('07') || phone.startsWith('01')) {
    // UK mobile or landline without country code
    return `*** **** ${last4}`;
  } else {
    // Unknown format, still mask
    return `*** **** ${last4}`;
  }
}

/**
 * Unmask a phone number for database queries (if needed)
 * Note: In Phase A, we don't store masked numbers in DB, so this is just for reference
 *
 * @param {string} maskedNumber - Masked number
 * @returns {string|null} Original number (not recoverable from mask)
 */
export function unmaskPhone(maskedNumber) {
  // Cannot unmask - this is one-way transformation
  // Only used for display, never stored
  throw new Error('Phone numbers cannot be unmasked - masking is one-way for privacy');
}

/**
 * Validate UK phone number format (basic check)
 *
 * @param {string} phoneNumber
 * @returns {boolean} True if valid UK format
 */
export function isValidUKPhone(phoneNumber) {
  if (!phoneNumber || phoneNumber === '') {
    return false;
  }

  const phone = String(phoneNumber).trim();

  // UK mobile: +447xxx or 07xxx (10-11 digits)
  // UK landline: +441xxx or 01xxx, +442xxx or 02xxx (10-11 digits)
  const ukMobileRegex = /^(\+44|0)7\d{9}$/;
  const ukLandlineRegex = /^(\+44|0)[12]\d{9}$/;

  return ukMobileRegex.test(phone) || ukLandlineRegex.test(phone);
}
