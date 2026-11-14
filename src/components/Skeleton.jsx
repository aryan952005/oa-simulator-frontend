// A grey block that pulses while data loads (FR22). Shape it with className.
export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`rounded-lg bg-surface-container-high animate-pulse ${className}`} />;
}
