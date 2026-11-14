import { Link } from 'react-router-dom';

// The empty state of a list (FR22): a message and, when there is one, the action that fixes it.
export default function EmptyState({ title, text, actionLabel, actionTo }) {
  return (
    <div className="flex flex-col items-center text-center gap-space-sm py-space-xl px-space-lg">
      <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p>
      {text && <p className="font-body-md text-body-md text-on-surface-variant">{text}</p>}
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-space-sm inline-flex items-center justify-center h-11 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
