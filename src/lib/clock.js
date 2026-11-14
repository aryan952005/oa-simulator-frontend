// The server's clock is the only source for the countdown (FR11).
// The laptop clock is used only to measure the time between two requests.

let offsetMs = 0;

// FR12: each response that contains `serverTime` sets the offset, measured when the response arrives.
export function syncClock(serverTime) {
  const server = Date.parse(serverTime);
  if (Number.isNaN(server)) return;
  offsetMs = server - Date.now();
}

export function getOffsetMs() {
  return offsetMs;
}

export function resetClock() {
  offsetMs = 0;
}

// The server's current time, as milliseconds since the epoch.
export function serverNow() {
  return Date.now() + offsetMs;
}

// FR13: remaining time is `Date.parse(deadline) - (Date.now() + offsetMs)`, never below 0.
export function remainingMs(deadline) {
  const end = Date.parse(deadline);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - serverNow());
}

const two = (n) => String(n).padStart(2, '0');

// MM:SS, or H:MM:SS from one hour up (spec S8). Whole seconds are rounded up, so 00:00 means the time is over.
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}
