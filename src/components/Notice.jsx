import { useEffect } from 'react';

// A short confirmation that disappears by itself (spec S6: "show a short confirmation").
export default function Notice({ message, onDone, durationMs = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDone, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-space-lg left-1/2 -translate-x-1/2 z-[60] bg-inverse-surface text-inverse-on-surface rounded-lg shadow-level-3 px-space-lg py-space-sm font-label-ui text-label-ui"
    >
      {message}
    </div>
  );
}
