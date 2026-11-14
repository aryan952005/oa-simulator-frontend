// Run and Submit against responses saved from the real backend (real Python runner, real attempt gate):
// src/test/fixtures/real-attempt-responses.json
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_RUNS, MAX_SUBMITS, RUN_COOLDOWN_MS, SUBMIT_COOLDOWN_MS } from '../config/limits';
import real from '../test/fixtures/real-attempt-responses.json';
import { json, storeSession, stubApiBase } from '../test/helpers';
import { advance, openWorkspace, results, runButton, submitButton, tab, useClock } from '../test/workspaceHarness';

const answer = (key) => json(real[key].status, real[key].body);
const notes = () => screen.queryByTestId('attempt-notes')?.textContent ?? '';

beforeEach(() => {
  stubApiBase();
  storeSession();
  useClock();
});
afterEach(() => vi.useRealTimers());

const RUN_KEYS = ['actual', 'error', 'expected', 'input', 'passed', 'status'];
const RUN_OK_KEYS = ['compilation', 'results', 'runsLeft', 'serverTime', 'testsPassed', 'totalTests'];
const SUBMIT_KEYS = ['errorMessage', 'serverTime', 'solved', 'submitsLeft', 'verdict'];

const runKeys = Object.keys(real).filter((k) => k.startsWith('run') && real[k].status === 200 && real[k].body?.results);
const submitKeys = Object.keys(real).filter((k) => k.startsWith('submit') && real[k].status === 200 && real[k].body?.verdict);

describe('what the real backend sends (FR20: no hidden data reaches the browser)', () => {
  it('has Run and Submit answers for every outcome', () => {
    expect(runKeys.length).toBeGreaterThanOrEqual(8);
    expect(submitKeys.length).toBeGreaterThanOrEqual(5);
  });

  it.each(runKeys)('the real Run answer %s has only the documented fields', (key) => {
    const body = real[key].body;
    expect(Object.keys(body).sort()).toEqual(RUN_OK_KEYS);
    for (const sample of body.results) expect(Object.keys(sample).sort()).toEqual(RUN_KEYS);
  });

  it.each(submitKeys)('the real Submit answer %s has only the documented fields', (key) => {
    const keys = Object.keys(real[key].body).sort();
    const expected = real[key].body.verdict === 'COMPILATION_ERROR' ? SUBMIT_KEYS : SUBMIT_KEYS.filter((k) => k !== 'errorMessage');
    expect(keys).toEqual(expected);
  });

  it('no real answer mentions hidden tests, a failed test number, or a reason', () => {
    const everything = JSON.stringify(real);
    expect(everything).not.toMatch(/hiddenTests|hiddenInputs|failedTestNumber|testNumber|WRONG_ANSWER|passwordHash/);
  });

  it('a wrong answer and a time limit on Submit look exactly the same to the student', () => {
    const { serverTime: _a, submitsLeft: _b, ...wrong } = real.submitNotAccepted.body;
    const { serverTime: _c, submitsLeft: _d, ...slow } = real.submitTimeLimit.body;
    expect(slow).toEqual(wrong);
    expect(wrong.verdict).toBe('NOT_ACCEPTED');
  });

  it('Submit shows no tests passed and no test count', () => {
    for (const key of submitKeys) {
      expect(real[key].body).not.toHaveProperty('testsPassed');
      expect(real[key].body).not.toHaveProperty('totalTests');
    }
  });
});

describe('real Run outcomes, shown', () => {
  it('all samples passed: "Run: 3 of 3 sample tests passed" with a Passed card for each', async () => {
    const { user } = await openWorkspace({ run: () => answer('runOk') });
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: `Run: ${real.runOk.body.testsPassed} of ${real.runOk.body.totalTests} sample tests passed` });
    const cards = within(results()).getAllByRole('listitem');
    expect(cards).toHaveLength(real.runOk.body.results.length);
    for (const card of cards) expect(within(card).getByText('Result: Passed')).toBeInTheDocument();
  });

  it('shows each real sample’s input, expected output and output', async () => {
    const { user } = await openWorkspace({ run: () => answer('runOk') });
    await user.click(runButton());
    await within(results()).findByRole('article', { name: 'Run result' });
    real.runOk.body.results.forEach((sample, i) => {
      const pres = [...within(results()).getByRole('listitem', { name: `Sample ${i + 1} result` }).querySelectorAll('pre')].map((p) => p.textContent);
      expect(pres).toEqual([sample.input, sample.expected, sample.actual]);
    });
  });

  it('a real syntax error shows "Syntax error" and the real message with its line number', async () => {
    const { user } = await openWorkspace({ run: () => answer('runSyntaxError') });
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: 'Syntax error' });
    expect(results()).toHaveTextContent(real.runSyntaxError.body.compilation.message);
    expect(real.runSyntaxError.body.compilation.message).toMatch(/^Line \d+:/);
    expect(within(results()).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('a real runtime error shows "Runtime error" and the real error text', async () => {
    const { user } = await openWorkspace({ run: () => answer('runRuntimeError') });
    await user.click(runButton());
    await within(results()).findByRole('article', { name: 'Run result' });
    const first = within(results()).getByRole('listitem', { name: 'Sample 1 result' });
    expect(within(first).getByText('Runtime error')).toBeInTheDocument();
    expect(first).toHaveTextContent('ValueError: boom');
    expect(within(first).getByText('Result: Failed')).toBeInTheDocument();
  });

  it('a real time limit shows "Time limit exceeded"', async () => {
    const { user } = await openWorkspace({ run: () => answer('runTimeLimit') });
    await user.click(runButton());
    await within(results()).findByRole('article', { name: 'Run result' });
    expect(within(results()).getAllByText('Time limit exceeded')).toHaveLength(real.runTimeLimit.body.results.length);
  });

  it('real output that is empty shows (no output) and a Failed result', async () => {
    const { user } = await openWorkspace({ run: () => answer('runNoOutput') });
    await user.click(runButton());
    await within(results()).findByRole('article', { name: 'Run result' });
    expect(within(results()).getAllByText('(no output)')).toHaveLength(real.runNoOutput.body.results.length);
    expect(within(results()).getAllByText('Result: Failed')).toHaveLength(real.runNoOutput.body.results.length);
  });

  it('very long real output is shown exactly as the backend sent it, in a block that wraps and scrolls', async () => {
    const { user } = await openWorkspace({ run: () => answer('runLongOutput') });
    await user.click(runButton());
    await within(results()).findByRole('article', { name: 'Run result' });
    const sent = real.runLongOutput.body.results[0].actual;
    expect(sent.length).toBeGreaterThan(1000);
    const pres = [...within(results()).getByRole('listitem', { name: 'Sample 1 result' }).querySelectorAll('pre')];
    expect(pres[2].textContent).toBe(sent);
    expect(pres[2]).toHaveClass('whitespace-pre-wrap');
    expect(pres[2]).toHaveClass('break-words');
  });

  it('the counter follows the real runsLeft', async () => {
    const { user } = await openWorkspace({ run: () => answer('runSyntaxError') });
    await user.click(runButton());
    await within(results()).findByRole('heading', { name: 'Syntax error' });
    expect(screen.getByTestId('attempts-line')).toHaveTextContent(`Runs left ${real.runSyntaxError.body.runsLeft}`);
    expect(results()).toHaveTextContent(`Runs left ${real.runSyntaxError.body.runsLeft}`);
  });
});

describe('real Submit outcomes, shown', () => {
  it('ACCEPTED: Accepted, "Your solution passed all tests.", and the chip is Solved', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitAccepted') });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Accepted' });
    expect(results()).toHaveTextContent('Your solution passed all tests.');
    expect(tab(1)).toHaveTextContent('Solved');
    expect(screen.getByTestId('attempts-line')).toHaveTextContent(`Submits left ${real.submitAccepted.body.submitsLeft}`);
  });

  it('NOT_ACCEPTED from a wrong answer: only "Not accepted." and "Some test cases did not pass."', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitNotAccepted') });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Not accepted.' });
    expect(screen.getByRole('article', { name: 'Submit result' }).textContent).toBe(
      `Not accepted.Some test cases did not pass.Submits left ${real.submitNotAccepted.body.submitsLeft}`,
    );
  });

  it('NOT_ACCEPTED from a time limit looks identical (no reason)', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitTimeLimit') });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Not accepted.' });
    expect(results()).not.toHaveTextContent(/time limit/i);
  });

  it('COMPILATION_ERROR: Syntax error and the real message', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitSyntaxError') });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Syntax error' });
    expect(results()).toHaveTextContent(real.submitSyntaxError.body.errorMessage);
  });

  it('solved stays true on a later ACCEPTED, and the chip stays Solved', async () => {
    expect(real.submitAcceptedAgain.body.solved).toBe(true);
    const { user } = await openWorkspace({ submit: () => answer('submitAcceptedAgain') });
    await user.click(submitButton());
    await within(results()).findByRole('heading', { name: 'Accepted' });
    expect(tab(1)).toHaveTextContent('Solved');
  });
});

describe('cooldowns match the real backend', () => {
  it('the usual waits are the backend’s: a real COOLDOWN right after a Run says 3 seconds, and after a Submit 5 seconds', () => {
    expect(Math.ceil(real.runCooldownSecond.body.error.details.retryAfterMs / 1000)).toBe(RUN_COOLDOWN_MS / 1000);
    expect(Math.ceil(real.submitCooldownSecond.body.error.details.retryAfterMs / 1000)).toBe(SUBMIT_COOLDOWN_MS / 1000);
  });

  it('a Run 4 seconds after another worked on the real backend (the wait is 3 seconds, not more)', () => {
    expect(real.runOk.status).toBe(200);
    expect(real.runWrongAnswer.status).toBe(200); // sent 4 s after runOk
    expect(RUN_COOLDOWN_MS).toBeLessThan(4000);
    expect(SUBMIT_COOLDOWN_MS).toBeLessThan(6000); // submits in the capture were 6 s apart and all worked
  });

  it('the real Run and Submit waits are independent and per round', () => {
    expect(real.submitRightAfterRunOk.status).toBe(200); // a Submit straight after a Run
    expect(real.runOnOtherQuestionRightAfterRun.status).toBe(429); // a Run on another question straight after a Run
    expect(real.runOnOtherQuestionRightAfterRun.body.error.code).toBe('COOLDOWN');
  });

  it('a real COOLDOWN for Run shows the real wait (rounded up) and disables the button', async () => {
    const { user } = await openWorkspace({ run: () => answer('runCooldownSecond') });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Wait 3 seconds before running again.'));
    expect(runButton()).toBeDisabled();
    await advance(3200);
    expect(runButton()).toBeEnabled();
  });

  it('a real COOLDOWN for Submit shows the real wait (rounded up) and disables the button', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitCooldownSecond') });
    await user.click(submitButton());
    await waitFor(() => expect(notes()).toContain('Wait 5 seconds before submitting again.'));
    expect(submitButton()).toBeDisabled();
    await advance(5200);
    expect(submitButton()).toBeEnabled();
  });
});

describe('real limits and failures', () => {
  it('the real backend counts match the constants: the last Run left 0, and the cap is 30 Runs and 20 Submits', () => {
    expect(real.runLastBeforeLimit.body.runsLeft).toBe(0);
    expect(real.submitLastBeforeLimit.body.submitsLeft).toBe(0);
    const q3 = real.countsAtLimits.body.find((s) => s.index === 3);
    expect(q3.runCount).toBe(MAX_RUNS);
    expect(q3.submitCount).toBe(MAX_SUBMITS);
  });

  it('a real ATTEMPT_LIMIT for Run says no runs are left and disables Run for the question', async () => {
    const { user } = await openWorkspace({ run: () => answer('runAttemptLimit') });
    await user.click(runButton());
    await waitFor(() => expect(runButton()).toBeDisabled());
    expect(notes()).toContain('No runs left for this question.');
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 0');
  });

  it('a real ATTEMPT_LIMIT for Submit says no submits are left and disables Submit', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitAttemptLimit') });
    await user.click(submitButton());
    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(notes()).toContain('No submits left for this question.');
  });

  it('the real backend leaves the counters unchanged when the runner fails (it gives the attempt back)', () => {
    const { before, after } = real.countsAroundRunnerFailure.body;
    expect(after).toEqual(before);
    expect(real.runRunnerUnavailable.status).toBe(503);
    expect(real.runAfterRunnerBack.body.runsLeft).toBe(MAX_RUNS - before.find((s) => s.index === 2).runCount - 1);
  });

  it('a real RUNNER_UNAVAILABLE shows "Something went wrong. Try again." and the counter does not change', async () => {
    const { user } = await openWorkspace({ run: () => answer('runRunnerUnavailable') });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Something went wrong. Try again.'));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Runs left 30 · Submits left 20');
    expect(runButton()).toBeEnabled();
  });

  it('a real RUNNER_UNAVAILABLE on Submit does the same', async () => {
    const { user } = await openWorkspace({ submit: () => answer('submitRunnerUnavailable') });
    await user.click(submitButton());
    await waitFor(() => expect(notes()).toContain('Something went wrong. Try again.'));
    expect(screen.getByTestId('attempts-line')).toHaveTextContent('Submits left 20');
  });

  it('a real CODE_TOO_LARGE shows the S8 message', async () => {
    const { user } = await openWorkspace({ run: () => answer('runTooLarge') });
    await user.click(runButton());
    await waitFor(() => expect(notes()).toContain('Your code is longer than 51,200 characters.'));
  });
});
