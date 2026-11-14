import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRound } from '../api/rounds';
import ErrorBanner, { canRetry } from '../components/ErrorBanner';
import { formatDuration } from '../lib/format';
import { difficultyLabel, topicLabel } from '../lib/labels';
import { parseShortDetails } from '../lib/builder';

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center h-12 px-space-xl rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all';

// The same short-group message as the round builder (spec S5).
const shortMessage = (group) =>
  `Not enough ${group.difficulty} ${group.topic} problems: ${group.requested} requested, ${group.available} available.`;

// Spec S10, Next round card: the `nextRound.reason` text, the suggested questions and the duration.
// Create this round calls E6 with the suggested slots and duration.
export default function NextRoundCard({ nextRound }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [short, setShort] = useState(null); // the 422 groups, shown next to the questions they name

  if (nextRound.slots.length === 0) return null;

  async function create() {
    if (creating) return;
    setCreating(true);
    setError(null);
    setShort(null);
    try {
      const round = await createRound({
        slots: nextRound.slots.map(({ topic, difficulty }) => ({ topic, difficulty })),
        durationMin: nextRound.durationMin,
      });
      navigate(`/rounds/${encodeURIComponent(round.id)}`);
    } catch (err) {
      setCreating(false);
      if (err.code === 'NOT_ENOUGH_PROBLEMS') {
        const groups = parseShortDetails(err.details);
        if (groups) setShort(groups);
        else setError(err);
      } else {
        setError(err);
      }
    }
  }

  const messagesFor = (number) => (short ?? []).filter((group) => group.slots.includes(number)).map(shortMessage);

  return (
    <section aria-labelledby="next-round-heading" data-testid="next-round" className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg flex flex-col gap-space-md break-inside-avoid">
      <h2 id="next-round-heading" className="font-headline-md text-headline-md text-on-surface">
        Next round
      </h2>
      <p className="font-body-lg text-body-lg text-on-surface">{nextRound.reason}</p>
      {error && <ErrorBanner error={error} onRetry={canRetry(error) ? create : undefined} />}
      <ul className="flex flex-col gap-space-sm">
        {nextRound.slots.map((slot, index) => {
          const messages = messagesFor(index + 1);
          return (
            <li
              key={index}
              data-testid="next-round-slot"
              data-short={messages.length > 0 ? 'true' : 'false'}
              className={`flex flex-col gap-space-xs rounded-lg border px-space-md py-space-sm bg-surface ${messages.length > 0 ? 'border-error' : 'border-border-subtle'}`}
            >
              <span className="font-body-md text-body-md text-on-surface">{`Q${index + 1} · ${topicLabel(slot.topic)} · ${difficultyLabel(slot.difficulty)}`}</span>
              {messages.map((message) => (
                <span key={message} role="alert" className="font-body-sm text-body-sm text-error">
                  {message}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-space-md">
        <span className="font-body-md text-body-md text-on-surface-variant">{`Duration: ${formatDuration(nextRound.durationMin)}`}</span>
        <button type="button" onClick={create} disabled={creating} className={`${PRIMARY_BUTTON} print:hidden`}>
          {creating ? 'Creating…' : 'Create this round'}
        </button>
      </div>
    </section>
  );
}
