import { Link } from 'react-router-dom';
import { getRound, listRounds } from '../api/rounds';
import { useAuth } from '../auth/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import RoundsTable, { RoundsTableSkeleton } from '../components/RoundsTable';
import Skeleton from '../components/Skeleton';
import QuestionChip from '../components/QuestionChip';
import StatusBadge from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { formatDateTime, formatDuration, plural } from '../lib/format';
import { WARNING_SECONDS } from '../config/limits';
import { useCountdown } from '../hooks/useCountdown';
import { formatCountdown } from '../lib/clock';
import { difficultyLabel, topicLabel } from '../lib/labels';

// Spec S4: the recent rounds table uses E7 with limit=5, and the stat cards use limit=1.
const RECENT_LIMIT = 5;
const COUNT_LIMIT = 1;

const CARD = 'bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1';
const PRIMARY_LINK =
  'inline-flex items-center justify-center h-11 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all';

function StatCard({ label, query }) {
  return (
    <div className={`${CARD} p-space-lg flex flex-col gap-space-sm`}>
      <span className="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">{label}</span>
      {query.status === 'loading' && <Skeleton className="h-10 w-16" />}
      {query.status === 'error' && (
        <div className="flex items-center gap-space-sm">
          <span className="font-body-md text-body-md text-on-surface-variant">Could not load</span>
          <button
            type="button"
            onClick={query.reload}
            aria-label={`Retry ${label}`}
            className="h-8 px-space-sm rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:border-border-hover"
          >
            Retry
          </button>
        </div>
      )}
      {query.status === 'success' && (
        <span data-testid={`stat-${label.toLowerCase()}`} className="font-headline-xl text-headline-xl text-on-surface">
          {query.data.total}
        </span>
      )}
    </div>
  );
}

// The time left, from the server's deadline and clock (FR11 to FR14). Amber under WARNING_SECONDS.
function ActiveCountdown({ deadline }) {
  const ms = useCountdown(deadline);
  const warning = ms <= WARNING_SECONDS * 1000;
  return (
    <span
      role="timer"
      aria-label="Time left"
      data-warning={warning ? 'true' : 'false'}
      className={`inline-flex items-center gap-1 rounded-lg px-space-md py-1 font-label-code-lg text-label-code-lg font-bold tabular-nums ${
        warning ? 'bg-warning/20 text-tertiary' : 'bg-surface-container-low text-on-surface'
      }`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
        timelapse
      </span>
      {formatCountdown(ms)}
    </span>
  );
}

function ActiveRoundCard({ round }) {
  const detail = useApi((options) => getRound(round.id, options), [round.id]);

  return (
    <section aria-label="Active round" className={`${CARD} p-space-lg flex flex-col gap-space-md relative overflow-hidden`}>
      <div aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-container" />
      <div className="flex items-center justify-between gap-space-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">Active round</h2>
        <StatusBadge status="ACTIVE" />
      </div>

      {detail.status === 'loading' && (
        <div aria-busy="true" aria-label="Loading active round" className="flex flex-col gap-space-sm">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {detail.status === 'error' && <ErrorBanner error={detail.error} onRetry={detail.reload} />}
      {detail.status === 'success' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Started {formatDateTime(detail.data.startedAt)}
            </p>
            <ActiveCountdown deadline={detail.data.deadline} />
          </div>
          <ul className="flex flex-col gap-space-sm">
            {detail.data.slots.map((slot) => (
              <li
                key={slot.index}
                className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm"
              >
                <span className="font-label-ui text-label-ui text-on-surface">
                  Q{slot.index} · {topicLabel(slot.topic)} · {difficultyLabel(slot.difficulty)}
                </span>
                <QuestionChip slot={slot} />
              </li>
            ))}
          </ul>
        </>
      )}

      <div>
        <Link to={`/rounds/${round.id}/workspace`} className={PRIMARY_LINK}>
          Resume
        </Link>
      </div>
    </section>
  );
}

function ReadyRoundCard({ round }) {
  return (
    <section aria-label="Ready round" className={`${CARD} p-space-lg flex flex-col gap-space-md`}>
      <div className="flex items-center justify-between gap-space-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">Ready round</h2>
        <StatusBadge status="READY" />
      </div>
      <dl className="grid grid-cols-3 gap-space-sm bg-surface-container-low rounded-lg p-space-md">
        <div className="flex flex-col">
          <dt className="font-body-sm text-body-sm text-on-surface-variant">Created</dt>
          <dd className="font-label-ui text-label-ui text-on-surface">{formatDateTime(round.createdAt)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="font-body-sm text-body-sm text-on-surface-variant">Duration</dt>
          <dd className="font-label-ui text-label-ui text-on-surface">{formatDuration(round.durationMin)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="font-body-sm text-body-sm text-on-surface-variant">Questions</dt>
          <dd className="font-label-ui text-label-ui text-on-surface">{plural(round.questionCount, 'question')}</dd>
        </div>
      </dl>
      <div>
        <Link to={`/rounds/${round.id}`} className={PRIMARY_LINK}>
          Start
        </Link>
      </div>
    </section>
  );
}

function CardSkeleton({ label }) {
  return (
    <div aria-busy="true" aria-label={label} className={`${CARD} p-space-lg flex flex-col gap-space-md`}>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-20" />
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

// S4 Dashboard (/dashboard)
export default function DashboardPage() {
  const { user } = useAuth();

  const all = useApi((options) => listRounds({ limit: COUNT_LIMIT }, options), []);
  const ready = useApi((options) => listRounds({ status: 'READY', limit: COUNT_LIMIT }, options), []);
  const active = useApi((options) => listRounds({ status: 'ACTIVE', limit: COUNT_LIMIT }, options), []);
  const finished = useApi((options) => listRounds({ status: 'FINISHED', limit: COUNT_LIMIT }, options), []);
  const recent = useApi((options) => listRounds({ limit: RECENT_LIMIT }, options), []);

  const noRoundsAtAll = all.status === 'success' && all.data.total === 0;
  const activeRound = active.status === 'success' ? active.data.items[0] : null;
  const readyRound = ready.status === 'success' ? ready.data.items[0] : null;

  return (
    <div data-testid="screen-S4" className="max-w-[1440px] mx-auto px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Hi, {user?.name}</h1>
        <Link to="/rounds/new" className={PRIMARY_LINK}>
          Create round
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <StatCard label="Rounds" query={all} />
        <StatCard label="Ready" query={ready} />
        <StatCard label="Active" query={active} />
        <StatCard label="Finished" query={finished} />
      </div>

      {!noRoundsAtAll && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          {active.status === 'loading' && <CardSkeleton label="Loading active round" />}
          {active.status === 'error' && <ErrorBanner error={active.error} onRetry={active.reload} />}
          {activeRound && <ActiveRoundCard round={activeRound} />}

          {ready.status === 'loading' && <CardSkeleton label="Loading ready round" />}
          {ready.status === 'error' && <ErrorBanner error={ready.error} onRetry={ready.reload} />}
          {readyRound && <ReadyRoundCard round={readyRound} />}
        </div>
      )}

      <section aria-label="Recent rounds" className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between gap-space-md p-space-lg border-b border-border-subtle">
          <h2 className="font-headline-md text-headline-md text-on-surface">Recent rounds</h2>
          <Link to="/rounds" className="font-label-ui text-label-ui text-primary hover:underline">
            View all rounds
          </Link>
        </div>

        {noRoundsAtAll ? (
          <EmptyState title="You have not created a round yet" actionLabel="Create round" actionTo="/rounds/new" />
        ) : (
          <>
            {recent.status === 'loading' && <RoundsTableSkeleton rows={RECENT_LIMIT} />}
            {recent.status === 'error' && (
              <div className="p-space-md">
                <ErrorBanner error={recent.error} onRetry={recent.reload} />
              </div>
            )}
            {recent.status === 'success' && recent.data.items.length === 0 && (
              <EmptyState title="You have not created a round yet" actionLabel="Create round" actionTo="/rounds/new" />
            )}
            {recent.status === 'success' && recent.data.items.length > 0 && <RoundsTable rounds={recent.data.items} />}
          </>
        )}
      </section>
    </div>
  );
}
