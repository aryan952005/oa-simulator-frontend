import { availableCount } from '../lib/builder';
import { plural } from '../lib/format';
import { DIFFICULTIES, DIFFICULTY_LABEL, topicLabel } from '../lib/labels';

// One question of the round (spec S5): a topic, a difficulty, how many problems exist, and Remove.
export default function QuestionCard({ number, slot, topics, canRemove, messages, onChange, onRemove }) {
  const topicId = `topic-${slot.id}`;
  const count = availableCount(topics, slot.topic, slot.difficulty);
  const flagged = messages.length > 0;

  return (
    <section
      aria-label={`Question ${number}`}
      data-flagged={flagged ? 'true' : 'false'}
      className={`rounded-xl border p-space-lg flex flex-col gap-space-md shadow-level-1 ${
        flagged ? 'border-error bg-error-container/30' : 'border-border-subtle bg-surface-container-lowest'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Question {number}</h3>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove question ${number}`}
          className="h-9 px-space-md rounded-lg border border-error text-error font-label-ui text-label-ui hover:bg-error/[0.08] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all"
        >
          Remove
        </button>
      </div>

      <div className="flex flex-col gap-space-xs">
        <label htmlFor={topicId} className="font-label-ui text-label-ui text-on-surface">
          Topic
        </label>
        <select
          id={topicId}
          value={slot.topic}
          onChange={(event) => onChange({ topic: event.target.value })}
          className="w-full h-11 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md border border-border-subtle px-space-md outline-none focus:border-primary-container focus:shadow-focus-ring"
        >
          {topics.map(({ topic }) => (
            <option key={topic} value={topic}>
              {topicLabel(topic)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-space-xs">
        <span id={`difficulty-label-${slot.id}`} className="font-label-ui text-label-ui text-on-surface">
          Difficulty
        </span>
        <div role="radiogroup" aria-labelledby={`difficulty-label-${slot.id}`} className="grid grid-cols-3 gap-space-sm">
          {DIFFICULTIES.map((difficulty) => {
            const optionCount = availableCount(topics, slot.topic, difficulty);
            const selected = slot.difficulty === difficulty;
            const disabled = optionCount === 0;
            return (
              <button
                key={difficulty}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange({ difficulty })}
                className={`h-14 rounded-lg border flex flex-col items-center justify-center transition-all ${
                  selected
                    ? 'bg-primary-container text-on-primary border-primary-container shadow-primary-hover'
                    : 'bg-surface border-border-subtle text-on-surface hover:bg-surface-container-lowest hover:border-border-hover'
                } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-surface hover:border-border-subtle' : ''}`}
              >
                <span className="font-label-ui text-label-ui">{DIFFICULTY_LABEL[difficulty]}</span>
                <span className="font-label-code-sm text-label-code-sm">{optionCount}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">{plural(count, 'problem')} available</p>

      {messages.map((message) => (
        <p key={message} className="font-body-sm text-body-sm text-on-error-container font-label-ui">
          {message}
        </p>
      ))}
    </section>
  );
}
