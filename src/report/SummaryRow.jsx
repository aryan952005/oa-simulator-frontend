import { formatDuration, formatLongMinutes } from '../lib/format';
import { wholeMinutes } from '../lib/report';

function Stat({ label, value }) {
  return (
    <div role="group" aria-label={label} className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg flex flex-col gap-space-xs">
      <span className="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">{label}</span>
      <span className="font-headline-md text-headline-md text-on-surface">{value}</span>
    </div>
  );
}

// Spec S10, Summary row: Solved (`solved` of `total`), Time used, Allotted and Time left, in whole minutes.
// Time used reads as `h h m min` when over an hour (FR19). Allotted and Time left are plain minutes.
export default function SummaryRow({ summary }) {
  return (
    <section aria-label="Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
      <Stat label="Solved" value={`${summary.solved} of ${summary.total}`} />
      <Stat label="Time used" value={formatLongMinutes(wholeMinutes(summary.timeUsedSec))} />
      <Stat label="Allotted" value={formatDuration(wholeMinutes(summary.timeAllottedSec))} />
      <Stat label="Time left" value={formatDuration(wholeMinutes(summary.timeLeftSec))} />
    </section>
  );
}
