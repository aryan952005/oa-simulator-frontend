import { useEffect, useReducer } from 'react';

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all';
const SECONDARY_BUTTON =
  'inline-flex items-center justify-center h-10 px-space-lg rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all';

const secondsLeft = (until) => Math.max(0, Math.ceil((until - Date.now()) / 1000));
const seconds = (n) => `${n} ${n === 1 ? 'second' : 'seconds'}`;

/**
 * The toolbar under the editor (spec S8 and S9): Run, Submit, the attempts line, and the lines that
 * explain why a button is waiting. Run and Submit have their own cooldowns, and both are per round.
 */
export default function AttemptToolbar({
  ready,
  locked,
  runsLeft,
  submitsLeft,
  runPending,
  submitPending,
  runCooldownUntil,
  submitCooldownUntil,
  message,
  onRun,
  onSubmit,
}) {
  // Redraw while a cooldown is running, so the seconds count down.
  const [, tick] = useReducer((n) => n + 1, 0);
  const waiting = runCooldownUntil > Date.now() || submitCooldownUntil > Date.now();
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [waiting]);

  const runWait = secondsLeft(runCooldownUntil);
  const submitWait = secondsLeft(submitCooldownUntil);
  const runDisabled = !ready || locked || runPending || runWait > 0 || runsLeft <= 0;
  const submitDisabled = !ready || locked || submitPending || submitWait > 0 || submitsLeft <= 0;

  const notes = [];
  if (runWait > 0) notes.push(`Wait ${seconds(runWait)} before running again.`);
  if (submitWait > 0) notes.push(`Wait ${seconds(submitWait)} before submitting again.`);
  if (ready && runsLeft <= 0) notes.push('No runs left for this question.');
  if (ready && submitsLeft <= 0) notes.push('No submits left for this question.');
  if (message) notes.push(message);

  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <button type="button" onClick={onRun} disabled={runDisabled} className={PRIMARY_BUTTON}>
            {runPending ? 'Running…' : 'Run'}
          </button>
          <button type="button" onClick={onSubmit} disabled={submitDisabled} className={SECONDARY_BUTTON}>
            {submitPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
        <p data-testid="attempts-line" className="font-body-sm text-body-sm text-on-surface-variant">
          Runs left {runsLeft} · Submits left {submitsLeft}
        </p>
      </div>
      {notes.length > 0 && (
        <div data-testid="attempt-notes" aria-live="polite" className="flex flex-col">
          {notes.map((note) => (
            <p key={note} className="font-body-sm text-body-sm text-on-surface-variant">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
