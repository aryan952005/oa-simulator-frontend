import { useEffect, useRef } from 'react';
import { PRE_DEADLINE_SAVE_SECONDS, WARNING_SECONDS } from '../config/limits';
import { useCountdown } from '../hooks/useCountdown';
import { formatCountdown } from '../lib/clock';

/**
 * The header countdown (spec S8): MM:SS, or H:MM:SS over an hour, from the server's deadline and clock.
 * It turns amber under WARNING_SECONDS. It tells the workspace when the last PRE_DEADLINE_SAVE_SECONDS
 * begin (onPreDeadline) and when the time is over (onZero).
 * Once the time is over (`frozen`) it stays at 00:00, even if a later answer says the server clock is behind.
 */
export default function Countdown({ deadline, onPreDeadline, onZero, frozen = false }) {
  const running = useCountdown(deadline);
  const ms = frozen ? 0 : running;
  const over = ms === 0;
  const preDeadline = ms > 0 && ms <= PRE_DEADLINE_SAVE_SECONDS * 1000;
  const warning = ms <= WARNING_SECONDS * 1000;

  const latest = useRef({ onPreDeadline, onZero });
  latest.current = { onPreDeadline, onZero };

  useEffect(() => {
    if (preDeadline) latest.current.onPreDeadline();
  }, [preDeadline]);

  useEffect(() => {
    if (over) latest.current.onZero();
  }, [over]);

  return (
    <div
      role="timer"
      aria-label="Time left"
      data-warning={warning ? 'true' : 'false'}
      className={`inline-flex items-center gap-space-sm rounded-lg border px-space-md py-1.5 shadow-level-3 font-label-code-lg text-label-code-lg font-bold tabular-nums ${
        warning ? 'border-warning bg-warning/20 text-tertiary' : 'border-border-subtle bg-surface-container-lowest text-on-surface'
      }`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
        timelapse
      </span>
      {formatCountdown(ms)}
    </div>
  );
}
