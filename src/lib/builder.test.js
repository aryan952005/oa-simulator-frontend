import { describe, expect, it } from 'vitest';
import real from '../test/fixtures/real-rounds-responses.json';
import {
  availableCount,
  defaultSlot,
  difficultyAfterTopicChange,
  initialSlots,
  parseShortDetails,
  shortGroups,
  suggestedMinutes,
  validateDuration,
} from './builder';

const topics = [
  { topic: 'arrays', easy: 2, medium: 5, hard: 1 },
  { topic: 'graphs', easy: 0, medium: 3, hard: 0 },
];
const slot = (topic, difficulty) => ({ topic, difficulty });

describe('suggestedMinutes: the sum of SUGGESTED_MINUTES for each question', () => {
  it('one easy question is 12', () => expect(suggestedMinutes([slot('arrays', 'easy')])).toBe(12));
  it('one medium is 20 and one hard is 30', () => {
    expect(suggestedMinutes([slot('arrays', 'medium')])).toBe(20);
    expect(suggestedMinutes([slot('arrays', 'hard')])).toBe(30);
  });
  it('easy + medium + hard is 62', () => {
    expect(suggestedMinutes([slot('a', 'easy'), slot('a', 'medium'), slot('a', 'hard')])).toBe(62);
  });
  it('five hard questions is 150', () => {
    expect(suggestedMinutes(Array.from({ length: 5 }, () => slot('a', 'hard')))).toBe(150);
  });
  it('an empty list is 0', () => expect(suggestedMinutes([])).toBe(0));
});

describe('availableCount', () => {
  it('reads the count for a topic and difficulty from E5', () => {
    expect(availableCount(topics, 'arrays', 'easy')).toBe(2);
    expect(availableCount(topics, 'arrays', 'medium')).toBe(5);
    expect(availableCount(topics, 'graphs', 'easy')).toBe(0);
  });
  it('is 0 for a topic that E5 did not return', () => {
    expect(availableCount(topics, 'trees', 'easy')).toBe(0);
  });
});

describe('defaultSlot and initialSlots: the form starts valid', () => {
  it('uses the first topic and difficulty that still has enough problems', () => {
    expect(defaultSlot(topics, [])).toEqual({ topic: 'arrays', difficulty: 'easy' });
    expect(defaultSlot(topics, [slot('arrays', 'easy')])).toEqual({ topic: 'arrays', difficulty: 'easy' });
    // arrays easy has 2, both are used, so the next pair is arrays medium
    expect(defaultSlot(topics, [slot('arrays', 'easy'), slot('arrays', 'easy')])).toEqual({
      topic: 'arrays',
      difficulty: 'medium',
    });
  });

  it('skips a difficulty with 0 problems', () => {
    expect(defaultSlot([{ topic: 'graphs', easy: 0, medium: 3, hard: 0 }], [])).toEqual({
      topic: 'graphs',
      difficulty: 'medium',
    });
  });

  it('moves to the next topic when the first is used up', () => {
    const small = [
      { topic: 'a', easy: 1, medium: 0, hard: 0 },
      { topic: 'b', easy: 1, medium: 0, hard: 0 },
    ];
    expect(initialSlots(small, 2)).toEqual([slot('a', 'easy'), slot('b', 'easy')]);
  });

  it('gives 3 questions by default, with no short group when the bank is large enough', () => {
    const slots = initialSlots(topics);
    expect(slots).toHaveLength(3);
    expect(shortGroups(topics, slots)).toEqual([]);
  });

  it('with the real bank (one problem per topic and difficulty) the first three are arrays easy, medium, hard', () => {
    const realTopics = real.topics.body.topics;
    expect(initialSlots(realTopics)).toEqual([slot('arrays', 'easy'), slot('arrays', 'medium'), slot('arrays', 'hard')]);
  });

  it('falls back to the first topic when nothing has enough problems left', () => {
    const one = [{ topic: 'a', easy: 1, medium: 0, hard: 0 }];
    expect(defaultSlot(one, [slot('a', 'easy')])).toEqual({ topic: 'a', difficulty: 'easy' });
  });
});

describe('difficultyAfterTopicChange', () => {
  it('keeps the difficulty when the new topic has problems at it', () => {
    expect(difficultyAfterTopicChange(topics, 'arrays', 'hard')).toBe('hard');
  });
  it('moves to the first difficulty that has problems when the current one has none', () => {
    expect(difficultyAfterTopicChange(topics, 'graphs', 'easy')).toBe('medium');
    expect(difficultyAfterTopicChange(topics, 'graphs', 'hard')).toBe('medium');
  });
});

describe('shortGroups: the browser-side availability check', () => {
  it('is empty when each group is within what exists', () => {
    expect(shortGroups(topics, [slot('arrays', 'easy'), slot('arrays', 'easy'), slot('arrays', 'hard')])).toEqual([]);
  });

  it('lists a group that appears k times when fewer than k problems exist', () => {
    const slots = [slot('arrays', 'hard'), slot('arrays', 'easy'), slot('arrays', 'hard')];
    expect(shortGroups(topics, slots)).toEqual([
      { topic: 'arrays', difficulty: 'hard', slots: [1, 3], requested: 2, available: 1 },
    ]);
  });

  it('lists every short group, with 1-based question numbers', () => {
    const slots = [
      slot('arrays', 'hard'),
      slot('graphs', 'medium'),
      slot('arrays', 'hard'),
      slot('graphs', 'medium'),
      slot('graphs', 'medium'),
      slot('graphs', 'medium'),
    ];
    const result = shortGroups(topics, slots);
    expect(result.map((g) => [g.topic, g.difficulty, g.slots, g.requested, g.available])).toEqual([
      ['arrays', 'hard', [1, 3], 2, 1],
      ['graphs', 'medium', [2, 4, 5, 6], 4, 3],
    ]);
  });

  it('a topic and difficulty that E5 does not list counts as 0 available', () => {
    expect(shortGroups(topics, [slot('trees', 'easy')])).toEqual([
      { topic: 'trees', difficulty: 'easy', slots: [1], requested: 1, available: 0 },
    ]);
  });
});

describe('validateDuration: a whole number from 5 to 180', () => {
  it.each(['5', '12', '62', '180', ' 45 '])('accepts %j', (text) => {
    expect(validateDuration(text)).toBeNull();
  });
  it.each(['', ' ', '4', '181', '0', '-5', '12.5', '1e2', 'abc', '12 min', '٣٠'])('rejects %j', (text) => {
    expect(validateDuration(text)).toBe('Enter a whole number from 5 to 180.');
  });
});

describe('parseShortDetails (shape saved from the real backend)', () => {
  it('reads the real 422 details with one short group', () => {
    const { details } = real.createRound422OneGroup.body.error;
    expect(parseShortDetails(details)).toEqual([
      { slots: [1, 2], topic: 'arrays', difficulty: 'easy', requested: 2, available: 1 },
    ]);
  });

  it('reads the real 422 details with two short groups', () => {
    const { details } = real.createRound422TwoGroups.body.error;
    const groups = parseShortDetails(details);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.slots)).toEqual([[1, 3], [2, 4]]);
  });

  it.each([undefined, null, [], 'x', [{}], [{ slots: [1], topic: 'a', difficulty: 'easy', requested: 'two', available: 1 }]])(
    'returns null for %j',
    (details) => {
      expect(parseShortDetails(details)).toBeNull();
    },
  );
});
