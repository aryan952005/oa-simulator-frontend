// Pure logic for the Create round screen (spec S5). `topics` is always the list from E5:
// [{ topic, easy, medium, hard }] where each difficulty is a count of approved problems.

import {
  DEFAULT_QUESTIONS,
  MAX_DURATION_MIN,
  MIN_DURATION_MIN,
  SUGGESTED_MINUTES,
} from '../config/limits';
import { DIFFICULTIES } from './labels';

// How many approved problems exist for a topic and difficulty. 0 if the topic is not in E5.
export function availableCount(topics, topic, difficulty) {
  const entry = topics.find((t) => t.topic === topic);
  const count = entry ? entry[difficulty] : 0;
  return typeof count === 'number' ? count : 0;
}

// The sum of the suggested minutes for each question's difficulty.
export function suggestedMinutes(slots) {
  return slots.reduce((sum, slot) => sum + (SUGGESTED_MINUTES[slot.difficulty] ?? 0), 0);
}

// The first topic and difficulty (E5 order, easy to hard) that still has more problems than the
// slots already using it. Falls back to the first pair that has any problem, then to the first topic.
export function defaultSlot(topics, existingSlots) {
  const used = (topic, difficulty) =>
    existingSlots.filter((s) => s.topic === topic && s.difficulty === difficulty).length;
  for (const { topic } of topics) {
    for (const difficulty of DIFFICULTIES) {
      if (availableCount(topics, topic, difficulty) > used(topic, difficulty)) return { topic, difficulty };
    }
  }
  for (const { topic } of topics) {
    const difficulty = DIFFICULTIES.find((d) => availableCount(topics, topic, d) > 0);
    if (difficulty) return { topic, difficulty };
  }
  return { topic: topics[0]?.topic ?? '', difficulty: DIFFICULTIES[0] };
}

// The starting list of questions (default 3), each chosen by defaultSlot so the form starts valid.
export function initialSlots(topics, count = DEFAULT_QUESTIONS) {
  const slots = [];
  for (let i = 0; i < count; i += 1) slots.push(defaultSlot(topics, slots));
  return slots;
}

// Changing the topic keeps the difficulty when the new topic has problems at it,
// otherwise it moves to the first difficulty that does.
export function difficultyAfterTopicChange(topics, newTopic, difficulty) {
  if (availableCount(topics, newTopic, difficulty) > 0) return difficulty;
  return DIFFICULTIES.find((d) => availableCount(topics, newTopic, d) > 0) ?? difficulty;
}

/**
 * The browser-side availability check. If the same topic and difficulty appear k times and fewer
 * than k problems exist, the group is short.
 * @returns {{ topic: string, difficulty: string, slots: number[], requested: number, available: number }[]}
 *   `slots` are 1-based question numbers.
 */
export function shortGroups(topics, slots) {
  const groups = new Map();
  slots.forEach((slot, position) => {
    const key = `${slot.topic}\u0000${slot.difficulty}`;
    if (!groups.has(key)) groups.set(key, { topic: slot.topic, difficulty: slot.difficulty, slots: [] });
    groups.get(key).slots.push(position + 1);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      requested: group.slots.length,
      available: availableCount(topics, group.topic, group.difficulty),
    }))
    .filter((group) => group.available < group.requested);
}

// The duration field holds text. It must be a whole number from 5 to 180.
export function validateDuration(text) {
  const value = String(text).trim();
  const message = `Enter a whole number from ${MIN_DURATION_MIN} to ${MAX_DURATION_MIN}.`;
  if (!/^\d+$/.test(value)) return message;
  const minutes = Number(value);
  if (minutes < MIN_DURATION_MIN || minutes > MAX_DURATION_MIN) return message;
  return null;
}

// The shape of a 422 NOT_ENOUGH_PROBLEMS details item, as sent by the backend.
export function parseShortDetails(details) {
  if (!Array.isArray(details) || details.length === 0) return null;
  const groups = [];
  for (const item of details) {
    if (
      !item ||
      !Array.isArray(item.slots) ||
      typeof item.topic !== 'string' ||
      typeof item.difficulty !== 'string' ||
      typeof item.requested !== 'number' ||
      typeof item.available !== 'number'
    ) {
      return null;
    }
    groups.push(item);
  }
  return groups;
}
