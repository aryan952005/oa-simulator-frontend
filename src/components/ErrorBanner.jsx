import { MAX_READY_ROUNDS } from '../config/limits';

// Banner texts from frontend spec section 3.3. Only the codes the screens built so far can meet are here.
export function bannerText(error) {
  switch (error && error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Email or password is incorrect.';
    case 'READY_LIMIT_REACHED':
      return `You already have ${MAX_READY_ROUNDS} ready rounds. Start or delete one first.`;
    case 'NETWORK_ERROR':
      return "Can't reach the server. Check your connection.";
    case 'TOO_MANY_REQUESTS':
      return error.retryAfterSeconds
        ? `Too many requests. Try again in ${error.retryAfterSeconds} seconds.`
        : 'Too many requests. Try again shortly.';
    case 'VALIDATION_ERROR':
      // §3.3: shown as a banner only when no field is named in details.
      return error.message || 'Check your details and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

// Retry only makes sense when the request may simply have failed (§3.3).
export function canRetry(error) {
  return Boolean(error) && (error.code === 'NETWORK_ERROR' || error.code === 'INTERNAL_ERROR');
}

export default function ErrorBanner({ error, onRetry }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-space-md rounded-lg border border-error bg-error-container text-on-error-container px-space-md py-space-sm"
    >
      <span className="font-body-md text-body-md">{bannerText(error)}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-10 px-space-md rounded-lg bg-surface text-on-surface border border-border-subtle font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover transition-all"
        >
          Retry
        </button>
      )}
    </div>
  );
}
