import { Link } from 'react-router-dom';
import { formatDateTime, formatDuration } from '../lib/format';
import { endedLabel } from '../lib/labels';
import StatusBadge from './StatusBadge';

const COLUMNS = ['Created', 'Duration', 'Questions', 'Solved', 'Status', 'Ended', 'Actions'];

const PRIMARY_LINK =
  'inline-flex items-center justify-center h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all';
const SECONDARY_LINK =
  'inline-flex items-center justify-center h-9 px-space-md rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover transition-all';
const DANGER_BUTTON =
  'inline-flex items-center justify-center h-9 px-space-md rounded-lg border border-error text-error font-label-ui text-label-ui hover:bg-error/[0.08] disabled:opacity-60 transition-all';

// Rounds are named by their creation date and time, never by ID (FR18).
// Pass `onDelete` to show Delete on READY rows (spec S6). Without it, Delete is not shown (spec S4).
export default function RoundsTable({ rounds, onDelete, busyId }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="px-space-md py-space-sm font-label-ui text-label-ui text-on-surface-variant whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => {
            const created = formatDateTime(round.createdAt);
            return (
              <tr key={round.id} data-testid="round-row" className="border-b border-border-subtle last:border-b-0">
                <td className="px-space-md py-space-md font-body-md text-body-md text-on-surface whitespace-nowrap">{created}</td>
                <td className="px-space-md py-space-md font-body-md text-body-md text-on-surface whitespace-nowrap">
                  {formatDuration(round.durationMin)}
                </td>
                <td className="px-space-md py-space-md font-body-md text-body-md text-on-surface">{round.questionCount}</td>
                <td className="px-space-md py-space-md font-body-md text-body-md text-on-surface whitespace-nowrap">
                  {round.solvedCount} of {round.questionCount}
                </td>
                <td className="px-space-md py-space-md">
                  <StatusBadge status={round.status} />
                </td>
                <td className="px-space-md py-space-md font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                  {endedLabel(round)}
                </td>
                <td className="px-space-md py-space-md">
                  <div className="flex items-center gap-space-sm">
                    {round.status === 'READY' && (
                      <>
                        <Link to={`/rounds/${round.id}`} aria-label={`Start round created ${created}`} className={PRIMARY_LINK}>
                          Start
                        </Link>
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(round)}
                            disabled={busyId === round.id}
                            aria-label={`Delete round created ${created}`}
                            className={DANGER_BUTTON}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                    {round.status === 'ACTIVE' && (
                      <Link to={`/rounds/${round.id}/workspace`} aria-label={`Resume round created ${created}`} className={PRIMARY_LINK}>
                        Resume
                      </Link>
                    )}
                    {round.status === 'FINISHED' && (
                      <Link to={`/rounds/${round.id}/report`} aria-label={`View report for round created ${created}`} className={SECONDARY_LINK}>
                        View report
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RoundsTableSkeleton({ rows = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading rounds" className="flex flex-col gap-space-sm p-space-md">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-12 rounded-lg bg-surface-container-high animate-pulse" />
      ))}
    </div>
  );
}
