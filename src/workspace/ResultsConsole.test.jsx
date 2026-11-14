import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResultsConsole from './ResultsConsole';

const sample = (overrides = {}) => ({ input: '1 2', expected: '3', actual: '3', passed: true, status: 'OK', error: null, ...overrides });
const run = (overrides = {}) => ({ kind: 'run', compilation: null, results: [sample()], testsPassed: 1, totalTests: 1, runsLeft: 29, ...overrides });
const submit = (overrides = {}) => ({ kind: 'submit', verdict: 'ACCEPTED', errorMessage: null, solved: true, submitsLeft: 19, ...overrides });
const show = (result, counters = { runsLeft: 29, submitsLeft: 19 }) => render(<ResultsConsole result={result} {...counters} />);

describe('empty console', () => {
  it('says there are no results yet', () => {
    show(null);
    expect(screen.getByText('No results yet.')).toBeInTheDocument();
  });
});

describe('Run result (spec S9)', () => {
  it('heading "Run: X of Y sample tests passed" and the footer with the runs left', () => {
    show(run({ testsPassed: 2, totalTests: 3, results: [sample(), sample(), sample({ passed: false, actual: '4' })] }), { runsLeft: 27, submitsLeft: 20 });
    expect(screen.getByRole('heading', { name: 'Run: 2 of 3 sample tests passed' })).toBeInTheDocument();
    expect(screen.getByText('Runs left 27')).toBeInTheDocument();
  });

  it('one card per sample with Input, Expected output, Your output and the result', () => {
    show(run({ results: [sample({ input: 'A', expected: 'B', actual: 'B' }), sample({ input: 'C', expected: 'D', actual: 'X', passed: false })], testsPassed: 1, totalTests: 2 }));
    const first = screen.getByRole('listitem', { name: 'Sample 1 result' });
    expect(within(first).getByText('Input')).toBeInTheDocument();
    expect(within(first).getByText('Expected output')).toBeInTheDocument();
    expect(within(first).getByText('Your output')).toBeInTheDocument();
    expect(within(first).getByText('Result: Passed')).toBeInTheDocument();
    expect([...first.querySelectorAll('pre')].map((p) => p.textContent)).toEqual(['A', 'B', 'B']);
    const second = screen.getByRole('listitem', { name: 'Sample 2 result' });
    expect(within(second).getByText('Result: Failed')).toBeInTheDocument();
    expect([...second.querySelectorAll('pre')].map((p) => p.textContent)).toEqual(['C', 'D', 'X']);
  });

  it('input, expected and your output are in monospace blocks', () => {
    show(run());
    for (const pre of screen.getByRole('listitem', { name: 'Sample 1 result' }).querySelectorAll('pre')) {
      expect(pre).toHaveClass('font-label-code-sm');
    }
  });

  it('empty output is shown as (no output)', () => {
    show(run({ results: [sample({ actual: '', passed: false })], testsPassed: 0 }));
    expect(screen.getByText('(no output)')).toBeInTheDocument();
  });

  it('a runtime error shows "Runtime error" and its error text', () => {
    show(run({ results: [sample({ actual: '', passed: false, status: 'RUNTIME_ERROR', error: 'Traceback (most recent call last):\nValueError: boom' })], testsPassed: 0 }));
    const card = screen.getByRole('listitem', { name: 'Sample 1 result' });
    expect(within(card).getByText('Runtime error')).toBeInTheDocument();
    expect(card).toHaveTextContent('ValueError: boom');
    expect(within(card).getByText('Result: Failed')).toBeInTheDocument();
  });

  it('a time limit shows "Time limit exceeded"', () => {
    show(run({ results: [sample({ actual: '', passed: false, status: 'TIME_LIMIT_EXCEEDED' })], testsPassed: 0 }));
    expect(screen.getByText('Time limit exceeded')).toBeInTheDocument();
  });

  it('a wrong answer (status OK) shows nothing extra', () => {
    show(run({ results: [sample({ actual: '4', passed: false, status: 'OK' })], testsPassed: 0 }));
    const card = screen.getByRole('listitem', { name: 'Sample 1 result' });
    expect(card).not.toHaveTextContent(/runtime error|time limit/i);
    expect(within(card).getByText('Result: Failed')).toBeInTheDocument();
  });

  it('shows the error text only for a runtime error, even if another status carries stderr', () => {
    show(run({ results: [sample({ actual: '4', passed: false, status: 'OK', error: 'a warning on stderr' })], testsPassed: 0 }));
    expect(screen.queryByText(/a warning on stderr/)).not.toBeInTheDocument();
  });

  it('a syntax error shows "Syntax error" and its message, and no samples', () => {
    show(run({ compilation: { message: 'Line 3: SyntaxError: invalid syntax' }, results: [], testsPassed: 0, totalTests: 3 }));
    expect(screen.getByRole('heading', { name: 'Syntax error' })).toBeInTheDocument();
    expect(screen.getByText('Line 3: SyntaxError: invalid syntax')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByText(/sample tests passed/)).not.toBeInTheDocument();
  });
});

describe('Submit result (spec S9)', () => {
  it('ACCEPTED: "Accepted" in green and "Your solution passed all tests."', () => {
    show(submit());
    const heading = screen.getByRole('heading', { name: 'Accepted' });
    expect(heading).toHaveClass('text-success');
    expect(screen.getByText('Your solution passed all tests.')).toBeInTheDocument();
    expect(screen.getByText('Submits left 19')).toBeInTheDocument();
  });

  it('NOT_ACCEPTED: "Not accepted." and "Some test cases did not pass." and nothing more', () => {
    show(submit({ verdict: 'NOT_ACCEPTED', solved: false }));
    expect(screen.getByRole('heading', { name: 'Not accepted.' })).toBeInTheDocument();
    expect(screen.getByText('Some test cases did not pass.')).toBeInTheDocument();
    const text = screen.getByRole('article', { name: 'Submit result' }).textContent;
    expect(text).toBe('Not accepted.Some test cases did not pass.Submits left 19');
  });

  it('COMPILATION_ERROR: "Syntax error" and the message', () => {
    show(submit({ verdict: 'COMPILATION_ERROR', errorMessage: 'Line 1: SyntaxError: invalid syntax', solved: false }));
    expect(screen.getByRole('heading', { name: 'Syntax error' })).toBeInTheDocument();
    expect(screen.getByText('Line 1: SyntaxError: invalid syntax')).toBeInTheDocument();
  });

  it('never shows a test number, a count of tests, a per-test result or a reason', () => {
    for (const verdict of ['ACCEPTED', 'NOT_ACCEPTED', 'COMPILATION_ERROR']) {
      const { unmount } = show(submit({ verdict, errorMessage: 'Line 1: SyntaxError', solved: verdict === 'ACCEPTED' }));
      const text = screen.getByRole('article', { name: 'Submit result' }).textContent;
      expect(text).not.toMatch(/test #?\d|\d+ ?(of|\/) ?\d+ (tests|passed)|wrong answer|time limit|runtime error|hidden|expected|input/i);
      unmount();
    }
  });
});
