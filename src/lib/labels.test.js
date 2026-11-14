import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDuration, plural } from './format';
import { difficultyLabel, endedLabel, slotStatus, topicLabel } from './labels';

describe('formatDateTime: local time as `11 Nov 2026, 13:20` (FR17)', () => {
  it('formats a UTC instant in the browser local time', () => {
    const local = new Date(2026, 10, 11, 13, 20); // 11 Nov 2026, 13:20 local
    expect(formatDateTime(local.toISOString())).toBe('11 Nov 2026, 13:20');
  });
  it('pads hours and minutes but not the day', () => {
    const local = new Date(2026, 0, 5, 7, 4);
    expect(formatDateTime(local.toISOString())).toBe('5 Jan 2026, 07:04');
  });
  it('uses 24-hour time', () => {
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe('31 Dec 2026, 23:59');
  });
  it('shows a dash for a missing or invalid time', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
  });
});

describe('formatDuration and plural (FR19)', () => {
  it('shows minutes', () => {
    expect(formatDuration(60)).toBe('60 min');
    expect(formatDuration(5)).toBe('5 min');
  });
  it('pluralises', () => {
    expect(plural(1, 'problem')).toBe('1 problem');
    expect(plural(0, 'problem')).toBe('0 problems');
    expect(plural(4, 'question')).toBe('4 questions');
  });
});

describe('topicLabel: topics come from E5 as keys, shown with a capital first letter', () => {
  it.each([
    ['arrays', 'Arrays'],
    ['hashing', 'Hashing'],
    ['two-pointers', 'Two pointers'],
    ['dynamic_programming', 'Dynamic programming'],
  ])('%s is shown as %s', (key, label) => {
    expect(topicLabel(key)).toBe(label);
  });
});

describe('difficultyLabel', () => {
  it('maps the three difficulties', () => {
    expect(['easy', 'medium', 'hard'].map(difficultyLabel)).toEqual(['Easy', 'Medium', 'Hard']);
  });
});

describe('endedLabel (spec S6, Ended column)', () => {
  it('EXPIRED is Time ran out', () => {
    expect(endedLabel({ status: 'FINISHED', finishReason: 'EXPIRED' })).toBe('Time ran out');
  });
  it('MANUAL is Finished by you', () => {
    expect(endedLabel({ status: 'FINISHED', finishReason: 'MANUAL' })).toBe('Finished by you');
  });
  it('READY and ACTIVE rows show a dash', () => {
    expect(endedLabel({ status: 'READY', finishReason: null })).toBe('—');
    expect(endedLabel({ status: 'ACTIVE', finishReason: null })).toBe('—');
  });
});

describe('slotStatus (spec S4)', () => {
  const slot = (extra) => ({ opened: false, solved: false, runCount: 0, submitCount: 0, ...extra });
  it('Not opened: opened is false', () => expect(slotStatus(slot({}))).toBe('Not opened'));
  it('Opened: opened, no runs or submits, not solved', () => expect(slotStatus(slot({ opened: true }))).toBe('Opened'));
  it('Attempted: runs plus submits above 0, not solved', () => {
    expect(slotStatus(slot({ opened: true, runCount: 2 }))).toBe('Attempted');
    expect(slotStatus(slot({ opened: true, submitCount: 1 }))).toBe('Attempted');
  });
  it('Solved: solved is true, whatever the counters say', () => {
    expect(slotStatus(slot({ opened: true, solved: true, runCount: 3, submitCount: 1 }))).toBe('Solved');
  });
});
