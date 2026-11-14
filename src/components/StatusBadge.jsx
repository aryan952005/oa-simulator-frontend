import { STATUS_LABEL } from '../lib/labels';

// Spec S6: READY (gold), ACTIVE (coral with a pulsing dot), FINISHED (neutral).
const STYLES = {
  READY: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  ACTIVE: 'bg-primary-container/[0.12] text-primary',
  FINISHED: 'bg-surface-container-high text-on-surface-variant',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-space-sm py-1 rounded-full font-label-ui text-label-ui ${
        STYLES[status] ?? STYLES.FINISHED
      }`}
    >
      {status === 'ACTIVE' && (
        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
      )}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
