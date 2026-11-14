// Browser-side form checks (spec S2, S3). The backend makes the final decision.
// Every number comes from src/config/limits.js (FR26).

import { EMAIL_MAX, NAME_MAX, NAME_MIN, PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES } from '../config/limits';

const encoder = new TextEncoder();

// Passwords are limited in UTF-8 bytes, not characters (spec S3).
export function byteLength(value) {
  return encoder.encode(value).length;
}

// A simple format check. The backend applies the full check.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value) {
  const name = value.trim();
  if (!name) return 'Enter your full name.';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return `Name must be ${NAME_MIN} to ${NAME_MAX} characters.`;
  }
  return null;
}

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'Enter your email.';
  if (email.length > EMAIL_MAX || !EMAIL_FORMAT.test(email)) return 'Enter a valid email address.';
  return null;
}

// Login only needs a password to be present (spec S2).
export function validatePasswordPresent(value) {
  return value ? null : 'Enter your password.';
}

// The three rows of the register checklist (spec S3). A row is met only once something is typed.
export function passwordChecks(password, confirmation) {
  const bytes = byteLength(password);
  return {
    min: bytes >= PASSWORD_MIN_BYTES,
    max: bytes > 0 && bytes <= PASSWORD_MAX_BYTES,
    match: password.length > 0 && password === confirmation,
  };
}

export function validateNewPassword(value) {
  const bytes = byteLength(value);
  if (bytes === 0) return 'Enter a password.';
  if (bytes < PASSWORD_MIN_BYTES || bytes > PASSWORD_MAX_BYTES) {
    return `Password must be ${PASSWORD_MIN_BYTES} to ${PASSWORD_MAX_BYTES} bytes.`;
  }
  return null;
}

export function validateConfirmation(password, confirmation) {
  return password === confirmation ? null : 'Passwords do not match.';
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * Splits a VALIDATION_ERROR into messages for known form fields and everything else.
 * The backend sends `details` as a list of { field: 'body.email', message } (one per bad field).
 * @returns {{ fields: Record<string, string>, unmatched: boolean }}
 *   unmatched is true when no message could be placed under a field, so the caller shows a banner.
 */
export function fieldErrorsFromDetails(details, knownFields) {
  const fields = {};
  if (Array.isArray(details)) {
    for (const item of details) {
      if (!item || typeof item.field !== 'string' || typeof item.message !== 'string') continue;
      const field = item.field.replace(/^body\./, '');
      if (knownFields.includes(field) && !fields[field]) fields[field] = capitalize(item.message);
    }
  }
  return { fields, unmatched: Object.keys(fields).length === 0 };
}
