// Display rules (spec section 3.6).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');

// FR17: times from the server are UTC. Show them in the browser's local time as `11 Nov 2026, 13:20`.
export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${two(date.getHours())}:${two(date.getMinutes())}`;
}

// FR19: durations are shown in minutes, for example `60 min`.
export function formatDuration(minutes) {
  return `${minutes} min`;
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// Time used and time left (FR19): whole minutes, as `h h m min` when over an hour.
export function formatLongMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export const formatSecondsAsMinutes = (seconds) => formatLongMinutes(seconds / 60);

const trimmed = (value) => String(Number(value.toFixed(2)));

// Spec S10, Speed: the time against the limit, for example `0.4 s of 2 s`.
export function formatSpeed(runtimeMs, timeLimitMs) {
  const seconds = runtimeMs / 1000;
  const used = runtimeMs > 0 && seconds < 0.005 ? '<0.01' : trimmed(seconds);
  return `${used} s of ${trimmed(timeLimitMs / 1000)} s`;
}
