import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '../auth/returnTo';
import real from '../test/fixtures/real-backend-responses.json';
import {
  byteLength,
  fieldErrorsFromDetails,
  passwordChecks,
  validateConfirmation,
  validateEmail,
  validateName,
  validateNewPassword,
  validatePasswordPresent,
} from './validation';

describe('password byte rule (spec S3): UTF-8 bytes, not characters', () => {
  it('counts bytes for multi-byte characters', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('é')).toBe(2);
    expect(byteLength('€')).toBe(3);
    expect(byteLength('😀')).toBe(4);
  });

  it('4 characters of "é" are 8 bytes, which is long enough', () => {
    expect('éééé'.length).toBe(4);
    expect(passwordChecks('éééé', '').min).toBe(true);
    expect(validateNewPassword('éééé')).toBeNull();
  });

  it('3 characters of "é" are 6 bytes, which is too short', () => {
    expect(passwordChecks('ééé', '').min).toBe(false);
    expect(validateNewPassword('ééé')).toMatch(/8 to 72 bytes/);
  });

  it('two emoji are 8 bytes, which is long enough', () => {
    expect('😀😀'.length).toBe(4); // JavaScript counts 4 units, but the rule counts 8 bytes
    expect(validateNewPassword('😀😀')).toBeNull();
  });

  it('37 characters of "é" are 74 bytes, which is too long', () => {
    const password = 'é'.repeat(37);
    expect(password.length).toBe(37);
    expect(passwordChecks(password, '').max).toBe(false);
    expect(validateNewPassword(password)).toMatch(/8 to 72 bytes/);
  });

  it('36 characters of "é" are exactly 72 bytes, which is allowed', () => {
    expect(passwordChecks('é'.repeat(36), '').max).toBe(true);
    expect(validateNewPassword('é'.repeat(36))).toBeNull();
  });

  it('boundaries for plain letters: 7 and 73 fail, 8 and 72 pass', () => {
    expect(validateNewPassword('a'.repeat(7))).not.toBeNull();
    expect(validateNewPassword('a'.repeat(8))).toBeNull();
    expect(validateNewPassword('a'.repeat(72))).toBeNull();
    expect(validateNewPassword('a'.repeat(73))).not.toBeNull();
  });

  it('agrees with the real backend on the multi-byte cases', () => {
    // Saved from the real backend: 74 bytes rejected, 8 bytes accepted.
    expect(real.registerPasswordTooLongBytes.status).toBe(400);
    expect(real.registerPasswordMultiByteOk.status).toBe(201);
    expect(validateNewPassword('é'.repeat(37))).not.toBeNull();
    expect(validateNewPassword('éééé')).toBeNull();
  });

  it('no row is met for an empty password', () => {
    expect(passwordChecks('', '')).toEqual({ min: false, max: false, match: false });
  });

  it('the match row is met only when the confirmation equals the password', () => {
    expect(passwordChecks('correct-horse', 'correct-hors').match).toBe(false);
    expect(passwordChecks('correct-horse', 'correct-horse').match).toBe(true);
  });
});

describe('other field checks', () => {
  it('name is 2 to 50 characters after trimming', () => {
    expect(validateName('')).toBe('Enter your full name.');
    expect(validateName('   ')).toBe('Enter your full name.');
    expect(validateName(' A ')).toBe('Name must be 2 to 50 characters.');
    expect(validateName(' Al ')).toBeNull();
    expect(validateName('a'.repeat(50))).toBeNull();
    expect(validateName('a'.repeat(51))).toBe('Name must be 2 to 50 characters.');
  });

  it('email is required, has a valid format, and is at most 254 characters', () => {
    expect(validateEmail('')).toBe('Enter your email.');
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
    expect(validateEmail('a@b')).toBe('Enter a valid email address.');
    expect(validateEmail('alex@example.com')).toBeNull();
    expect(validateEmail(`${'a'.repeat(250)}@b.co`)).toBe('Enter a valid email address.');
  });

  it('login needs a password to be present', () => {
    expect(validatePasswordPresent('')).toBe('Enter your password.');
    expect(validatePasswordPresent('x')).toBeNull();
  });

  it('the confirmation must equal the password', () => {
    expect(validateConfirmation('abc', 'abd')).toBe('Passwords do not match.');
    expect(validateConfirmation('abc', 'abc')).toBeNull();
  });
});

describe('fieldErrorsFromDetails (shape saved from the real backend)', () => {
  it('puts each message under its field, without the "body." prefix', () => {
    const { details } = real.registerValidationAllBad.body.error;
    const { fields, unmatched } = fieldErrorsFromDetails(details, ['name', 'email', 'password']);
    expect(unmatched).toBe(false);
    expect(fields).toEqual({
      name: 'String must contain at least 2 character(s)',
      email: 'Invalid email',
      password: 'Must be 8 to 72 bytes long',
    });
  });

  it('is unmatched when details is missing, empty, or names unknown fields', () => {
    expect(fieldErrorsFromDetails(undefined, ['email']).unmatched).toBe(true);
    expect(fieldErrorsFromDetails(null, ['email']).unmatched).toBe(true);
    expect(fieldErrorsFromDetails([], ['email']).unmatched).toBe(true);
    expect(fieldErrorsFromDetails([{ field: 'body.other', message: 'x' }], ['email']).unmatched).toBe(true);
    expect(fieldErrorsFromDetails('nope', ['email']).unmatched).toBe(true);
  });

  it('ignores malformed items', () => {
    const { fields } = fieldErrorsFromDetails([null, { field: 1 }, { field: 'body.email', message: 'Invalid email' }], ['email']);
    expect(fields).toEqual({ email: 'Invalid email' });
  });
});

describe('safeReturnTo', () => {
  it.each([
    ['/rounds', '/rounds'],
    ['/rounds?page=2', '/rounds?page=2'],
    ['/rounds/abc/report', '/rounds/abc/report'],
  ])('accepts %s', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'rounds', 'https://evil.example', '//evil.example', '/\\evil.example', 42])(
    'rejects %j',
    (input) => {
      expect(safeReturnTo(input)).toBeNull();
    },
  );
});
