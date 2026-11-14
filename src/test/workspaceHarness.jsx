// Shared helpers for the workspace tests: a fake backend for one ACTIVE round, and small helpers for
// typing, tabs and time. Used by WorkspacePage.test.jsx and the Run and Submit tests.
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { apiError, callsTo, json, mockApi, questionBody, renderApp, roundSummary } from './helpers';

export const RID = 'round-1';
export const MIN = 60 * 1000;
export const SEC = 1000;

export const SLOTS = [
  { index: 1, topic: 'arrays', difficulty: 'easy', opened: false, solved: false, runCount: 0, submitCount: 0 },
  { index: 2, topic: 'strings', difficulty: 'medium', opened: false, solved: false, runCount: 0, submitCount: 0 },
  { index: 3, topic: 'math', difficulty: 'hard', opened: false, solved: false, runCount: 0, submitCount: 0 },
];


// An ACTIVE round as E8 returns it. `remainingMs` is measured on the server's clock; `skewMs` is how
// far the server clock is from this machine's clock.
export function roundBody({ remainingMs = 30 * MIN, skewMs = 0, status = 'ACTIVE', slots = SLOTS } = {}) {
  const serverNow = Date.now() + skewMs;
  const base = roundSummary(RID, status);
  return {
    ...base,
    slots,
    serverTime: new Date(serverNow).toISOString(),
    startedAt: status === 'READY' ? null : new Date(serverNow - 5 * MIN).toISOString(),
    deadline: status === 'READY' ? null : new Date(serverNow + remainingMs).toISOString(),
  };
}

// Fake timers that still move with real time, so findBy and waitFor keep working. Advance them with `advance`.
export function useClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}
// Fully fake timers: time moves only when `advance` is called. Exact, but findBy cannot wait (use `settle`).
export function useExactClock() {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}
export const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

export const noContent = () => new Response(null, { status: 204 });

/**
 * Opens the workspace against a fake backend. Options:
 *  round         E8 options (see roundBody), or a function returning the E8 body each time
 *  saved         code the server holds per question, as E12 returns it
 *  open/save/finish  handlers (index, ...) => Response, to override the answers
 *  events        every call in order: 'open:2', 'save:1', 'finish', 'round'
 */
export async function openWorkspace({ round = {}, saved = {}, open, save, finish, run, submit, extra = [], path = `/rounds/${RID}/workspace`, wait = true, settle = false } = {}) {
  const events = [];
  const saves = [];
  const runs = []; // what was sent to E14: { index, body }
  const submits = []; // what was sent to E15
  const state = { status: 'ACTIVE', roundCalls: 0 };
  const routes = [
    [
      'GET',
      `/api/assessments/${RID}`,
      () => {
        events.push('round');
        state.roundCalls += 1;
        if (typeof round === 'function') return json(200, round(state));
        return json(200, roundBody({ ...round, status: state.status }));
      },
    ],
    [
      'POST',
      `/api/assessments/${RID}/finish`,
      () => {
        events.push('finish');
        if (finish) return finish(state);
        state.status = 'FINISHED';
        return json(200, roundBody({ status: 'FINISHED' }));
      },
    ],
  ];
  for (const index of [1, 2, 3]) {
    routes.push([
      'POST',
      `/api/assessments/${RID}/questions/${index}/open`,
      () => {
        events.push(`open:${index}`);
        if (open) return open(index, state);
        return json(200, questionBody(index, { code: saved[index] ?? '' }));
      },
    ]);
    routes.push([
      'POST',
      `/api/assessments/${RID}/questions/${index}/run`,
      (url, init) => {
        const body = JSON.parse(init.body);
        events.push(`run:${index}`);
        runs.push({ index, body });
        return run ? run(index, body.code, state) : json(200, runBody());
      },
    ]);
    routes.push([
      'POST',
      `/api/assessments/${RID}/questions/${index}/submit`,
      (url, init) => {
        const body = JSON.parse(init.body);
        events.push(`submit:${index}`);
        submits.push({ index, body });
        return submit ? submit(index, body.code, state) : json(200, submitBody());
      },
    ]);
    routes.push([
      'PUT',
      `/api/assessments/${RID}/questions/${index}/code`,
      (url, init) => {
        const code = JSON.parse(init.body).code;
        events.push(`save:${index}`);
        saves.push({ index, code });
        if (save) return save(index, code, state);
        saved[index] = code; // the server keeps it
        return noContent();
      },
    ]);
  }
  const fetchMock = mockApi([...routes, ...extra]);
  renderApp(path);
  if (settle) {
    // With fully fake timers findBy cannot wait, so let time pass in small steps until the problem shows.
    for (let i = 0; i < 40 && !(screen.queryByRole('article', { name: 'Problem' }) && screen.queryByLabelText('Code editor')); i += 1) await advance(25);
  } else if (wait) {
    await screen.findByTestId('screen-S8');
    await screen.findByRole('article', { name: 'Problem' });
    await screen.findByLabelText('Code editor'); // the editor is loaded lazily
  }
  const user = userEvent.setup(vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime } : {});
  return { fetchMock, events, saves, runs, submits, state, saved, user };
}

export const editor = () => screen.getByLabelText('Code editor');
export const type = (code, el = editor()) => fireEvent.change(el, { target: { value: code } });
export const tab = (n) => screen.getAllByRole('tab')[n - 1];
export const saveStatus = () => screen.getByRole('status');
export const finishButton = () => screen.getByRole('button', { name: 'Finish' });
export const postsTo = (fetchMock, fragment) => callsTo(fetchMock, fragment).filter(([, init]) => init?.method === 'POST');
export const putsTo = (fetchMock) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');


/** A Run answer as E14 returns it. */
export function runBody(overrides = {}) {
  return {
    compilation: null,
    results: [
      { input: '1 2', expected: '3', actual: '3', passed: true, status: 'OK', error: null },
      { input: '5 5', expected: '10', actual: '10', passed: true, status: 'OK', error: null },
    ],
    testsPassed: 2,
    totalTests: 2,
    runsLeft: 29,
    serverTime: new Date().toISOString(),
    ...overrides,
  };
}

/** A Submit answer as E15 returns it. */
export function submitBody(overrides = {}) {
  return { verdict: 'ACCEPTED', solved: true, submitsLeft: 19, serverTime: new Date().toISOString(), ...overrides };
}

export const runButton = () => screen.getByRole('button', { name: /^Run$|^Running/ });
export const submitButton = () => screen.getByRole('button', { name: /^Submit$|^Submitting/ });
export const results = () => screen.getByRole('region', { name: 'Results' });
