import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteRound, listRounds } from '../api/rounds';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorBanner, { canRetry } from '../components/ErrorBanner';
import Notice from '../components/Notice';
import RoundsTable, { RoundsTableSkeleton } from '../components/RoundsTable';
import { PAGE_SIZE } from '../config/limits';
import { useApi } from '../hooks/useApi';
import { STATUS_LABEL } from '../lib/labels';

const FILTERS = [
  { label: 'All', status: null },
  { label: STATUS_LABEL.READY, status: 'READY' },
  { label: STATUS_LABEL.ACTIVE, status: 'ACTIVE' },
  { label: STATUS_LABEL.FINISHED, status: 'FINISHED' },
];

const PAGER_BUTTON =
  'h-10 px-space-md rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all';

// S6 My rounds (/rounds)
export default function MyRoundsPage() {
  const [status, setStatus] = useState(null); // null is All: no status parameter
  const [page, setPage] = useState(1);
  const [removedIds, setRemovedIds] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null); // the round the student is asked about
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // S7 sends "Round deleted." here in the router state after a delete. Show it once.
  const [notice, setNotice] = useState(() => location.state?.notice ?? null);
  useEffect(() => {
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const list = useApi((options) => listRounds({ status, page, limit: PAGE_SIZE }, options), [status, page]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  function chooseFilter(next) {
    if (next === status) return;
    setStatus(next);
    setPage(1); // changing the filter returns to page 1
    setRemovedIds([]);
    setDeleteError(null);
  }

  async function confirmDelete(round = pendingDelete) {
    if (!round) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRound(round.id); // the row goes only after the 204
      setRemovedIds((ids) => [...ids, round.id]);
      setPendingDelete(null);
      setDeleting(false);
      setNotice('Round deleted.');
      const itemsLeft = list.data.items.filter((item) => item.id !== round.id && !removedIds.includes(item.id));
      if (itemsLeft.length === 0 && page > 1) setPage(page - 1);
      else list.reload({ silent: true });
    } catch (err) {
      setDeleting(false);
      setPendingDelete(null);
      if (err.code === 'NOT_FOUND' || err.code === 'ROUND_NOT_READY') {
        // The round is already gone, or has started. Show the list as it is now.
        list.reload({ silent: true });
      } else {
        setDeleteError({ error: err, round });
      }
    }
  }

  const items = list.status === 'success' ? list.data.items.filter((item) => !removedIds.includes(item.id)) : [];
  const total = list.status === 'success' ? list.data.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);

  return (
    <div data-testid="screen-S6" className="max-w-[1440px] mx-auto px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">My rounds</h1>

      <div role="group" aria-label="Filter rounds" className="flex flex-wrap gap-space-sm">
        {FILTERS.map((filter) => {
          const selected = filter.status === status;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={selected}
              onClick={() => chooseFilter(filter.status)}
              className={`h-10 px-space-lg rounded-full font-label-ui text-label-ui transition-all ${
                selected
                  ? 'bg-primary-container text-on-primary shadow-primary-hover'
                  : 'bg-surface-container-lowest border border-border-subtle text-on-surface hover:border-border-hover'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {deleteError && (
        <ErrorBanner
          error={deleteError.error}
          onRetry={canRetry(deleteError.error) ? () => confirmDelete(deleteError.round) : undefined}
        />
      )}

      <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 overflow-hidden">
        {list.status === 'loading' && <RoundsTableSkeleton rows={PAGE_SIZE / 2} />}

        {list.status === 'error' && (
          <div className="p-space-md">
            <ErrorBanner error={list.error} onRetry={list.reload} />
          </div>
        )}

        {list.status === 'success' && items.length === 0 && (
          status === null ? (
            <EmptyState title="No rounds yet" actionLabel="Create round" actionTo="/rounds/new" />
          ) : (
            <EmptyState title={`No ${STATUS_LABEL[status].toLowerCase()} rounds`} />
          )
        )}

        {list.status === 'success' && items.length > 0 && (
          <RoundsTable rounds={items} onDelete={setPendingDelete} busyId={deleting ? pendingDelete?.id : null} />
        )}
      </div>

      {list.status === 'success' && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <p data-testid="range" className="font-body-md text-body-md text-on-surface-variant">
            Showing {firstShown}–{lastShown} of {total}
          </p>
          <nav aria-label="Pages" className="flex items-center gap-space-sm">
            <button type="button" className={PAGER_BUTTON} disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span data-testid="page-of" className="font-label-code-lg text-label-code-lg text-on-surface px-space-sm">
              Page {page} of {pageCount}
            </span>
            <button type="button" className={PAGER_BUTTON} disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </nav>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete round"
          message="Delete this round? This cannot be undone."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {notice && <Notice message={notice} onDone={dismissNotice} />}
    </div>
  );
}
