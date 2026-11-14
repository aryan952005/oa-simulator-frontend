// Product limits. These must match the backend's config/limits.js (frontend spec section 5).
// Nothing else in the frontend may contain these numbers (FR26).
// Topics are not here: they come only from E5 (FR27).

// Round builder (S5)
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 5;
export const DEFAULT_QUESTIONS = 3;
export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 180;
export const SUGGESTED_MINUTES = Object.freeze({ easy: 12, medium: 20, hard: 30 });
export const MAX_READY_ROUNDS = 20;

// Run and Submit (S8, S9)
export const RUN_COOLDOWN_MS = 3000;
export const SUBMIT_COOLDOWN_MS = 5000;
export const MAX_RUNS = 30;
export const MAX_SUBMITS = 20;

// Workspace (S8)
export const MAX_CODE_CHARS = 51200;
export const AUTOSAVE_DEBOUNCE_MS = 1500;
export const PRE_DEADLINE_SAVE_SECONDS = 15;
export const WARNING_SECONDS = 300;
export const WORKSPACE_MIN_WIDTH_PX = 1100;

// My rounds (S6)
export const PAGE_SIZE = 10;

// Register (S3)
export const NAME_MIN = 2;
export const NAME_MAX = 50;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN_BYTES = 8;
export const PASSWORD_MAX_BYTES = 72;
