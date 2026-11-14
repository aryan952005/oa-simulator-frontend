import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteRound, getRound, listRounds, startRound } from '../api/rounds';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorBanner, { canRetry } from '../components/ErrorBanner';
import RoundNotFound from '../components/RoundNotFound';
import StatusBadge from '../components/StatusBadge';
import { MAX_RUNS, MAX_SUBMITS, RUN_COOLDOWN_MS, SUBMIT_COOLDOWN_MS } from '../config/limits';
import { formatDateTime, formatDuration } from '../lib/format';
import { difficultyLabel, topicLabel } from '../lib/labels';
import { routeForStatus } from '../lib/routing';

// The same text for every round (spec S7). The numbers come from src/config/limits.js (FR26).
const RULES = [
  'The clock starts when you press Start and does not pause.',
  'You can move between questions freely.',
  `Run checks the sample tests. You can run each question up to ${MAX_RUNS} times, at most once every ${RUN_COOLDOWN_MS / 1000} seconds.`,
  `Submit checks every test. You can submit each question up to ${MAX_SUBMITS} times, at most once every ${SUBMIT_COOLDOWN_MS / 1000} seconds.`,
  'Only one round can be active at a time.',
  'You can finish early. When time runs out, the round finishes on its own.',
];

const CARD = 'bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1';
const PRIMARY_BUTTON =
  'inline-flex items-center justify-center h-12 px-space-xl rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all';
const SECONDARY_LINK =
  'inline-flex items-center justify-center h-12 px-space-lg rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover transition-all';
const DANGER_BUTTON =
  'inline-flex items-center justify-center h-12 px-space-lg rounded-lg border border-error text-error font-label-ui text-label-ui hover:bg-error/[0.08] disabled:opacity-60 transition-all';

function InfoCard({ label, value }) {
  return (
    <div role="group" aria-label={label} className={`${CARD} p-space-lg flex flex-col gap-space-xs`}>
      <span className="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">{label}</span>
      <span className="font-headline-md text-headline-md text-on-surface">{value}</span>
    </div>
  );
}

// S7 Round details. Shown only for a READY round: RoundGate sends every other status elsewhere (FR15).
export default function RoundDetailsPage({ round }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // What the banner shows: { error } for an API error, or { activeExists, activeId } for ACTIVE_ROUND_EXISTS.
  // activeId is undefined while the active round is being looked up, and null if none was found.
  const [banner, setBanner] = useState(null);
  const [notFound, setNotFound] = useState(false);

  if (notFound) return <RoundNotFoundFrame />;

  // ROUND_NOT_READY: the round is no longer READY (another tab started or deleted it).
  // Reload it and route by its status (FR15).
  async function routeAway(retry) {
    try {
      const fresh = await getRound(round.id);
      if (fresh.status !== 'READY') {
        navigate(routeForStatus(round.id, fresh.status), { replace: true });
        return;
      }
      setBanner({ error: { code: 'INTERNAL_ERROR' }, retry });
    } catch (err) {
      if (err.code === 'NOT_FOUND') setNotFound(true);
      else setBanner({ error: err, retry });
    }
  }

  async function findActiveRound() {
    try {
      const { items } = await listRounds({ status: 'ACTIVE', limit: 1 });
      setBanner({ activeExists: true, activeId: items[0] ? items[0].id : null });
    } catch {
      setBanner({ activeExists: true, activeId: null });
    }
  }

  async function start() {
    if (starting) return;
    setStarting(true);
    setBanner(null);
    try {
      await startRound(round.id);
      navigate(`/rounds/${encodeURIComponent(round.id)}/workspace`, { replace: true });
    } catch (err) {
      if (err.code === 'ACTIVE_ROUND_EXISTS') {
        setBanner({ activeExists: true, activeId: undefined });
        setStarting(false);
        findActiveRound();
      } else if (err.code === 'ROUND_NOT_READY') {
        await routeAway(start);
        setStarting(false);
      } else if (err.code === 'NOT_FOUND') {
        setNotFound(true);
      } else {
        setBanner({ error: err, retry: start });
        setStarting(false);
      }
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setBanner(null);
    try {
      await deleteRound(round.id);
      navigate('/rounds', { state: { notice: 'Round deleted.' } });
    } catch (err) {
      setDeleting(false);
      setConfirmingDelete(false);
      if (err.code === 'ROUND_NOT_READY') await routeAway(confirmDelete);
      else if (err.code === 'NOT_FOUND') setNotFound(true);
      else setBanner({ error: err, retry: confirmDelete });
    }
  }

  return (
    <div data-testid="screen-S7" className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center gap-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Round details</h1>
        <StatusBadge status="READY" />
      </div>

      {banner && banner.activeExists && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error bg-error-container text-on-error-container px-space-md py-space-sm">
          <span className="font-body-md text-body-md">You already have an active round.</span>
          {banner.activeId && (
            <Link to={`/rounds/${encodeURIComponent(banner.activeId)}/workspace`} className="font-label-ui text-label-ui underline">
              Go to your active round
            </Link>
          )}
        </div>
      )}
      {banner && banner.error && (
        <ErrorBanner error={banner.error} onRetry={canRetry(banner.error) ? banner.retry : undefined} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <InfoCard label="Duration" value={formatDuration(round.durationMin)} />
        <InfoCard label="Questions" value={round.slots.length} />
        <InfoCard label="Created" value={formatDateTime(round.createdAt)} />
      </div>

      <section aria-labelledby="questions-heading" className="flex flex-col gap-space-md">
        <h2 id="questions-heading" className="font-headline-md text-headline-md text-on-surface">
          Questions
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {round.slots.map((slot) => (
            <li
              key={slot.index}
              data-testid="locked-question"
              className={`${CARD} p-space-lg flex items-center justify-between gap-space-md`}
            >
              <div className="flex flex-col gap-space-xs">
                <span className="font-headline-sm text-headline-sm text-on-surface">Q{slot.index}</span>
                <span className="font-body-md text-body-md text-on-surface-variant">
                  {topicLabel(slot.topic)} · {difficultyLabel(slot.difficulty)}
                </span>
              </div>
              <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-on-surface-variant">
                lock
              </span>
              <span className="sr-only">Locked</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rules-heading" className={`${CARD} p-space-lg flex flex-col gap-space-md`}>
        <h2 id="rules-heading" className="font-headline-md text-headline-md text-on-surface">
          Rules
        </h2>
        <ul className="flex flex-col gap-space-sm list-disc pl-space-lg marker:text-primary-container">
          {RULES.map((rule) => (
            <li key={rule} className="font-body-md text-body-md text-on-surface">
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-space-md">
        <Link to="/rounds" className={SECONDARY_LINK}>
          Back to My rounds
        </Link>
        <div className="flex flex-wrap items-center gap-space-md">
          <button type="button" onClick={() => setConfirmingDelete(true)} disabled={starting || deleting} className={DANGER_BUTTON}>
            Delete
          </button>
          <button type="button" onClick={start} disabled={starting || deleting} className={PRIMARY_BUTTON}>
            {starting ? 'Starting…' : 'Start'}
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete round"
          message="Delete this round? This cannot be undone."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function RoundNotFoundFrame() {
  return (
    <div className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-lg">
      <RoundNotFound />
    </div>
  );
}
