import { useEffect, useRef } from 'react';

// A confirmation step before something that cannot be undone (spec S6 Delete).
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Deleting…',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  // The keyboard handler always sees the latest props without being set up again on every render.
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };

  // On open, focus moves to Cancel (the safe choice). On close, it goes back to what had it before.
  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Escape cancels (unless busy), and Tab stays inside the dialog (it is modal).
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !latest.current.busy) {
        latest.current.onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled])')];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/40 p-space-md">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-md bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-3 p-space-lg flex flex-col gap-space-md focus:outline-none"
      >
        <h2 id="confirm-title" className="font-headline-md text-headline-md text-on-surface">
          {title}
        </h2>
        <p id="confirm-message" className="font-body-md text-body-md text-on-surface-variant">
          {message}
        </p>
        <div className="flex justify-end gap-space-sm">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 px-space-lg rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover disabled:opacity-60 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-11 px-space-lg rounded-lg font-label-ui text-label-ui disabled:opacity-60 transition-all ${
              tone === 'primary'
                ? 'bg-primary-container text-on-primary hover:bg-primary-hover hover:shadow-primary-hover'
                : 'border border-error text-error hover:bg-error/[0.08]'
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
