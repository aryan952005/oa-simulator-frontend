import { describe, expect, it } from 'vitest';
import { formatLongMinutes, formatSecondsAsMinutes, formatSpeed } from './format';
import { FAILURE_LABEL, FLAG_LABEL, GRADE_LABEL, GRADE_TONE, RESULT_LABEL, insightTone } from './labels';
import { axisTicks, filledMinutes, wholeMinutes } from './report';

describe('S10 grade labels and tones', () => {
  it('uses exactly the labels of the spec', () => {
    expect(GRADE_LABEL).toEqual({
      EXCELLENT: 'Excellent',
      STRONG: 'Strong',
      SOLVED_WITH_STRUGGLE: 'Solved with struggle',
      PARTIAL: 'Partially solved',
      NEEDS_WORK: 'Needs work',
    });
  });
  it('colours: Excellent and Strong green, the middle two gold, Needs work error', () => {
    expect(GRADE_TONE).toEqual({
      EXCELLENT: 'green',
      STRONG: 'green',
      SOLVED_WITH_STRUGGLE: 'gold',
      PARTIAL: 'gold',
      NEEDS_WORK: 'error',
    });
  });
});

describe('S10 tone table: only TOO_EASY is good, every other rule is a warning', () => {
  it('TOO_EASY is good', () => expect(insightTone('TOO_EASY')).toBe('good'));
  it.each(['TRIAGE', 'TOO_SLOW', 'EDGE_CASES', 'SAMPLE_FAIL', 'CRASH', 'SYNTAX', 'NOT_SUBMITTED', 'RISKY_RUNTIME', 'MANY_FAILED_SUBMITS', 'PANIC_SUBMITS', 'BLIND_SUBMITS', 'SLOW_START', 'SLOWEST'])(
    '%s is a warning',
    (rule) => expect(insightTone(rule)).toBe('warning'),
  );
  it('the fallback headline (no rule) is a warning', () => {
    expect(insightTone(null)).toBe('warning');
    expect(insightTone(undefined)).toBe('warning');
  });
});

describe('S10 labels', () => {
  it('results', () => expect(RESULT_LABEL).toEqual({ SOLVED: 'Solved', NOT_SOLVED: 'Not solved', NOT_OPENED: 'Not opened' }));
  it('failure labels are the six of the spec', () => {
    expect(FAILURE_LABEL).toEqual({
      TOO_SLOW: 'Too slow on some tests',
      WRONG_ON_HIDDEN: 'Wrong answer on some tests',
      WRONG_ON_SAMPLE: 'Failed a sample test',
      CRASH: 'Runtime error',
      SYNTAX_ERROR: 'Syntax error',
      NOT_SUBMITTED: 'Never submitted',
    });
  });
  it('flag labels are the four of the spec', () => {
    expect(FLAG_LABEL).toEqual({
      RISKY_RUNTIME: 'Close to the time limit',
      MANY_FAILED_SUBMITS: 'Many failed submits',
      BLIND_SUBMITS: 'Submitted without running',
      SLOW_START: 'Slow first run',
    });
  });
});

describe('time formats (FR19)', () => {
  it('under an hour: whole minutes', () => {
    expect(formatLongMinutes(0)).toBe('0 min');
    expect(formatLongMinutes(54.4)).toBe('54 min');
    expect(formatLongMinutes(59.6)).toBe('1 h 0 min');
  });
  it('over an hour: h h m min', () => {
    expect(formatLongMinutes(60)).toBe('1 h 0 min');
    expect(formatLongMinutes(75)).toBe('1 h 15 min');
    expect(formatLongMinutes(125)).toBe('2 h 5 min');
  });
  it('never negative', () => expect(formatLongMinutes(-3)).toBe('0 min'));
  it('seconds to minutes', () => {
    expect(formatSecondsAsMinutes(1020)).toBe('17 min');
    expect(formatSecondsAsMinutes(4500)).toBe('1 h 15 min');
    expect(wholeMinutes(2580)).toBe(43);
    expect(wholeMinutes(29)).toBe(0);
    expect(wholeMinutes(30)).toBe(1);
  });
});

describe('Speed: the time against the limit', () => {
  it('0.4 s of 2 s', () => expect(formatSpeed(400, 2000)).toBe('0.4 s of 2 s'));
  it('rounds to two decimals', () => expect(formatSpeed(1677, 2000)).toBe('1.68 s of 2 s'));
  it('whole seconds have no decimals', () => expect(formatSpeed(1000, 2000)).toBe('1 s of 2 s'));
  it('a very fast run is not shown as 0', () => expect(formatSpeed(2, 2000)).toBe('<0.01 s of 2 s'));
  it('zero stays zero', () => expect(formatSpeed(0, 2000)).toBe('0 s of 2 s'));
});

describe('axisTicks: a tick every 5 minutes from 0 to the end of the round', () => {
  it('a 60-minute round has 13 ticks, all labelled', () => {
    const ticks = axisTicks(60);
    expect(ticks.map((t) => t.minute)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(ticks.every((t) => t.labelled)).toBe(true);
  });
  it('a long round still has a tick every 5 minutes, but a number only every 15', () => {
    const ticks = axisTicks(150);
    expect(ticks).toHaveLength(31);
    expect(ticks.filter((t) => t.labelled).map((t) => t.minute)).toEqual([0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150]);
  });
  it('a duration that is not a multiple of 5 gets a tick at its end', () => {
    const ticks = axisTicks(47);
    expect(ticks[ticks.length - 1].minute).toBe(47);
    expect(ticks.map((t) => t.minute).slice(0, 3)).toEqual([0, 5, 10]);
    expect(ticks[ticks.length - 1].labelled).toBe(false); // too close to 45 to carry a number
  });
  it('the shortest round (5 minutes)', () => {
    expect(axisTicks(5).map((t) => t.minute)).toEqual([0, 5]);
  });
});

describe('filledMinutes: the minutes of one row', () => {
  it('keeps whole minutes inside the round, each once', () => {
    expect([...filledMinutes([1, 3, 3, 4], 10)].sort((a, b) => a - b)).toEqual([1, 3, 4]);
  });
  it('ignores minutes outside the round and values that are not whole minutes', () => {
    expect([...filledMinutes([-1, 0, 9, 10, 11, 2.5, '3', null], 10)].sort((a, b) => a - b)).toEqual([0, 9]);
  });
  it('no active minutes gives an empty row', () => expect(filledMinutes([], 30).size).toBe(0));
});
