import { slotStatus } from '../lib/labels';

// The status chip of a question (spec S4 and S8). Solved is green (DESIGN.md decision 11).
const CHIP_STYLES = {
  Solved: 'bg-success/[0.12] text-success',
  Attempted: 'bg-secondary-container/30 text-on-secondary-container',
  Opened: 'bg-surface-container-high text-on-surface',
  'Not opened': 'bg-surface-container text-on-surface-variant',
};

export default function QuestionChip({ slot }) {
  const label = slotStatus(slot);
  return (
    <span className={`px-space-sm py-0.5 rounded-full font-label-ui text-label-ui whitespace-nowrap ${CHIP_STYLES[label]}`}>
      {label}
    </span>
  );
}
