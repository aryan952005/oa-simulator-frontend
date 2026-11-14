import { Suspense, lazy, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { finishRound, getRound, openQuestion, runCode, saveCode, submitCode } from '../api/rounds';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorBanner, { bannerText, canRetry } from '../components/ErrorBanner';
import RoundNotFound from '../components/RoundNotFound';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_CODE_CHARS,
  MAX_RUNS,
  MAX_SUBMITS,
  PRE_DEADLINE_SAVE_SECONDS,
  RUN_COOLDOWN_MS,
  SUBMIT_COOLDOWN_MS,
} from '../config/limits';
import { remainingMs } from '../lib/clock';
import { formatDateTime } from '../lib/format';
import { routeForStatus } from '../lib/routing';
import AttemptToolbar from './AttemptToolbar';
import Countdown from './Countdown';
import ProblemPanel from './ProblemPanel';
import QuestionTabs from './QuestionTabs';
import ResultsConsole from './ResultsConsole';

// Loaded only on this screen, so the editor's code is not part of the other pages.
const CodeEditor = lazy(() => import('../components/CodeEditor'));

// Spec S8, Expiry: after time is up, ask E8 every 2 seconds, up to 10 times.
const EXPIRY_POLL_MS = 2000;
const EXPIRY_POLL_RETRIES = 10;

export const codeTooLargeMessage = () => `Your code is longer than ${MAX_CODE_CHARS.toLocaleString('en-US')} characters.`;
export const NOT_SAVED_MESSAGE = 'Not saved. Retrying on your next change.';

// What each question keeps in memory while the tab is open (spec S8).
//  status: unopened | opening | open | error      saveState: saved | unsaved | saving | failed
//  result: the last Run or Submit result for this question (spec S9), or null
const BLANK = { status: 'unopened', error: null, data: null, code: '', lastSavedCode: '', saveState: 'saved', sizeError: false, result: null };

const selectedKey = (roundId) => `oa.selected.${roundId}`;

function readSelected(roundId, count) {
  try {
    const stored = Number(sessionStorage.getItem(selectedKey(roundId)));
    if (Number.isInteger(stored) && stored >= 1 && stored <= count) return stored;
  } catch {
    // sessionStorage can be unavailable. The first question is the fallback.
  }
  return 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SECONDARY_BUTTON =
  'inline-flex items-center justify-center h-10 px-space-lg rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all';

function SaveStatus({ question }) {
  if (question.status !== 'open') return null;
  const { saveState } = question;
  const text =
    saveState === 'failed' ? NOT_SAVED_MESSAGE : saveState === 'saved' ? 'Saved' : 'Saving…';
  return (
    <span
      role="status"
      data-save-state={saveState}
      className={`font-body-sm text-body-sm ${saveState === 'failed' ? 'text-error' : 'text-on-surface-variant'}`}
    >
      {text}
    </span>
  );
}

// S8 Workspace. RoundGate has already checked that the round is ACTIVE (FR15) and gives it to us.
export default function Workspace({ round }) {
  const navigate = useNavigate();
  const roundId = round.id;

  // In-memory state per question. A ref holds the truth (timers and requests read it at any moment);
  // `bump` makes React draw it again.
  const questions = useRef({});
  const [, bump] = useReducer((n) => n + 1, 0);
  const get = useCallback((index) => questions.current[index] ?? BLANK, []);
  const patch = useCallback((index, changes) => {
    questions.current[index] = { ...(questions.current[index] ?? BLANK), ...changes };
    bump();
  }, []);

  const timers = useRef({}); // the autosave debounce timer of each question
  const inflight = useRef({}); // a save that is on its way, per question
  const mounted = useRef(true);
  const expiredRef = useRef(false);
  const preFlushed = useRef(false);

  const [selected, setSelected] = useState(() => readSelected(roundId, round.slots.length));
  const selectedRef = useRef(selected);
  const [slots, setSlots] = useState(round.slots); // chips and counters, from E8
  const [notFound, setNotFound] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [waitingForServer, setWaitingForServer] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Run and Submit (spec S9). Their cooldowns are per round (backend D34), so they are kept here,
  // not per question. A cooldown is a laptop-clock time only used to measure the wait.
  const slotsRef = useRef(round.slots);
  const pendingRef = useRef({ run: false, submit: false });
  const cooldownRef = useRef({ run: 0, submit: 0 });
  const finishingRef = useRef(false);
  const [pending, setPending] = useState({ run: false, submit: false });
  const [cooldownUntil, setCooldownUntil] = useState({ run: 0, submit: 0 });
  const [attemptMessage, setAttemptMessage] = useState(null); // { index, text }
  slotsRef.current = slots;

  const goToReport = useCallback(() => navigate(`/rounds/${encodeURIComponent(roundId)}/report`, { replace: true }), [navigate, roundId]);

  // ROUND_NOT_ACTIVE: reload the round and route by its status (FR15).
  const routeByStatus = useCallback(async () => {
    try {
      const fresh = await getRound(roundId);
      if (fresh.status !== 'ACTIVE') navigate(routeForStatus(roundId, fresh.status), { replace: true });
      else setPageError({ code: 'INTERNAL_ERROR' });
    } catch (err) {
      if (err.code === 'NOT_FOUND') setNotFound(true);
      else setPageError(err);
    }
  }, [navigate, roundId]);

  // Errors every call in the workspace shares (spec S8). Returns true when the error was handled here.
  const handleRoundError = useCallback(
    (err) => {
      if (err.code === 'ROUND_EXPIRED') {
        goToReport();
        return true;
      }
      if (err.code === 'ROUND_NOT_ACTIVE') {
        routeByStatus();
        return true;
      }
      if (err.code === 'NOT_FOUND') {
        setNotFound(true);
        return true;
      }
      return false;
    },
    [goToReport, routeByStatus],
  );

  // --- Opening a question (E12). The first time only: each call starts that question's clock.
  const open = useCallback(
    async (index) => {
      const current = get(index);
      if (current.status === 'open' || current.status === 'opening') return;
      patch(index, { status: 'opening', error: null });
      try {
        const data = await openQuestion(roundId, index);
        const saved = typeof data.code === 'string' ? data.code : '';
        patch(index, { status: 'open', data, code: saved, lastSavedCode: saved, saveState: 'saved', sizeError: false });
        setSlots((previous) => previous.map((slot) => (slot.index === index ? { ...slot, opened: true } : slot)));
      } catch (err) {
        if (handleRoundError(err)) return;
        patch(index, { status: 'error', error: err });
      }
    },
    [get, patch, roundId, handleRoundError],
  );

  // --- Saving (E13) ---
  // `quiet` is for the last save at expiry and at Finish: a failure is ignored.
  const save = useCallback(
    async (index, { quiet = false } = {}) => {
      if (inflight.current[index]) await inflight.current[index].catch(() => {});
      const current = get(index);
      if (current.status !== 'open') return true;

      clearTimeout(timers.current[index]);
      delete timers.current[index];

      if (current.code === current.lastSavedCode) {
        if (current.saveState !== 'saved') patch(index, { saveState: 'saved' });
        return true;
      }
      if (current.code.length > MAX_CODE_CHARS) {
        patch(index, { sizeError: true, saveState: 'failed' }); // too long: it is not sent
        return false;
      }

      const sent = current.code;
      patch(index, { saveState: 'saving' });
      const request = saveCode(roundId, index, sent);
      inflight.current[index] = request;
      try {
        await request;
        // The student may have typed more while this was on its way.
        patch(index, { lastSavedCode: sent, saveState: get(index).code === sent ? 'saved' : 'unsaved' });
        return true;
      } catch (err) {
        if (!quiet && handleRoundError(err)) return false;
        patch(index, { saveState: 'failed', ...(err.code === 'CODE_TOO_LARGE' ? { sizeError: true } : {}) });
        return false;
      } finally {
        if (inflight.current[index] === request) delete inflight.current[index];
      }
    },
    [get, patch, roundId, handleRoundError],
  );

  const saveAllUnsaved = useCallback(
    async (options) => {
      const indexes = Object.keys(questions.current)
        .map(Number)
        .filter((i) => {
          const q = questions.current[i];
          return q.status === 'open' && q.code !== q.lastSavedCode;
        });
      await Promise.allSettled(indexes.map((i) => save(i, options)));
    },
    [save],
  );

  // After each change: wait AUTOSAVE_DEBOUNCE_MS after the last keystroke, then save if the code changed.
  // In the last PRE_DEADLINE_SAVE_SECONDS every change is saved at once (spec S8, FD14).
  const onCodeChange = useCallback(
    (index, code) => {
      const current = get(index);
      if (current.status !== 'open' || expiredRef.current) return;
      const tooLarge = code.length > MAX_CODE_CHARS;
      patch(index, { code, sizeError: tooLarge, saveState: code === current.lastSavedCode ? 'saved' : 'unsaved' });
      clearTimeout(timers.current[index]);
      if (code === current.lastSavedCode || tooLarge) return;
      if (remainingMs(round.deadline) <= PRE_DEADLINE_SAVE_SECONDS * 1000) {
        save(index);
      } else {
        timers.current[index] = setTimeout(() => save(index), AUTOSAVE_DEBOUNCE_MS);
      }
    },
    [get, patch, save, round.deadline],
  );

  // --- Switching questions: save the current one first, then switch. Unsaved code is never dropped.
  const select = useCallback(
    async (index) => {
      if (index === selectedRef.current) return;
      await save(selectedRef.current); // a failure keeps the code in memory and does not block the switch
      if (!mounted.current) return;
      selectedRef.current = index;
      setSelected(index);
      try {
        sessionStorage.setItem(selectedKey(roundId), String(index));
      } catch {
        // Not being able to remember the question is harmless.
      }
      open(index);
    },
    [save, open, roundId],
  );

  // Entry: open the first question, or the last one selected in this visit.
  useEffect(() => {
    open(selectedRef.current);
  }, [open]);

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  // --- The last seconds, and time running out ---
  const onPreDeadline = useCallback(() => {
    if (preFlushed.current) return;
    preFlushed.current = true;
    saveAllUnsaved();
  }, [saveAllUnsaved]);

  const onZero = useCallback(async () => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setExpired(true);
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    await saveAllUnsaved({ quiet: true }); // one last save; a failure is ignored
    for (let attempt = 0; attempt <= EXPIRY_POLL_RETRIES; attempt += 1) {
      if (!mounted.current) return;
      try {
        const fresh = await getRound(roundId);
        if (fresh.status !== 'ACTIVE') {
          navigate(routeForStatus(roundId, fresh.status), { replace: true });
          return;
        }
      } catch (err) {
        if (err.code === 'NOT_FOUND') {
          setNotFound(true);
          return;
        }
        // Any other failure counts as an attempt that did not work.
      }
      if (attempt < EXPIRY_POLL_RETRIES) await sleep(EXPIRY_POLL_MS);
    }
    if (mounted.current) setWaitingForServer(true);
  }, [saveAllUnsaved, roundId, navigate]);

  // --- Run (E14) and Submit (E15) ---
  const startCooldown = useCallback((kind, ms) => {
    const until = Date.now() + ms;
    cooldownRef.current = { ...cooldownRef.current, [kind]: until };
    setCooldownUntil((previous) => ({ ...previous, [kind]: until }));
  }, []);

  const attempt = useCallback(
    async (kind) => {
      const index = selectedRef.current;
      const current = get(index);
      const slot = slotsRef.current.find((s) => s.index === index);
      const left = kind === 'run' ? MAX_RUNS - slot.runCount : MAX_SUBMITS - slot.submitCount;
      if (current.status !== 'open' || expiredRef.current || finishingRef.current) return;
      if (pendingRef.current[kind] || Date.now() < cooldownRef.current[kind] || left <= 0) return;
      if (current.code.length > MAX_CODE_CHARS) return; // the message under the editor already says so; nothing is sent

      setAttemptMessage(null);
      pendingRef.current[kind] = true;
      setPending((previous) => ({ ...previous, [kind]: true }));
      const sent = current.code;
      try {
        const data = kind === 'run' ? await runCode(roundId, index, sent) : await submitCode(roundId, index, sent);
        // The backend saves the code on every Run and Submit (D22), so it is saved now.
        patch(index, {
          result: { kind, ...data },
          lastSavedCode: sent,
          saveState: get(index).code === sent ? 'saved' : 'unsaved',
        });
        // Counters come from the response. Chips follow from them.
        setSlots((previous) =>
          previous.map((s) => {
            if (s.index !== index) return s;
            if (kind === 'run') return { ...s, runCount: Math.min(MAX_RUNS, Math.max(0, MAX_RUNS - data.runsLeft)) };
            return {
              ...s,
              submitCount: Math.min(MAX_SUBMITS, Math.max(0, MAX_SUBMITS - data.submitsLeft)),
              solved: s.solved || data.solved,
            };
          }),
        );
        startCooldown(kind, kind === 'run' ? RUN_COOLDOWN_MS : SUBMIT_COOLDOWN_MS);
      } catch (err) {
        if (handleRoundError(err)) return;
        if (err.code === 'COOLDOWN') {
          // The server's wait overrides the usual one. Its text is the wait line under the buttons.
          startCooldown(kind, Math.max(1, err.retryAfterSeconds ?? 1) * 1000);
        } else if (err.code === 'ATTEMPT_LIMIT') {
          setSlots((previous) =>
            previous.map((s) =>
              s.index !== index ? s : kind === 'run' ? { ...s, runCount: MAX_RUNS } : { ...s, submitCount: MAX_SUBMITS },
            ),
          );
        } else if (err.code === 'CODE_TOO_LARGE') {
          setAttemptMessage({ index, text: codeTooLargeMessage() });
        } else {
          // Includes RUNNER_UNAVAILABLE: "Something went wrong. Try again." and the counters stay as they are.
          setAttemptMessage({ index, text: bannerText(err) });
        }
      } finally {
        pendingRef.current[kind] = false;
        if (mounted.current) setPending((previous) => ({ ...previous, [kind]: false }));
      }
    },
    [get, patch, roundId, handleRoundError, startCooldown],
  );

  // --- Finish (E11) ---
  const finish = useCallback(async () => {
    finishingRef.current = true;
    setFinishing(true);
    setPageError(null);
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    await saveAllUnsaved({ quiet: true }); // a failed save does not block Finish
    try {
      await finishRound(roundId); // safe to repeat
      goToReport();
    } catch (err) {
      if (handleRoundError(err)) return;
      finishingRef.current = false;
      setFinishing(false);
      setConfirmingFinish(false);
      setPageError(err);
    }
  }, [saveAllUnsaved, roundId, goToReport, handleRoundError]);

  // FR25: while any question has unsaved code, closing or reloading the page shows the browser's warning.
  const hasUnsaved = Object.values(questions.current).some((q) => q.status === 'open' && q.code !== q.lastSavedCode);
  useEffect(() => {
    if (!hasUnsaved) return undefined;
    function warn(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  if (notFound) {
    return (
      <div className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-lg">
        <RoundNotFound />
      </div>
    );
  }

  const question = get(selected);
  const slot = slots.find((s) => s.index === selected) ?? slots[0];
  const locked = expired || finishing;

  return (
    <div data-testid="screen-S8" className="h-screen flex flex-col bg-surface">
      <header className="h-16 shrink-0 flex items-center justify-between gap-space-md px-space-lg bg-surface border-b border-border-subtle">
        <p className="font-body-md text-body-md text-on-surface-variant">Started {formatDateTime(round.startedAt)}</p>
        <div className="flex items-center gap-space-md">
          <Countdown deadline={round.deadline} onPreDeadline={onPreDeadline} onZero={onZero} frozen={expired} />
          <button type="button" onClick={() => setConfirmingFinish(true)} disabled={locked} className={SECONDARY_BUTTON}>
            Finish
          </button>
        </div>
      </header>

      {(pageError || waitingForServer) && (
        <div className="shrink-0 px-space-lg pt-space-md flex flex-col gap-space-sm">
          {pageError && <ErrorBanner error={pageError} onRetry={canRetry(pageError) ? finish : undefined} />}
          {waitingForServer && (
            <p role="status" className="font-body-md text-body-md text-on-surface">
              Waiting for the server to close the round.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <section aria-label="Question" className="w-[45%] overflow-y-auto border-r border-border-subtle p-space-lg flex flex-col gap-space-lg">
          <QuestionTabs slots={slots} selected={selected} onSelect={select} disabled={finishing} />
          <ProblemPanel question={question} onRetry={() => open(selected)} />
        </section>

        <section aria-label="Code" className="w-[55%] flex flex-col min-h-0 p-space-md gap-space-md">
          <div className="flex items-center justify-between">
            <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Python 3</span>
            <SaveStatus question={question} />
          </div>

          <div className="flex-1 min-h-[200px] rounded-lg overflow-hidden border border-editor-border bg-editor shadow-editor-inset">
            {question.status === 'open' ? (
              <Suspense fallback={<div aria-hidden="true" className="h-full w-full bg-editor animate-pulse" />}>
                <CodeEditor
                  path={`question-${selected}`}
                  value={question.code}
                  onChange={(code) => onCodeChange(selected, code)}
                  readOnly={locked}
                />
              </Suspense>
            ) : (
              <div aria-hidden="true" className="h-full w-full bg-editor animate-pulse" />
            )}
          </div>

          {question.sizeError && (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {codeTooLargeMessage()}
            </p>
          )}

          <AttemptToolbar
            ready={question.status === 'open'}
            locked={locked}
            runsLeft={MAX_RUNS - slot.runCount}
            submitsLeft={MAX_SUBMITS - slot.submitCount}
            runPending={pending.run}
            submitPending={pending.submit}
            runCooldownUntil={cooldownUntil.run}
            submitCooldownUntil={cooldownUntil.submit}
            message={attemptMessage && attemptMessage.index === selected ? attemptMessage.text : null}
            onRun={() => attempt('run')}
            onSubmit={() => attempt('submit')}
          />

          <ResultsConsole
            result={question.result}
            runsLeft={MAX_RUNS - slot.runCount}
            submitsLeft={MAX_SUBMITS - slot.submitCount}
          />
        </section>
      </div>

      {confirmingFinish && (
        <ConfirmDialog
          title="Finish round"
          message="Finish the round now? You cannot run or submit after this."
          confirmLabel="Finish round"
          busyLabel="Finishing…"
          tone="primary"
          busy={finishing}
          onConfirm={finish}
          onCancel={() => setConfirmingFinish(false)}
        />
      )}
    </div>
  );
}
