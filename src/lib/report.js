// Small helpers for the report screen (spec S10).

const TICK_EVERY_MIN = 5; // spec S10, Time map: a tick every 5 minutes
const MANY_MINUTES = 60; // above this, only some ticks carry a number so the labels do not overlap

// The scale of the time map: a tick every 5 minutes from 0, and one at the end of the round.
// `labelled` says whether the tick also shows its number.
export function axisTicks(totalMinutes) {
  const total = Math.max(0, Math.round(totalMinutes));
  const labelStep = total <= MANY_MINUTES ? TICK_EVERY_MIN : TICK_EVERY_MIN * 3;
  const ticks = [];
  for (let minute = 0; minute <= total; minute += TICK_EVERY_MIN) {
    ticks.push({ minute, labelled: minute % labelStep === 0 });
  }
  const last = ticks[ticks.length - 1].minute;
  if (last !== total) {
    const lastLabelled = [...ticks].reverse().find((tick) => tick.labelled).minute;
    ticks.push({ minute: total, labelled: total - lastLabelled >= labelStep * 0.6 });
  }
  return ticks;
}

// The minutes of one question's row that are filled: whole minutes inside the round, each once.
export function filledMinutes(activeMinutes, totalMinutes) {
  const filled = new Set();
  for (const minute of activeMinutes) {
    if (Number.isInteger(minute) && minute >= 0 && minute < totalMinutes) filled.add(minute);
  }
  return filled;
}

// 'Q 1 · Strings · Easy' is built by the caller; this only turns seconds into whole minutes.
export const wholeMinutes = (seconds) => Math.max(0, Math.round(seconds / 60));
