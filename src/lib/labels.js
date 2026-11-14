// Label maps: how API values are shown on screen.
// Topics are never listed here. They come only from E5 (FR27).

// The three difficulties are fixed by the backend contract.
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const STATUS_LABEL = { READY: 'Ready', ACTIVE: 'Active', FINISHED: 'Finished' };

// The backend sends topic keys in lower case. Show them with a capital first letter.
export function topicLabel(topic) {
  const text = String(topic).replace(/[-_]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function difficultyLabel(difficulty) {
  return DIFFICULTY_LABEL[difficulty] ?? String(difficulty);
}

// Spec S6, Ended column: EXPIRED is Time ran out, MANUAL is Finished by you, READY and ACTIVE show a dash.
export function endedLabel(round) {
  if (round.status !== 'FINISHED') return '—';
  if (round.finishReason === 'EXPIRED') return 'Time ran out';
  if (round.finishReason === 'MANUAL') return 'Finished by you';
  return '—';
}

// Spec S4: the status chip of a question, computed from its slot.
export function slotStatus(slot) {
  if (slot.solved) return 'Solved';
  if (slot.runCount + slot.submitCount > 0) return 'Attempted';
  if (slot.opened) return 'Opened';
  return 'Not opened';
}

// Spec S10: grade labels, and the tone of the badge.
export const GRADE_LABEL = {
  EXCELLENT: 'Excellent',
  STRONG: 'Strong',
  SOLVED_WITH_STRUGGLE: 'Solved with struggle',
  PARTIAL: 'Partially solved',
  NEEDS_WORK: 'Needs work',
};
export const GRADE_TONE = {
  EXCELLENT: 'green',
  STRONG: 'green',
  SOLVED_WITH_STRUGGLE: 'gold',
  PARTIAL: 'gold',
  NEEDS_WORK: 'error',
};

// Spec S10: the tone of a headline or insight is decided by its rule. TOO_EASY is good news (green);
// every other rule is a warning (gold).
export const insightTone = (rule) => (rule === 'TOO_EASY' ? 'good' : 'warning');

export const RESULT_LABEL = { SOLVED: 'Solved', NOT_SOLVED: 'Not solved', NOT_OPENED: 'Not opened' };

export const FAILURE_LABEL = {
  TOO_SLOW: 'Too slow on some tests',
  WRONG_ON_HIDDEN: 'Wrong answer on some tests',
  WRONG_ON_SAMPLE: 'Failed a sample test',
  CRASH: 'Runtime error',
  SYNTAX_ERROR: 'Syntax error',
  NOT_SUBMITTED: 'Never submitted',
};

export const FLAG_LABEL = {
  RISKY_RUNTIME: 'Close to the time limit',
  MANY_FAILED_SUBMITS: 'Many failed submits',
  BLIND_SUBMITS: 'Submitted without running',
  SLOW_START: 'Slow first run',
};
