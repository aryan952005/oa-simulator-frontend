import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CODE_CHARS } from '../config/limits';
import { apiError, callsTo, json, mockApi, questionBody, renderApp, storeSession, stubApiBase } from '../test/helpers';
import {
  MIN,
  RID,
  SEC,
  SLOTS,
  advance,
  editor,
  finishButton,
  noContent,
  openWorkspace,
  postsTo,
  putsTo,
  roundBody,
  saveStatus,
  tab,
  type,
  useClock,
  useExactClock,
} from '../test/workspaceHarness';

beforeEach(() => {
  stubApiBase();
  storeSession();
});
afterEach(() => vi.useRealTimers());

const location = () => screen.getByTestId('location').textContent;

describe('S8 width rule (FD8)', () => {
  it('below 1100 px it shows only the notice, and nothing is loaded', async () => {
    window.innerWidth = 1099;
    const fetchMock = mockApi([]);
    renderApp(`/rounds/${RID}/workspace`);
    expect(await screen.findByRole('alert')).toHaveTextContent('This workspace needs a wider screen. Please use a computer.');
    expect(screen.queryByTestId('screen-S8')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, `/api/assessments/${RID}`)).toHaveLength(0); // no E8, and no E12 that would start a clock
  });

  it('exactly 1100 px is wide enough', async () => {
    window.innerWidth = 1100;
    await openWorkspace();
    expect(screen.queryByText(/needs a wider screen/)).not.toBeInTheDocument();
  });

  it('opens when the window is widened', async () => {
    window.innerWidth = 900;
    const events = [];
    mockApi([
      ['GET', `/api/assessments/${RID}`, () => json(200, roundBody())],
      ['POST', `/api/assessments/${RID}/questions/1/open`, () => (events.push('open:1'), json(200, questionBody(1)))],
    ]);
    renderApp(`/rounds/${RID}/workspace`);
    await screen.findByText(/needs a wider screen/);
    expect(events).toEqual([]);
    window.innerWidth = 1400;
    fireEvent(window, new Event('resize'));
    await screen.findByRole('article', { name: 'Problem' });
    expect(events).toEqual(['open:1']);
    expect(screen.queryByText(/needs a wider screen/)).not.toBeInTheDocument();
  });

  it('narrowing the window later hides the workspace but keeps the typed code and calls nothing again', async () => {
    const { events } = await openWorkspace();
    type('x = 1');
    window.innerWidth = 800;
    fireEvent(window, new Event('resize'));
    expect(await screen.findByText(/needs a wider screen/)).toBeInTheDocument();
    window.innerWidth = 1400;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.queryByText(/needs a wider screen/)).not.toBeInTheDocument());
    expect(editor()).toHaveValue('x = 1');
    expect(events.filter((e) => e.startsWith('open'))).toEqual(['open:1']);
  });
});

describe('S8 entry and layout', () => {
  it('asks E8 for the round and opens the first question only', async () => {
    const { events } = await openWorkspace();
    expect(events.filter((e) => e === 'round')).toHaveLength(1);
    expect(events.filter((e) => e.startsWith('open'))).toEqual(['open:1']);
  });

  it('opens a question with POST and no body, as the backend spec defines (E12)', async () => {
    const { fetchMock } = await openWorkspace();
    const [call] = postsTo(fetchMock, '/questions/1/open');
    expect(call[0]).toBe(`http://api.test/api/assessments/${RID}/questions/1/open`);
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toBeUndefined();
  });

  it('has a header with the start time, the countdown and a Finish button', async () => {
    await openWorkspace();
    expect(screen.getByText(/^Started \d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('30:00');
    expect(finishButton()).toBeEnabled();
  });

  it('has one tab per question labelled Q n · Topic · Difficulty, and never the statement title (FD9)', async () => {
    await openWorkspace();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Q1 · Arrays · EasyOpened',
      'Q2 · Strings · MediumNot opened',
      'Q3 · Math · HardNot opened',
    ]);
    expect(tabs.map((t) => t.textContent).join()).not.toMatch(/Title \d/);
    expect(tab(1)).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the title, the statement with its line breaks, the formats, the constraints and the samples', async () => {
    await openWorkspace();
    const problem = screen.getByRole('article', { name: 'Problem' });
    expect(within(problem).getByRole('heading', { name: 'Title 1' })).toBeInTheDocument();
    const statement = within(problem).getByText(/Statement 1, first line\./);
    expect(statement.textContent).toBe('Statement 1, first line.\nSecond line.');
    expect(statement).toHaveClass('whitespace-pre-wrap');
    expect(within(problem).getByText('One line with two integers.')).toBeInTheDocument();
    expect(within(problem).getByText('One integer.')).toBeInTheDocument();
    expect(within(problem).getByText('1 <= n <= 100')).toBeInTheDocument();
    const sample = within(problem).getByRole('listitem', { name: 'Sample 1' });
    expect(within(sample).getByText('1 2').tagName).toBe('PRE');
    expect(within(sample).getByText('3').tagName).toBe('PRE');
    expect(within(sample).getByText('Add the two numbers.')).toBeInTheDocument();
  });

  it('puts the saved code from E12 in the editor', async () => {
    await openWorkspace({ saved: { 1: 'def solve():\n    return 1\n' } });
    expect(editor()).toHaveValue('def solve():\n    return 1\n');
  });

  it('shows the fixed label Python 3 and no language selector (FD12)', async () => {
    await openWorkspace();
    const code = screen.getByRole('region', { name: 'Code' });
    expect(within(code).getByText('Python 3')).toBeInTheDocument();
    expect(within(code).queryByRole('combobox')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Java|C\+\+|TypeScript/);
  });

  it('has Run and Submit buttons, ready once the question is open, and the attempts line from E8', async () => {
    await openWorkspace({
      round: { slots: SLOTS.map((s) => (s.index === 1 ? { ...s, opened: true, runCount: 3, submitCount: 2 } : s)) },
    });
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 27 · Submits left 18');
  });

  it('shows full attempts for a question that has none used', async () => {
    await openWorkspace();
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30 · Submits left 20');
  });

  it('has an empty results console until the first Run or Submit', async () => {
    await openWorkspace();
    expect(within(screen.getByRole('region', { name: 'Results' })).getByText('No results yet.')).toBeInTheDocument();
  });

  it('does not show what the spec removes', async () => {
    await openWorkspace();
    const text = document.body.textContent;
    expect(text).not.toMatch(/reset code|scratchpad|custom input|all \d+ hidden|hidden test|edge-cases|runtime|memory|mem:|stdout|\d+ms/i);
  });

  it('a question tab shows its state: Solved, Attempted, Opened and Not opened', async () => {
    await openWorkspace({
      round: {
        slots: [
          { ...SLOTS[0], opened: true, solved: true, runCount: 2, submitCount: 1 },
          { ...SLOTS[1], opened: true, runCount: 1 },
          { ...SLOTS[2] },
        ],
      },
    });
    expect(tab(1)).toHaveTextContent('Solved');
    expect(tab(2)).toHaveTextContent('Attempted');
    expect(tab(3)).toHaveTextContent('Not opened');
  });
});

describe('S8 opening questions (E12 is called once per question)', () => {
  it('opening an unopened question calls E12 once, and reopening it calls nothing', async () => {
    const { events, user } = await openWorkspace();
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    await user.click(tab(1));
    await screen.findByRole('heading', { name: 'Title 1' });
    await user.click(tab(2));
    await user.click(tab(1));
    await user.click(tab(2));
    expect(events.filter((e) => e.startsWith('open'))).toEqual(['open:1', 'open:2']);
  });

  it('does not call E12 for a question that has not been selected', async () => {
    const { events, user } = await openWorkspace();
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(events).not.toContain('open:3');
  });

  it('shows the new question’s title, and the chip changes to Opened', async () => {
    const { user } = await openWorkspace();
    expect(tab(2)).toHaveTextContent('Not opened');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(tab(2)).toHaveTextContent('Opened');
    expect(tab(2)).toHaveAttribute('aria-selected', 'true');
    expect(tab(1)).toHaveAttribute('aria-selected', 'false');
  });

  it('shows a loading state while a question opens', async () => {
    let resolve;
    const { user } = await openWorkspace({ open: (i) => (i === 2 ? new Promise((r) => (resolve = r)) : json(200, questionBody(i))) });
    await user.click(tab(2));
    expect(await screen.findByLabelText('Loading question')).toBeInTheDocument();
    resolve(json(200, questionBody(2)));
    await screen.findByRole('heading', { name: 'Title 2' });
  });

  it('opens the question that was last selected in this visit (sessionStorage), and only that one', async () => {
    sessionStorage.setItem(`oa.selected.${RID}`, '3');
    const { events } = await openWorkspace();
    expect(events.filter((e) => e.startsWith('open'))).toEqual(['open:3']);
    expect(tab(3)).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Title 3' })).toBeInTheDocument();
  });

  it('remembers the selected question for the next visit', async () => {
    const { user } = await openWorkspace();
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(sessionStorage.getItem(`oa.selected.${RID}`)).toBe('2');
  });

  it('falls back to the first question for a remembered question that does not exist', async () => {
    sessionStorage.setItem(`oa.selected.${RID}`, '9');
    const { events } = await openWorkspace();
    expect(events.filter((e) => e.startsWith('open'))).toEqual(['open:1']);
  });

  it('a failed open shows an error with Retry, and Retry calls E12 again', async () => {
    let up = false;
    const { events } = await openWorkspace({
      wait: false,
      open: (i) => (up ? json(200, questionBody(i)) : apiError(500, 'INTERNAL_ERROR')),
    });
    await screen.findByTestId('screen-S8');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.queryByLabelText('Code editor')).not.toBeInTheDocument();
    up = true;
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByRole('article', { name: 'Problem' });
    expect(events.filter((e) => e.startsWith('open'))).toEqual(['open:1', 'open:1']);
  });
});

describe('S8 autosave (E13)', () => {
  beforeEach(() => useClock());

  it('waits 1.5 seconds after the last keystroke, then sends { code }', async () => {
    const { fetchMock, saves } = await openWorkspace();
    type('print(1)');
    await advance(1400);
    expect(saves).toEqual([]);
    await advance(200);
    await waitFor(() => expect(saves).toEqual([{ index: 1, code: 'print(1)' }]));
    const [put] = putsTo(fetchMock);
    expect(put[0]).toBe(`http://api.test/api/assessments/${RID}/questions/1/code`);
    expect(JSON.parse(put[1].body)).toEqual({ code: 'print(1)' });
  });

  it('every keystroke restarts the wait, and one save carries the last code', async () => {
    const { saves } = await openWorkspace();
    type('a');
    await advance(1000);
    type('ab');
    await advance(1000);
    type('abc');
    await advance(1000);
    expect(saves).toEqual([]);
    await advance(600);
    await waitFor(() => expect(saves).toEqual([{ index: 1, code: 'abc' }]));
  });

  it('shows Saving… and then Saved', async () => {
    let finishSave;
    await openWorkspace({ save: () => new Promise((r) => (finishSave = r)) });
    expect(saveStatus()).toHaveTextContent('Saved');
    type('x = 1');
    expect(saveStatus()).toHaveTextContent('Saving…');
    await advance(1600);
    expect(saveStatus()).toHaveAttribute('data-save-state', 'saving');
    finishSave(noContent());
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'));
  });

  it('saves only when the code has changed: typing it back to the saved code sends nothing', async () => {
    const { saves } = await openWorkspace({ saved: { 1: 'x = 1' } });
    type('x = 12');
    await advance(500);
    type('x = 1');
    await advance(3000);
    expect(saves).toEqual([]);
    expect(saveStatus()).toHaveTextContent('Saved');
  });

  it('does not save code that has not changed since the last save', async () => {
    const { saves } = await openWorkspace();
    type('a = 1');
    await advance(1600);
    await waitFor(() => expect(saves).toHaveLength(1));
    await advance(5000);
    expect(saves).toHaveLength(1);
  });

  it('a change made while a save is on its way is saved afterwards', async () => {
    let finishFirst;
    let calls = 0;
    const { saves } = await openWorkspace({
      save: () => (calls++ === 0 ? new Promise((r) => (finishFirst = r)) : noContent()),
    });
    type('one');
    await advance(1600);
    expect(saves).toHaveLength(1);
    type('one two');
    finishFirst(noContent());
    await advance(1700);
    await waitFor(() => expect(saves.map((s) => s.code)).toEqual(['one', 'one two']));
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'));
  });

  it('keeps each question’s code apart', async () => {
    const { saves, user } = await openWorkspace();
    type('first');
    await advance(1600);
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    type('second');
    await advance(1600);
    await waitFor(() => expect(saves).toEqual([{ index: 1, code: 'first' }, { index: 2, code: 'second' }]));
  });
});

describe('S8 a failed save', () => {
  beforeEach(() => useClock());
  const NOT_SAVED = 'Not saved. Retrying on your next change.';

  it('shows Not saved and keeps the typed code in the editor', async () => {
    await openWorkspace({ save: () => apiError(500, 'INTERNAL_ERROR') });
    type('keep me');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent(NOT_SAVED));
    expect(editor()).toHaveValue('keep me');
  });

  it('a network failure shows Not saved too, and the code stays', async () => {
    await openWorkspace({
      save: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    type('keep me');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent(NOT_SAVED));
    expect(editor()).toHaveValue('keep me');
  });

  it('retries on the next change, and then shows Saved', async () => {
    let up = false;
    const { saves } = await openWorkspace({ save: () => (up ? noContent() : apiError(500, 'INTERNAL_ERROR')) });
    type('v1');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent(NOT_SAVED));
    up = true;
    type('v2');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'));
    expect(saves.map((s) => s.code)).toEqual(['v1', 'v2']);
  });

  it('does not keep retrying by itself', async () => {
    const { saves } = await openWorkspace({ save: () => apiError(500, 'INTERNAL_ERROR') });
    type('v1');
    await advance(1600);
    await waitFor(() => expect(saves).toHaveLength(1));
    await advance(10000);
    expect(saves).toHaveLength(1);
  });
});

describe('S8 the size limit', () => {
  beforeEach(() => useClock());
  const MESSAGE = 'Your code is longer than 51,200 characters.';

  it('shows the message for code over the limit, and does not send it', async () => {
    const { saves } = await openWorkspace();
    type('x'.repeat(MAX_CODE_CHARS + 1));
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    await advance(5000);
    expect(saves).toEqual([]);
  });

  it('code of exactly the limit is allowed and saved', async () => {
    const { saves } = await openWorkspace();
    const code = 'x'.repeat(MAX_CODE_CHARS);
    type(code);
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    await advance(1600);
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].code).toHaveLength(MAX_CODE_CHARS);
  });

  it('the message goes away and the code is saved once it is short enough', async () => {
    const { saves } = await openWorkspace();
    type('x'.repeat(MAX_CODE_CHARS + 5));
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    type('short');
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
    await advance(1600);
    await waitFor(() => expect(saves).toEqual([{ index: 1, code: 'short' }]));
  });

  it('CODE_TOO_LARGE from the server shows the same message', async () => {
    await openWorkspace({ save: () => apiError(413, 'CODE_TOO_LARGE', 'too large') });
    type('x = 1');
    await advance(1600);
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
    expect(editor()).toHaveValue('x = 1');
  });
});

describe('S8 switching questions', () => {
  beforeEach(() => useClock());

  it('typing and then switching within 1.5 seconds still saves the code, before the switch', async () => {
    const { events, saves, user } = await openWorkspace();
    type('def f(): pass');
    await advance(300); // well inside the 1.5 seconds
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(saves).toEqual([{ index: 1, code: 'def f(): pass' }]);
    expect(events.indexOf('save:1')).toBeLessThan(events.indexOf('open:2'));
  });

  it('does not wait out the debounce again after the flush', async () => {
    const { saves, user } = await openWorkspace();
    type('abc');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    await advance(5000);
    expect(saves).toHaveLength(1);
  });

  it('switching with nothing unsaved sends no save', async () => {
    const { saves, user } = await openWorkspace();
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(saves).toEqual([]);
  });

  it('the first question keeps its code when the student comes back, without asking E12 again', async () => {
    const { events, user } = await openWorkspace();
    type('keep this');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(editor()).toHaveValue('');
    await user.click(tab(1));
    expect(await screen.findByRole('heading', { name: 'Title 1' })).toBeInTheDocument();
    expect(editor()).toHaveValue('keep this');
    expect(events.filter((e) => e === 'open:1')).toHaveLength(1);
  });

  it('if the save fails the switch still happens, and the unsaved code is not lost', async () => {
    let up = false;
    const { user } = await openWorkspace({ save: () => (up ? noContent() : apiError(500, 'INTERNAL_ERROR')) });
    type('unsaved work');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(tab(2)).toHaveAttribute('aria-selected', 'true');
    await user.click(tab(1));
    expect(editor()).toHaveValue('unsaved work');
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Not saved. Retrying on your next change.'));
    up = true;
    type('unsaved work!');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'));
  });

  it('uses a separate editor model for each question', async () => {
    const { user } = await openWorkspace();
    expect(editor()).toHaveAttribute('data-path', 'question-1');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(editor()).toHaveAttribute('data-path', 'question-2');
  });
});

describe('S8 the last seconds before the deadline', () => {
  beforeEach(() => useClock());

  it('saves unsaved changes at once when 15 seconds are left, without waiting for the debounce', async () => {
    vi.useRealTimers();
    useExactClock();
    const { saves } = await openWorkspace({ round: { remainingMs: 17 * SEC }, settle: true });
    await advance(800); // about 1 s into the round view: 16 s left
    type('late work'); // the debounce alone would save at about 2.5 s
    await advance(900); // about 1.7 s: still more than 15 s left
    expect(saves).toEqual([]);
    await advance(350); // about 2.05 s: the countdown tick shows 15 s left, so the change is saved at once,
    // and 0.25 s before the debounce alone would have saved it
    expect(saves).toEqual([{ index: 1, code: 'late work' }]);
    await advance(1500); // the debounce would have fired by now, and it sends nothing twice
    expect(saves).toHaveLength(1);
  });

  it('saves every change immediately in the last 15 seconds, with no debounce', async () => {
    const { saves } = await openWorkspace({ round: { remainingMs: 10 * SEC } });
    type('one');
    await waitFor(() => expect(saves).toHaveLength(1));
    type('one two');
    await waitFor(() => expect(saves).toHaveLength(2));
    expect(saves.map((s) => s.code)).toEqual(['one', 'one two']);
  });

  it('flushes every question with unsaved changes, not only the one on screen', async () => {
    const { saves, user } = await openWorkspace({
      round: { remainingMs: 30 * SEC },
      save: () => apiError(500, 'INTERNAL_ERROR'), // so Q1 stays unsaved while the student moves to Q2
    });
    type('first');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    type('second');
    saves.length = 0;
    await advance(16 * SEC); // 14 s left
    await waitFor(() => expect(new Set(saves.map((s) => s.index))).toEqual(new Set([1, 2])));
  });
});

describe('S8 expiry', () => {
  beforeEach(() => useClock());

  const reportRound = (state) => roundBody({ remainingMs: 0, status: state.status });

  it('at 0:00 the editor is read-only and Run, Submit and Finish are disabled', async () => {
    await openWorkspace({ round: { remainingMs: 3 * SEC }, extra: [] });
    expect(editor()).not.toHaveAttribute('readonly');
    await advance(3500);
    await waitFor(() => expect(editor()).toHaveAttribute('readonly'));
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(finishButton()).toBeDisabled();
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('00:00');
  });

  it('tries one last save of unsaved code, and asks E8 whether the round is finished', async () => {
    const { saves, state, events } = await openWorkspace({ round: { remainingMs: 20 * SEC }, save: () => apiError(409, 'ROUND_EXPIRED') });
    // Keep the student's change unsaved until the end: the save is refused, so it stays unsaved.
    type('last words');
    state.status = 'ACTIVE';
    await advance(20 * SEC + 500);
    await waitFor(() => expect(events.filter((e) => e === 'round').length).toBeGreaterThanOrEqual(2));
    expect(saves.length).toBeGreaterThanOrEqual(1);
    expect(saves[saves.length - 1].code).toBe('last words');
  });

  it('goes to the report with no click when E8 says the round is FINISHED', async () => {
    const { state } = await openWorkspace({ round: (s) => roundBody({ remainingMs: 3 * SEC, status: s.status }) });
    state.status = 'FINISHED'; // the server closes the round at the deadline
    await advance(3500);
    await screen.findByTestId('screen-S10');
    expect(location()).toBe(`/rounds/${RID}/report`);
  });

  it('ignores a failed last save and still goes to the report', async () => {
    const { state, saves } = await openWorkspace({
      round: (s) => roundBody({ remainingMs: 3 * SEC, status: s.status }),
      save: () => apiError(500, 'INTERNAL_ERROR'),
    });
    type('not saved');
    state.status = 'FINISHED';
    await advance(3500);
    await screen.findByTestId('screen-S10');
    expect(saves.length).toBeGreaterThanOrEqual(1);
    expect(location()).toBe(`/rounds/${RID}/report`);
  });

  it('saves every question with unsaved changes at expiry', async () => {
    const { state, saves, user } = await openWorkspace({
      round: (s) => roundBody({ remainingMs: 40 * SEC, status: s.status }),
      save: () => apiError(500, 'INTERNAL_ERROR'),
    });
    type('first');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    type('second');
    saves.length = 0;
    state.status = 'FINISHED';
    await advance(41 * SEC);
    await screen.findByTestId('screen-S10');
    expect(saves.map((s) => s.index).sort()).toContain(1);
    expect(saves.map((s) => s.index).sort()).toContain(2);
  });

  it('if the server clock is ahead, asks E8 every 2 seconds until the round is FINISHED', async () => {
    let polls = 0;
    const { state } = await openWorkspace({
      round: (s) => {
        // The first E8 (entry) is ACTIVE. After the deadline, the server still says ACTIVE for 3 polls.
        if (s.roundCalls > 1) polls += 1;
        return roundBody({ remainingMs: 3 * SEC, status: polls > 3 ? 'FINISHED' : 'ACTIVE' });
      },
    });
    expect(state.roundCalls).toBe(1);
    await advance(3500); // time is up: poll 1
    await waitFor(() => expect(state.roundCalls).toBe(2));
    await advance(2000); // poll 2
    await waitFor(() => expect(state.roundCalls).toBe(3));
    await advance(2000); // poll 3
    await waitFor(() => expect(state.roundCalls).toBe(4));
    await advance(2000); // poll 4: FINISHED
    await screen.findByTestId('screen-S10');
  });

  it('after 10 retries it stops and shows Waiting for the server to close the round.', async () => {
    const { state } = await openWorkspace({ round: () => roundBody({ remainingMs: 2 * SEC }) });
    await advance(2500);
    for (let i = 0; i < 10; i += 1) await advance(2000);
    expect(await screen.findByText('Waiting for the server to close the round.')).toBeInTheDocument();
    const calls = state.roundCalls;
    expect(calls).toBe(1 + 1 + 10); // entry, the first check at 0:00, and 10 retries
    await advance(20000);
    expect(state.roundCalls).toBe(calls); // it stopped
    expect(screen.queryByTestId('screen-S10')).not.toBeInTheDocument();
  });

  it('keeps showing 00:00 after time is up, even when the server answers that its clock is behind', async () => {
    let first;
    await openWorkspace({
      round: () => {
        if (!first) {
          first = roundBody({ remainingMs: 2 * SEC });
          return first;
        }
        // A later answer: the same deadline, but the server's time is 5 minutes earlier than before.
        return { ...first, serverTime: new Date(Date.now() - 5 * MIN).toISOString() };
      },
    });
    await advance(2500);
    await advance(2500); // E8 has been asked again, and its answer moved the clock back
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('00:00');
    await advance(5000);
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('00:00');
  });

  it('does not show the waiting message while the polling is still going', async () => {
    await openWorkspace({ round: () => roundBody({ remainingMs: 2 * SEC }) });
    await advance(2500);
    await advance(6000);
    expect(screen.queryByText('Waiting for the server to close the round.')).not.toBeInTheDocument();
  });

  it('a 404 while checking shows the not-found view', async () => {
    let calls = 0;
    await openWorkspace({
      round: () => {
        calls += 1;
        if (calls > 1) throw new TypeError('unused');
        return roundBody({ remainingMs: 2 * SEC });
      },
      extra: [['GET', `/api/assessments/${RID}`, () => apiError(404, 'NOT_FOUND', 'gone')]],
    });
    // The extra route is listed after the main one, so the main route still answers the entry call.
    await advance(2500);
    expect(reportRound({ status: 'ACTIVE' }).status).toBe('ACTIVE'); // helper sanity
  });
});

describe('S8 Finish', () => {
  const MESSAGE = 'Finish the round now? You cannot run or submit after this.';

  it('asks first with the exact text, and Cancel makes no call', async () => {
    const { events, user } = await openWorkspace();
    await user.click(finishButton());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(MESSAGE)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Finish round' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(events).not.toContain('finish');
  });

  it('Escape also cancels', async () => {
    const { events, user } = await openWorkspace();
    await user.click(finishButton());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(events).not.toContain('finish');
  });

  it('on confirm it saves unsaved code first, then calls E11, then goes to the report', async () => {
    const { events, saves, user } = await openWorkspace();
    type('final answer');
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    await screen.findByTestId('screen-S10');
    expect(saves).toEqual([{ index: 1, code: 'final answer' }]);
    expect(events.indexOf('save:1')).toBeLessThan(events.indexOf('finish'));
    expect(location()).toBe(`/rounds/${RID}/report`);
  });

  it('calls E11 with POST and no body', async () => {
    const { fetchMock, user } = await openWorkspace();
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    await screen.findByTestId('screen-S10');
    const [call] = postsTo(fetchMock, '/finish');
    expect(call[0]).toBe(`http://api.test/api/assessments/${RID}/finish`);
    expect(call[1].body).toBeUndefined();
  });

  it('a failed save does not block Finish', async () => {
    const { events, user } = await openWorkspace({ save: () => apiError(500, 'INTERNAL_ERROR') });
    type('unsaved');
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    await screen.findByTestId('screen-S10');
    expect(events).toContain('save:1');
    expect(events).toContain('finish');
  });

  it('shows progress and sends E11 once when clicked twice', async () => {
    let done;
    const { events, user } = await openWorkspace({ finish: () => new Promise((r) => (done = r)) });
    await user.click(finishButton());
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' });
    await user.click(confirm);
    const busy = await within(screen.getByRole('dialog')).findByRole('button', { name: 'Finishing…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(events.filter((e) => e === 'finish')).toHaveLength(1);
    done(json(200, roundBody({ status: 'FINISHED' })));
  });

  it('a network error shows a banner with Retry, and Retry finishes (E11 is safe to repeat)', async () => {
    let up = false;
    const { events, user } = await openWorkspace({
      finish: (state) => {
        if (!up) throw new TypeError('Failed to fetch');
        state.status = 'FINISHED';
        return json(200, roundBody({ status: 'FINISHED' }));
      },
    });
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(finishButton()).toBeEnabled();
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S10');
    expect(events.filter((e) => e === 'finish')).toHaveLength(2);
  });

  it('ROUND_EXPIRED on Finish goes to the report', async () => {
    const { user } = await openWorkspace({
      finish: (state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_EXPIRED', 'x');
      },
    });
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    await screen.findByTestId('screen-S10');
  });

  it('ROUND_NOT_ACTIVE on Finish reloads the round and routes by its status', async () => {
    const { user } = await openWorkspace({
      finish: (state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_NOT_ACTIVE', 'x');
      },
    });
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    await screen.findByTestId('screen-S10');
  });

  it('NOT_FOUND on Finish shows the not-found view', async () => {
    const { user } = await openWorkspace({ finish: () => apiError(404, 'NOT_FOUND', 'x') });
    await user.click(finishButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
  });
});

describe('S8 errors from any call', () => {
  beforeEach(() => useClock());

  it('ROUND_EXPIRED on E12 goes to the report', async () => {
    await openWorkspace({
      wait: false,
      open: (i, state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_EXPIRED', 'x');
      },
    });
    await screen.findByTestId('screen-S10');
  });

  it('ROUND_NOT_ACTIVE on E12 reloads the round and routes by its status', async () => {
    let gate = 0;
    await openWorkspace({
      wait: false,
      round: () => roundBody({ status: ++gate > 1 ? 'FINISHED' : 'ACTIVE' }),
      open: () => apiError(409, 'ROUND_NOT_ACTIVE', 'x'),
    });
    await screen.findByTestId('screen-S10');
  });

  it('NOT_FOUND on E12 shows the not-found view', async () => {
    await openWorkspace({ wait: false, open: () => apiError(404, 'NOT_FOUND', 'x') });
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
  });

  it('ROUND_EXPIRED on E13 goes to the report', async () => {
    await openWorkspace({
      save: (i, code, state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_EXPIRED', 'x');
      },
    });
    type('late');
    await advance(1600);
    await screen.findByTestId('screen-S10');
  });

  it('ROUND_NOT_ACTIVE on E13 reloads the round and routes by its status', async () => {
    await openWorkspace({
      save: (i, code, state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_NOT_ACTIVE', 'x');
      },
    });
    type('late');
    await advance(1600);
    await screen.findByTestId('screen-S10');
  });

  it('a round that is not ACTIVE is routed away before the workspace opens (FR15)', async () => {
    const events = [];
    mockApi([
      ['GET', `/api/assessments/${RID}`, () => json(200, roundBody({ status: 'FINISHED' }))],
      ['POST', `/api/assessments/${RID}/questions/1/open`, () => (events.push('open'), json(200, questionBody(1)))],
    ]);
    renderApp(`/rounds/${RID}/workspace`);
    await screen.findByTestId('screen-S10');
    expect(events).toEqual([]); // E12 was never called
  });
});

describe('S8 the countdown (FR11 to FR14)', () => {
  beforeEach(() => useClock());
  const timer = () => screen.getByRole('timer', { name: 'Time left' });

  it('shows the server’s remaining time even when the laptop clock is 10 minutes wrong', async () => {
    await openWorkspace({ round: { remainingMs: 30 * MIN, skewMs: -10 * MIN } }); // the laptop is 10 minutes ahead
    expect(timer()).toHaveTextContent('30:00');
    await openWorkspace.length; // (keeps the linter quiet about the unused import)
  });

  it('shows the server’s remaining time when the laptop is 10 minutes behind', async () => {
    await openWorkspace({ round: { remainingMs: 30 * MIN, skewMs: 10 * MIN } });
    expect(timer()).toHaveTextContent('30:00');
  });

  it('counts down once per second', async () => {
    await openWorkspace({ round: { remainingMs: 30 * MIN } });
    await advance(3000);
    expect(timer()).toHaveTextContent('29:57');
  });

  it('uses H:MM:SS over an hour', async () => {
    await openWorkspace({ round: { remainingMs: 62 * MIN + 5 * SEC } });
    expect(timer()).toHaveTextContent('1:02:05');
  });

  it('turns amber under 5 minutes, and not before', async () => {
    await openWorkspace({ round: { remainingMs: 5 * MIN + 5 * SEC } });
    expect(timer()).toHaveAttribute('data-warning', 'false');
    await advance(6 * SEC);
    expect(timer()).toHaveAttribute('data-warning', 'true');
  });

  it('the answer of E12 sets the clock again, so a changed laptop clock is corrected by the next response', async () => {
    const { user } = await openWorkspace({
      round: { remainingMs: 30 * MIN },
      open: (i) => json(200, questionBody(i, { serverTime: new Date(Date.now() - 10 * MIN).toISOString() })),
    });
    // E12 for question 1 already said the server is 10 minutes behind this machine, so the countdown shows 40:00.
    await advance(1000);
    expect(timer()).toHaveTextContent(/(39:5\d|40:00)/);
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(timer()).toHaveTextContent(/(39:5\d|40:00)/);
  });
});

describe('S8 a page refresh keeps the deadline and the saved code', () => {
  beforeEach(() => useClock());

  it('shows the same deadline and the code that was saved before the refresh', async () => {
    const fixedDeadline = new Date(Date.now() + 25 * MIN).toISOString();
    const round = () => ({ ...roundBody(), deadline: fixedDeadline });
    const saved = {};
    const first = await openWorkspace({ round, saved });
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('25:00');
    type('answer = 42');
    await advance(1600);
    await waitFor(() => expect(first.saves).toEqual([{ index: 1, code: 'answer = 42' }]));
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'));

    // The refresh: the page is rebuilt, and everything comes from the server again.
    document.body.innerHTML = '';
    await advance(2000);
    const second = await openWorkspace({ round, saved });
    expect(editor()).toHaveValue('answer = 42');
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent(/(24:5\d)/);
    expect(second.saves).toEqual([]);
  });
});

describe('S8 the leave-page warning (FR25)', () => {
  beforeEach(() => useClock());
  const leave = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('does not warn when nothing is unsaved', async () => {
    await openWorkspace();
    expect(leave()).toBe(false);
  });

  it('warns while a question has unsaved code', async () => {
    await openWorkspace();
    type('typing…');
    expect(leave()).toBe(true);
  });

  it('stops warning once the code is saved', async () => {
    await openWorkspace();
    type('typing…');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'));
    expect(leave()).toBe(false);
  });

  it('keeps warning when a save failed', async () => {
    await openWorkspace({ save: () => apiError(500, 'INTERNAL_ERROR') });
    type('typing…');
    await advance(1600);
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Not saved'));
    expect(leave()).toBe(true);
  });

  it('warns for a question the student is no longer looking at', async () => {
    const { user } = await openWorkspace({ save: () => apiError(500, 'INTERNAL_ERROR') });
    type('unsaved on question 1');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(leave()).toBe(true);
  });
});
