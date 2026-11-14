import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRound, getTopics } from '../api/rounds';
import EmptyState from '../components/EmptyState';
import ErrorBanner, { canRetry } from '../components/ErrorBanner';
import QuestionCard from '../components/QuestionCard';
import Skeleton from '../components/Skeleton';
import { MAX_DURATION_MIN, MAX_QUESTIONS, MIN_DURATION_MIN, MIN_QUESTIONS } from '../config/limits';
import { useApi } from '../hooks/useApi';
import {
  defaultSlot,
  difficultyAfterTopicChange,
  initialSlots,
  parseShortDetails,
  shortGroups,
  suggestedMinutes,
  validateDuration,
} from '../lib/builder';
import { fieldErrorsFromDetails } from '../lib/validation';

function Frame({ children }) {
  return (
    <div data-testid="screen-S5" className="max-w-[1440px] mx-auto px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Create round</h1>
      {children}
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading topics" className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
      <div className="lg:col-span-8 flex flex-col gap-space-md">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="lg:col-span-4 h-72" />
    </div>
  );
}

// S5 Create round (/rounds/new)
export default function CreateRoundPage() {
  const topics = useApi((options) => getTopics(options), []);

  if (topics.status === 'loading') {
    return (
      <Frame>
        <BuilderSkeleton />
      </Frame>
    );
  }
  if (topics.status === 'error') {
    return (
      <Frame>
        <ErrorBanner error={topics.error} onRetry={topics.reload} />
      </Frame>
    );
  }
  if (topics.data.length === 0) {
    return (
      <Frame>
        <div className="bg-surface-container-lowest border border-border-subtle rounded-xl">
          <EmptyState title="No questions are available yet" text="Come back later to build a round." />
        </div>
      </Frame>
    );
  }
  return (
    <Frame>
      <RoundBuilder topics={topics.data} />
    </Frame>
  );
}

function RoundBuilder({ topics }) {
  const navigate = useNavigate();
  const nextId = useRef(0);
  const withId = (slot) => ({ ...slot, id: nextId.current++ });

  const [slots, setSlots] = useState(() => initialSlots(topics).map(withId));
  // null means "follow the suggested total". Typing in the field sets the text, Use suggested resets it.
  const [durationText, setDurationText] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [serverShort, setServerShort] = useState(null); // the 422 groups from the last Create round
  const [serverDurationError, setServerDurationError] = useState(null);
  const [error, setError] = useState(null); // an ApiError shown as a banner
  const [submitting, setSubmitting] = useState(false);

  const suggested = suggestedMinutes(slots);
  const duration = durationText ?? String(suggested);
  const durationError = validateDuration(duration);
  const showDurationError = (durationText !== null || attempted) && durationError;

  const clientShort = shortGroups(topics, slots);
  const cannotCreate = clientShort.length > 0 || submitting;

  // Messages per card, by question number (1-based).
  const messagesFor = (number) => {
    const messages = [];
    for (const group of clientShort) {
      if (group.slots.includes(number)) {
        messages.push(
          `Only ${group.available} ${group.available === 1 ? 'problem' : 'problems'} available for this topic and difficulty.`,
        );
      }
    }
    for (const group of serverShort ?? []) {
      if (group.slots.includes(number)) {
        messages.push(
          `Not enough ${group.difficulty} ${group.topic} problems: ${group.requested} requested, ${group.available} available.`,
        );
      }
    }
    return messages;
  };

  // Any change to the questions makes an old 422 highlight out of date.
  function changeSlots(updater) {
    setSlots(updater);
    setServerShort(null);
    setError(null);
  }

  function updateSlot(id, patch) {
    changeSlots((current) =>
      current.map((slot) => {
        if (slot.id !== id) return slot;
        const next = { ...slot, ...patch };
        if (patch.topic !== undefined) {
          next.difficulty = difficultyAfterTopicChange(topics, patch.topic, slot.difficulty);
        }
        return next;
      }),
    );
  }

  const addQuestion = () => changeSlots((current) => [...current, withId(defaultSlot(topics, current))]);
  const removeLast = () => changeSlots((current) => current.slice(0, -1));
  const removeSlot = (id) => changeSlots((current) => current.filter((slot) => slot.id !== id));

  async function submit(event) {
    if (event) event.preventDefault();
    if (cannotCreate) return;
    setAttempted(true);
    setError(null);
    setServerDurationError(null);
    if (durationError) return;

    setSubmitting(true);
    try {
      const round = await createRound({
        slots: slots.map(({ topic, difficulty }) => ({ topic, difficulty })),
        durationMin: Number(duration),
      });
      navigate(`/rounds/${round.id}`);
    } catch (err) {
      setSubmitting(false);
      if (err.code === 'NOT_ENOUGH_PROBLEMS') {
        const groups = parseShortDetails(err.details);
        if (groups) setServerShort(groups);
        else setError(err);
      } else if (err.code === 'VALIDATION_ERROR') {
        const { fields, unmatched } = fieldErrorsFromDetails(err.details, ['durationMin']);
        if (fields.durationMin) setServerDurationError(fields.durationMin);
        if (unmatched) setError(err);
      } else {
        setError(err);
      }
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
      <div className="lg:col-span-8 flex flex-col gap-space-md">
        {error && <ErrorBanner error={error} onRetry={canRetry(error) ? submit : undefined} />}

        <div className="flex items-center justify-between bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 px-space-lg py-space-md">
          <span id="count-label" className="font-headline-sm text-headline-sm text-on-surface">
            Questions
          </span>
          <div role="group" aria-labelledby="count-label" className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={removeLast}
              disabled={slots.length <= MIN_QUESTIONS}
              aria-label="Fewer questions"
              className="w-10 h-10 rounded-lg border border-border-subtle bg-surface text-on-surface hover:bg-surface-container-lowest hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                remove
              </span>
            </button>
            <output aria-live="polite" data-testid="question-count" className="font-headline-md text-headline-md text-on-surface w-8 text-center">
              {slots.length}
            </output>
            <button
              type="button"
              onClick={addQuestion}
              disabled={slots.length >= MAX_QUESTIONS}
              aria-label="More questions"
              className="w-10 h-10 rounded-lg border border-border-subtle bg-surface text-on-surface hover:bg-surface-container-lowest hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                add
              </span>
            </button>
          </div>
        </div>

        {slots.map((slot, index) => (
          <QuestionCard
            key={slot.id}
            number={index + 1}
            slot={slot}
            topics={topics}
            canRemove={slots.length > MIN_QUESTIONS}
            messages={messagesFor(index + 1)}
            onChange={(patch) => updateSlot(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
          />
        ))}
      </div>

      <aside
        aria-label="Round summary"
        className="lg:col-span-4 lg:sticky lg:top-24 bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg flex flex-col gap-space-md"
      >
        <h2 className="font-headline-md text-headline-md text-on-surface">Summary</h2>
        <dl className="flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <dt className="font-body-md text-body-md text-on-surface-variant">Questions</dt>
            <dd data-testid="summary-questions" className="font-label-ui text-label-ui text-on-surface">
              {slots.length}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-body-md text-body-md text-on-surface-variant">Suggested minutes</dt>
            <dd data-testid="summary-suggested" className="font-label-ui text-label-ui text-on-surface">
              {suggested}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-space-xs">
          <label htmlFor="duration" className="font-label-ui text-label-ui text-on-surface">
            Duration (minutes)
          </label>
          <div className="flex items-center gap-space-sm">
            <input
              id="duration"
              inputMode="numeric"
              autoComplete="off"
              value={duration}
              onChange={(event) => {
                setDurationText(event.target.value);
                setServerDurationError(null);
              }}
              aria-invalid={showDurationError || serverDurationError ? 'true' : undefined}
              aria-describedby={showDurationError || serverDurationError ? 'duration-error' : undefined}
              className={`w-28 h-11 rounded-lg bg-surface-container-lowest text-on-surface font-label-code-lg text-label-code-lg px-space-md border outline-none focus:border-primary-container focus:shadow-focus-ring ${
                showDurationError || serverDurationError ? 'border-error' : 'border-border-subtle'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                setDurationText(null);
                setServerDurationError(null);
              }}
              className="h-11 px-space-md rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover transition-all"
            >
              Use suggested
            </button>
          </div>
          {(showDurationError || serverDurationError) && (
            <p id="duration-error" className="font-body-sm text-body-sm text-on-error-container">
              {serverDurationError || durationError}
            </p>
          )}
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {MIN_DURATION_MIN} to {MAX_DURATION_MIN} minutes.
          </p>
        </div>

        <button
          type="submit"
          disabled={cannotCreate}
          className="h-12 rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
        >
          {submitting ? 'Creating…' : 'Create round'}
        </button>
      </aside>
    </form>
  );
}
