import QuestionChip from '../components/QuestionChip';
import { difficultyLabel, topicLabel } from '../lib/labels';

// One tab per question, labelled `Q n · Topic · Difficulty` from E8. The statement title is never in a
// tab (FD9): it appears in the problem panel once the question has been opened.
export default function QuestionTabs({ slots, selected, onSelect, disabled }) {
  // The arrow keys, Home and End move focus between the tabs. They never select: selecting opens a
  // question, which starts its clock (E12), so a tab is chosen only with Enter or Space.
  function onKeyDown(event) {
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not([disabled])')];
    const at = tabs.indexOf(document.activeElement);
    if (at === -1) return;
    const target = {
      ArrowRight: tabs[(at + 1) % tabs.length],
      ArrowLeft: tabs[(at - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[event.key];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  return (
    <div role="tablist" aria-label="Questions" onKeyDown={onKeyDown} className="flex flex-wrap gap-space-sm">
      {slots.map((slot) => {
        const active = slot.index === selected;
        return (
          <button
            key={slot.index}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onSelect(slot.index)}
            className={`flex items-center gap-space-sm rounded-lg border px-space-md py-space-sm text-left transition-all disabled:opacity-60 ${
              active
                ? 'border-primary-container bg-surface-container-lowest shadow-level-1'
                : 'border-border-subtle bg-surface hover:bg-surface-container-lowest hover:border-border-hover'
            }`}
          >
            <span className="font-label-ui text-label-ui text-on-surface whitespace-nowrap">
              Q{slot.index} · {topicLabel(slot.topic)} · {difficultyLabel(slot.difficulty)}
            </span>
            <QuestionChip slot={slot} />
          </button>
        );
      })}
    </div>
  );
}
