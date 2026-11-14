import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CODE_CHARS } from '../config/limits';
import { apiError, json, storeSession, stubApiBase } from '../test/helpers';
import {
  SLOTS,
  advance,
  noContent,
  openWorkspace,
  results,
  roundBody,
  runBody,
  runButton,
  saveStatus,
  submitBody,
  submitButton,
  tab,
  type,
  useClock,
} from '../test/workspaceHarness';

beforeEach(() => {
  stubApiBase();
  storeSession();
  useClock();
});
afterEach(() => vi.useRealTimers());

const notes = () => screen.queryByTestId('attempt-notes')?.textContent ?? '';
const location = () => screen.getByTestId('location').textContent;
const slotsWith = (index, extra) => SLOTS.map((s) => (s.index === index ? { ...s, ...extra } : s));

describe('Run', () => {
  it('sends the code in the editor to E14 with the language python', async () => {
    const { runs, user } = await openWorkspace();
    type('print(sum(map(int, input().split())))');
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    expect(runs).toEqual([{ index: 1, body: { language: 'python', code: 'print(sum(map(int, input().split())))' } }]);
  });

  it('shows the result in the console, updates Runs left, and the chip becomes Attempted', async () => {
    const { user } = await openWorkspace();
    expect(tab(1)).toHaveTextContent('Opened');
    await user.click(runButton());
    expect(await within(results()).findByRole('heading', { name: 'Run: 2 of 2 sample tests passed' })).toBeInTheDocument();
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 29 · Submits left 20');
    expect(within(results()).getByText('Runs left 29')).toBeInTheDocument();
    expect(tab(1)).toHaveTextContent('Attempted');
  });

  it('counters come from the response: runsLeft 5 means Runs left 5', async () => {
    const { user } = await openWorkspace({ run: () => json(200, runBody({ runsLeft: 5 })) });
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 5 · Submits left 20');
  });

  it('shows Running… and is disabled while the request is pending, so a double click sends one Run', async () => {
    let done;
    const { runs, user } = await openWorkspace({ run: () => new Promise((r) => (done = r)) });
    await user.click(runButton());
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Running…' }));
    await user.dblClick(screen.getByRole('button', { name: 'Running…' }));
    expect(runs).toHaveLength(1);
    done(json(200, runBody()));
    await screen.findByRole('article', { name: 'Run result' });
  });

  it('does not send code that is over the size limit', async () => {
    const { runs, user } = await openWorkspace();
    type('x'.repeat(MAX_CODE_CHARS + 1));
    await user.click(runButton());
    expect(runs).toEqual([]);
    expect(screen.getByText('Your code is longer than 51,200 characters.')).toBeInTheDocument();
  });

  it('the Run is the same code the editor shows, even right after a change (no autosave is needed first)', async () => {
    const { runs, saves, user } = await openWorkspace();
    type('fresh code');
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    expect(runs[0].body.code).toBe('fresh code');
    expect(saves).toEqual([]);
  });

  it('the backend saves the code on a Run, so the browser treats it as saved and sends no duplicate autosave', async () => {
    const { saves, user } = await openWorkspace();
    type('print(1)');
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    await advance(5000);
    expect(saves).toEqual([]);
    expect(saveStatus()).toHaveTextContent('Saved');
  });

  it('code typed while the Run is on its way is still saved afterwards', async () => {
    let done;
    const { saves, user } = await openWorkspace({ run: () => new Promise((r) => (done = r)) });
    type('first');
    await user.click(runButton());
    type('first, then more');
    done(json(200, runBody()));
    await screen.findByRole('article', { name: 'Run result' });
    await advance(1700);
    await waitFor(() => expect(saves).toEqual([{ index: 1, code: 'first, then more' }]));
  });
});

describe('Submit', () => {
  it('sends the code to E15, and ACCEPTED shows Accepted and makes the chip Solved', async () => {
    const { submits, user } = await openWorkspace();
    type('print(42)');
    await user.click(submitButton());
    expect(await within(results()).findByRole('heading', { name: 'Accepted' })).toBeInTheDocument();
    expect(within(results()).getByText('Your solution passed all tests.')).toBeInTheDocument();
    expect(submits).toEqual([{ index: 1, body: { language: 'python', code: 'print(42)' } }]);
    expect(tab(1)).toHaveTextContent('Solved');
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Submits left 19');
  });

  it('NOT_ACCEPTED shows only "Not accepted." and "Some test cases did not pass."', async () => {
    const { user } = await openWorkspace({ submit: () => json(200, submitBody({ verdict: 'NOT_ACCEPTED', solved: false, submitsLeft: 18 })) });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Not accepted.' });
    expect(within(results()).getByText('Some test cases did not pass.')).toBeInTheDocument();
    expect(tab(1)).not.toHaveTextContent('Solved');
    expect(tab(1)).toHaveTextContent('Attempted');
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Submits left 18');
  });

  it('COMPILATION_ERROR shows Syntax error and the message', async () => {
    const { user } = await openWorkspace({
      submit: () => json(200, submitBody({ verdict: 'COMPILATION_ERROR', errorMessage: 'Line 2: SyntaxError: invalid syntax', solved: false })),
    });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Syntax error' });
    expect(within(results()).getByText('Line 2: SyntaxError: invalid syntax')).toBeInTheDocument();
  });

  it('a question that was solved earlier stays Solved after a NOT_ACCEPTED Submit', async () => {
    const { user } = await openWorkspace({
      round: { slots: slotsWith(1, { opened: true, solved: true, submitCount: 1 }) },
      submit: () => json(200, submitBody({ verdict: 'NOT_ACCEPTED', solved: true, submitsLeft: 18 })),
    });
    expect(tab(1)).toHaveTextContent('Solved');
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Not accepted.' });
    expect(tab(1)).toHaveTextContent('Solved');
  });

  it('never shows a reason, a test number or a count of tests, even if the answer carried them', async () => {
    const { user } = await openWorkspace({
      submit: () =>
        json(200, {
          ...submitBody({ verdict: 'NOT_ACCEPTED', solved: false }),
          failedTestNumber: 17,
          testsPassed: 16,
          totalTests: 45,
          reason: 'WRONG_ANSWER',
          hiddenInput: 'SECRET-HIDDEN-INPUT',
        }),
    });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Not accepted.' });
    const text = document.body.textContent;
    expect(text).not.toMatch(/SECRET-HIDDEN-INPUT|WRONG_ANSWER|failedTestNumber|\b17\b|\b45\b|\b16 of/);
  });

  it('shows Submitting… and sends one request when clicked twice', async () => {
    let done;
    const { submits, user } = await openWorkspace({ submit: () => new Promise((r) => (done = r)) });
    await user.click(submitButton());
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Submitting…' }));
    expect(submits).toHaveLength(1);
    done(json(200, submitBody()));
    await within(results()).findByRole('heading', { name: 'Accepted' });
  });
});

describe('cooldowns (Run and Submit wait separately, for the whole round)', () => {
  it('after a Run, Run waits 3 seconds and says so, then is enabled again', async () => {
    const { user } = await openWorkspace();
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    expect(runButton()).toBeDisabled();
    expect(notes()).toContain('Wait 3 seconds before running again.');
    await advance(1000);
    expect(notes()).toContain('Wait 2 seconds before running again.');
    await advance(1000);
    expect(notes()).toContain('Wait 1 second before running again.');
    await advance(1100);
    expect(runButton()).toBeEnabled();
    expect(notes()).not.toContain('Wait');
  });

  it('after a Submit, Submit waits 5 seconds', async () => {
    const { user } = await openWorkspace();
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Accepted' });
    expect(submitButton()).toBeDisabled();
    expect(notes()).toContain('Wait 5 seconds before submitting again.');
    await advance(4000);
    expect(submitButton()).toBeDisabled();
    await advance(1200);
    expect(submitButton()).toBeEnabled();
  });

  it('a Run does not start the Submit wait, and a Submit does not start the Run wait', async () => {
    const { user } = await openWorkspace();
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    expect(submitButton()).toBeEnabled();
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Accepted' });
    expect(notes()).toContain('before running again');
    expect(notes()).toContain('before submitting again');
  });

  it('the wait is per round: it also applies on another question', async () => {
    const { user } = await openWorkspace();
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(runButton()).toBeDisabled();
    expect(notes()).toContain('before running again');
    await advance(3200);
    expect(runButton()).toBeEnabled();
  });

  it('a server COOLDOWN overrides the usual wait with retryAfterSeconds (rounded up)', async () => {
    const { user } = await openWorkspace({ run: () => apiError(429, 'COOLDOWN', 'wait', { retryAfterMs: 1400 }) });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Wait 2 seconds before running again.'));
    expect(runButton()).toBeDisabled();
    expect(results()).toHaveTextContent('No results yet.');
    await advance(2300);
    expect(runButton()).toBeEnabled();
  });

  it('a server COOLDOWN for Submit shows the wait before submitting again', async () => {
    const { user } = await openWorkspace({ submit: () => apiError(429, 'COOLDOWN', 'wait', { retryAfterMs: 4794 }) });
    await user.click(submitButton());
    await waitFor(() => expect(notes()).toContain('Wait 5 seconds before submitting again.'));
    expect(submitButton()).toBeDisabled();
  });

  it('a COOLDOWN does not change the counters, and keeps the last result on screen', async () => {
    let calls = 0;
    const { user } = await openWorkspace({
      run: () => (calls++ === 0 ? json(200, runBody({ runsLeft: 29 })) : apiError(429, 'COOLDOWN', 'wait', { retryAfterMs: 2000 })),
    });
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    await advance(3200);
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Wait 2 seconds'));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 29');
    expect(screen.getByRole('article', { name: 'Run result' })).toBeInTheDocument();
  });
});

describe('counters and limits', () => {
  it('when runs left reaches 0, Run is disabled for this question and says so, and Submit is not affected', async () => {
    const { user } = await openWorkspace({ run: () => json(200, runBody({ runsLeft: 0 })) });
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    await advance(3300);
    expect(runButton()).toBeDisabled();
    expect(notes()).toContain('No runs left for this question.');
    expect(submitButton()).toBeEnabled();
  });

  it('when submits left reaches 0, Submit is disabled and says so', async () => {
    const { user } = await openWorkspace({ submit: () => json(200, submitBody({ submitsLeft: 0 })) });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Accepted' });
    await advance(5300);
    expect(submitButton()).toBeDisabled();
    expect(notes()).toContain('No submits left for this question.');
    expect(runButton()).toBeEnabled();
  });

  it('ATTEMPT_LIMIT disables that button for this question only', async () => {
    const { user } = await openWorkspace({ run: () => apiError(429, 'ATTEMPT_LIMIT', 'used all') });
    await user.click(runButton());
    await waitFor(() => expect(runButton()).toBeDisabled());
    expect(notes()).toContain('No runs left for this question.');
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 0');
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30');
    expect(runButton()).toBeEnabled();
  });

  it('a question that starts with no runs left has Run disabled from the beginning', async () => {
    await openWorkspace({ round: { slots: slotsWith(1, { opened: true, runCount: 30 }) } });
    expect(runButton()).toBeDisabled();
    expect(notes()).toContain('No runs left for this question.');
  });

  it('a question that starts with no submits left has Submit disabled from the beginning', async () => {
    await openWorkspace({ round: { slots: slotsWith(1, { opened: true, submitCount: 20 }) } });
    expect(submitButton()).toBeDisabled();
    expect(notes()).toContain('No submits left for this question.');
  });
});

describe('errors', () => {
  it('RUNNER_UNAVAILABLE shows "Something went wrong. Try again." and leaves the counters as they are', async () => {
    const { user } = await openWorkspace({ run: () => apiError(503, 'RUNNER_UNAVAILABLE', 'x') });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Something went wrong. Try again.'));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30 · Submits left 20');
    expect(tab(1)).toHaveTextContent('Opened'); // not Attempted: nothing was counted
    expect(runButton()).toBeEnabled(); // the attempt was given back, so there is no wait
  });

  it('RUNNER_UNAVAILABLE on Submit leaves the submit counter as it is', async () => {
    const { user } = await openWorkspace({ submit: () => apiError(503, 'RUNNER_UNAVAILABLE', 'x') });
    await user.click(submitButton());
    await waitFor(() => expect(notes()).toContain('Something went wrong. Try again.'));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Submits left 20');
    expect(submitButton()).toBeEnabled();
  });

  it('after a RUNNER_UNAVAILABLE, trying again works and the counter then drops by one', async () => {
    let calls = 0;
    const { user } = await openWorkspace({ run: () => (calls++ === 0 ? apiError(503, 'RUNNER_UNAVAILABLE', 'x') : json(200, runBody({ runsLeft: 29 }))) });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Something went wrong'));
    await user.click(runButton());
    await screen.findByRole('article', { name: 'Run result' });
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 29');
    expect(notes()).not.toContain('Something went wrong');
  });

  it('CODE_TOO_LARGE from the server shows the S8 message', async () => {
    const { user } = await openWorkspace({ run: () => apiError(413, 'CODE_TOO_LARGE', 'too big') });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Your code is longer than 51,200 characters.'));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30');
  });

  it('a network error shows the connection message and leaves the counters', async () => {
    const { user } = await openWorkspace({
      run: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain("Can't reach the server. Check your connection."));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30');
    expect(runButton()).toBeEnabled();
  });

  it('TOO_MANY_REQUESTS shows the wait from the server', async () => {
    const { user } = await openWorkspace({
      run: () => json(429, { error: { code: 'TOO_MANY_REQUESTS', message: 'slow down' } }, { 'Retry-After': '42' }),
    });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Too many requests. Try again in 42 seconds.'));
  });

  it('ROUND_EXPIRED goes to the report', async () => {
    const { user } = await openWorkspace({
      submit: (i, code, state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_EXPIRED', 'x');
      },
    });
    await user.click(submitButton());
    await screen.findByTestId('screen-S10');
    expect(location()).toBe('/rounds/round-1/report');
  });

  it('ROUND_NOT_ACTIVE reloads the round and routes by its status', async () => {
    const { user } = await openWorkspace({
      run: (i, code, state) => {
        state.status = 'FINISHED';
        return apiError(409, 'ROUND_NOT_ACTIVE', 'x');
      },
    });
    await user.click(runButton());
    await screen.findByTestId('screen-S10');
  });

  it('NOT_FOUND shows the not-found view', async () => {
    const { user } = await openWorkspace({ run: () => apiError(404, 'NOT_FOUND', 'x') });
    await user.click(runButton());
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
  });
});

describe('results are kept per question', () => {
  it('each question shows its own last result, and "No results yet." until it has one', async () => {
    const { user } = await openWorkspace({ run: (i) => json(200, runBody({ testsPassed: i, totalTests: 3, runsLeft: 29 })) });
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: 'Run: 1 of 3 sample tests passed' });
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(results()).toHaveTextContent('No results yet.');
    await advance(3300);
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: 'Run: 2 of 3 sample tests passed' });
    await user.click(tab(1));
    await within(results()).findByRole('heading', { name: 'Run: 1 of 3 sample tests passed' });
  });

  it('a result belongs to the question it was sent for, even if the student switched while it was pending', async () => {
    let done;
    const { user } = await openWorkspace({ run: () => new Promise((r) => (done = r)) });
    await user.click(runButton());
    await user.click(tab(2));
    await screen.findByRole('heading', { name: 'Title 2' });
    done(json(200, runBody({ testsPassed: 2, totalTests: 2 })));
    await waitFor(() => expect(tab(1)).toHaveTextContent('Attempted'));
    expect(results()).toHaveTextContent('No results yet.'); // question 2 has none
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30'); // counters of question 2
    await user.click(tab(1));
    await within(results()).findByRole('heading', { name: 'Run: 2 of 2 sample tests passed' });
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 29');
  });

  it('the newest result replaces the older one for the same question', async () => {
    let calls = 0;
    const { user } = await openWorkspace({ run: () => json(200, runBody({ testsPassed: calls++ === 0 ? 1 : 2, totalTests: 2 })) });
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: 'Run: 1 of 2 sample tests passed' });
    await advance(3300);
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: 'Run: 2 of 2 sample tests passed' });
    expect(within(results()).queryByRole('heading', { name: 'Run: 1 of 2 sample tests passed' })).not.toBeInTheDocument();
  });

  it('a Run and a Submit can both be pending at the same time (their waits are separate)', async () => {
    let doneRun;
    let doneSubmit;
    const { user } = await openWorkspace({
      run: () => new Promise((r) => (doneRun = r)),
      submit: () => new Promise((r) => (doneSubmit = r)),
    });
    await user.click(runButton());
    await user.click(submitButton());
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    doneRun(json(200, runBody()));
    doneSubmit(json(200, submitBody()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()); // now in its 3 s wait
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});

describe('when the round is closing', () => {
  it('Run and Submit are disabled while Finish is on its way', async () => {
    let done;
    const { user } = await openWorkspace({ finish: () => new Promise((r) => (done = r)) });
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
    await waitFor(() => expect(runButton()).toBeDisabled());
    expect(submitButton()).toBeDisabled();
    done(json(200, roundBody({ status: 'FINISHED' })));
  });

  it('Run and Submit are disabled once the time is up', async () => {
    await openWorkspace({ round: { remainingMs: 2000 } });
    await advance(2600);
    await waitFor(() => expect(runButton()).toBeDisabled());
    expect(submitButton()).toBeDisabled();
  });

  it('a question that is still opening cannot be run', async () => {
    let done;
    const { user } = await openWorkspace({ open: (i) => (i === 2 ? new Promise((r) => (done = r)) : json(200, { ...{ index: i, title: 'T', statement: 's', samples: [], code: '', topic: 'a', difficulty: 'easy', serverTime: new Date().toISOString() } })) });
    await user.click(tab(2));
    await waitFor(() => expect(runButton()).toBeDisabled());
    expect(submitButton()).toBeDisabled();
    done(json(200, { index: 2, title: 'Title 2', statement: 's', samples: [], code: '', topic: 'a', difficulty: 'easy', serverTime: new Date().toISOString() }));
    await screen.findByRole('heading', { name: 'Title 2' });
    expect(runButton()).toBeEnabled();
  });
});
