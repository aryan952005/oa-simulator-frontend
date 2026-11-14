import { describe, expect, it } from 'vitest';
import * as limits from './limits';

// The values in frontend spec section 5. They must match the backend's config/limits.js.
describe('src/config/limits.js', () => {
  it('has exactly the values in spec section 5', () => {
    expect({ ...limits }).toEqual({
      MIN_QUESTIONS: 1,
      MAX_QUESTIONS: 5,
      DEFAULT_QUESTIONS: 3,
      MIN_DURATION_MIN: 5,
      MAX_DURATION_MIN: 180,
      SUGGESTED_MINUTES: { easy: 12, medium: 20, hard: 30 },
      RUN_COOLDOWN_MS: 3000,
      SUBMIT_COOLDOWN_MS: 5000,
      MAX_RUNS: 30,
      MAX_SUBMITS: 20,
      MAX_CODE_CHARS: 51200,
      MAX_READY_ROUNDS: 20,
      AUTOSAVE_DEBOUNCE_MS: 1500,
      PRE_DEADLINE_SAVE_SECONDS: 15,
      WARNING_SECONDS: 300,
      PAGE_SIZE: 10,
      WORKSPACE_MIN_WIDTH_PX: 1100,
      NAME_MIN: 2,
      NAME_MAX: 50,
      EMAIL_MAX: 254,
      PASSWORD_MIN_BYTES: 8,
      PASSWORD_MAX_BYTES: 72,
    });
  });

  it('does not list topics (FR27)', () => {
    expect(Object.keys(limits).some((k) => /topic/i.test(k))).toBe(false);
  });
});
