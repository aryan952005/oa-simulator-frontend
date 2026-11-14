import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCountdown, getOffsetMs, remainingMs, resetClock, serverNow, syncClock } from './clock';

const SERVER = new Date('2026-11-12T10:00:00.000Z');
const MIN = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  resetClock();
});
afterEach(() => vi.useRealTimers());

// The laptop clock is `skewMs` away from the server clock.
const laptopIs = (skewMs) => vi.setSystemTime(new Date(SERVER.getTime() + skewMs));

describe('syncClock and remainingMs (FR11 to FR13)', () => {
  it('offsetMs is the server time minus the laptop time, measured when the response arrives (FR12)', () => {
    laptopIs(10 * MIN);
    syncClock(SERVER.toISOString());
    expect(getOffsetMs()).toBe(-10 * MIN);
  });

  it('remaining time is the deadline minus (laptop time + offset) (FR13)', () => {
    laptopIs(0);
    syncClock(SERVER.toISOString());
    const deadline = new Date(SERVER.getTime() + 30 * MIN).toISOString();
    expect(remainingMs(deadline)).toBe(30 * MIN);
  });

  it.each([
    ['10 minutes ahead', 10 * MIN],
    ['10 minutes behind', -10 * MIN],
    ['two hours ahead', 120 * MIN],
    ['exactly right', 0],
  ])('still matches the server when the laptop clock is %s', (_label, skew) => {
    laptopIs(skew);
    syncClock(SERVER.toISOString());
    const deadline = new Date(SERVER.getTime() + 30 * MIN).toISOString();
    expect(remainingMs(deadline)).toBe(30 * MIN);
    expect(formatCountdown(remainingMs(deadline))).toBe('30:00');
  });

  it('keeps counting with the laptop clock between two requests', () => {
    laptopIs(10 * MIN);
    syncClock(SERVER.toISOString());
    const deadline = new Date(SERVER.getTime() + 30 * MIN).toISOString();
    vi.advanceTimersByTime(90 * 1000);
    expect(remainingMs(deadline)).toBe(30 * MIN - 90 * 1000);
  });

  it('a later response corrects the offset (a changed laptop clock is corrected by the next response)', () => {
    laptopIs(10 * MIN);
    syncClock(SERVER.toISOString());
    const deadline = new Date(SERVER.getTime() + 30 * MIN).toISOString();
    // The student changes the laptop clock by another hour. The next response sets the offset again.
    vi.setSystemTime(new Date(Date.now() + 60 * MIN));
    expect(remainingMs(deadline)).not.toBe(30 * MIN);
    syncClock(SERVER.toISOString());
    expect(remainingMs(deadline)).toBe(30 * MIN);
  });

  it('is never below 0', () => {
    laptopIs(0);
    syncClock(SERVER.toISOString());
    expect(remainingMs(new Date(SERVER.getTime() - 5000).toISOString())).toBe(0);
    expect(remainingMs(SERVER.toISOString())).toBe(0);
  });

  it('is 0 for a deadline that is not a date', () => {
    expect(remainingMs('nonsense')).toBe(0);
    expect(remainingMs(null)).toBe(0);
  });

  it('ignores a serverTime that is not a date', () => {
    laptopIs(0);
    syncClock(SERVER.toISOString());
    syncClock('nonsense');
    expect(getOffsetMs()).toBe(0);
  });

  it('serverNow is the laptop time plus the offset', () => {
    laptopIs(7 * MIN);
    syncClock(SERVER.toISOString());
    expect(serverNow()).toBe(SERVER.getTime());
  });

  it('resetClock sets the offset back to 0', () => {
    laptopIs(7 * MIN);
    syncClock(SERVER.toISOString());
    resetClock();
    expect(getOffsetMs()).toBe(0);
  });
});

describe('formatCountdown: MM:SS, or H:MM:SS over an hour (spec S8)', () => {
  it.each([
    [0, '00:00'],
    [-5000, '00:00'],
    [1, '00:01'], // a part of a second still counts as a second
    [999, '00:01'],
    [1000, '00:01'],
    [1001, '00:02'],
    [59 * 1000, '00:59'],
    [60 * 1000, '01:00'],
    [(38 * 60 + 24) * 1000, '38:24'],
    [(59 * 60 + 59) * 1000, '59:59'],
    [3600 * 1000, '1:00:00'],
    [(3600 + 61) * 1000, '1:01:01'],
    [(2 * 3600 + 5 * 60 + 9) * 1000, '2:05:09'],
    [180 * 60 * 1000, '3:00:00'],
  ])('%i ms is %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
