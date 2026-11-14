import { Link } from 'react-router-dom';
import { formatDateTime, formatDuration } from '../lib/format';
import { GRADE_LABEL, GRADE_TONE, endedLabel } from '../lib/labels';
import { BADGE_STYLE } from './tones';

const SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-space-xs h-11 px-space-lg rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover transition-all';

function Fact({ label, children }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <dt className="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">{label}</dt>
      <dd className="font-body-lg text-body-lg text-on-surface">{children}</dd>
    </div>
  );
}

// Spec S10, Header: the round's date and time, the duration, how it ended, and the grade badge.
// The round is named by its creation date and time (FR18). Print and Back to my rounds sit on the right.
export default function ReportHeader({ createdAt, report }) {
  const tone = GRADE_TONE[report.grade];
  return (
    <header className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex flex-wrap items-center gap-space-md">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Round report</h1>
          <span
            data-testid="grade-badge"
            data-grade={report.grade}
            className={`inline-flex items-center px-space-md py-1 rounded-full border font-headline-sm text-headline-sm ${BADGE_STYLE[tone]}`}
          >
            {GRADE_LABEL[report.grade]}
          </span>
        </div>
        <div className="flex items-center gap-space-sm print:hidden">
          <button type="button" onClick={() => window.print()} className={SECONDARY_BUTTON}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              print
            </span>
            Print
          </button>
          <Link to="/rounds" className={SECONDARY_BUTTON}>
            Back to my rounds
          </Link>
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-space-xl gap-y-space-md">
        <Fact label="Round">{formatDateTime(createdAt)}</Fact>
        <Fact label="Duration">{formatDuration(report.durationMin)}</Fact>
        <Fact label="Ended">{endedLabel({ status: 'FINISHED', finishReason: report.finishReason })}</Fact>
      </dl>
    </header>
  );
}
