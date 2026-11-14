import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import realResponses from './fixtures/real-backend-responses.json';
import realRounds from './fixtures/real-rounds-responses.json';

export const API = 'http://api.test';
export const ME = { id: 'u1', name: 'Alex Chen', email: 'alex@example.com' };

export function stubApiBase(value = API) {
  vi.stubEnv('VITE_API_BASE_URL', value);
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function apiError(status, code, message = 'x', details) {
  return json(status, { error: { code, message, ...(details ? { details } : {}) } });
}

/**
 * A response saved from the real backend (src/test/fixtures/real-backend-responses.json).
 * Returns a new Response each time, because a body can be read only once.
 */
export function realResponse(key) {
  const saved = realResponses[key];
  if (!saved) throw new Error(`No saved real response named ${key}`);
  return json(saved.status, saved.body, saved.retryAfter ? { 'Retry-After': saved.retryAfter } : {});
}

/** Replaces fetch. `handler(url, init)` returns a Response (or a promise of one). */
export function mockFetch(handler) {
  const fn = vi.fn(async (url, init) => handler(String(url), init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** A response saved from the real backend for the round endpoints (src/test/fixtures/real-rounds-responses.json). */
export function realRound(key) {
  const saved = realRounds[key];
  if (!saved) throw new Error(`No saved real round response named ${key}`);
  if (saved.status === 204) return new Response(null, { status: 204 });
  return json(saved.status, saved.body);
}

/** The saved body itself, for building variations of a real response. */
export function realRoundBody(key) {
  return structuredClone(realRounds[key].body);
}

export const emptyList = (limit = 10) => ({ items: [], page: 1, limit, total: 0 });

/** A question as E12 returns it (visible samples only, never hidden tests). */
export function questionBody(index, overrides = {}) {
  return {
    index,
    title: `Title ${index}`,
    topic: 'arrays',
    difficulty: 'easy',
    statement: `Statement ${index}, first line.\nSecond line.`,
    inputFormat: 'One line with two integers.',
    outputFormat: 'One integer.',
    constraints: '1 <= n <= 100',
    samples: [{ input: '1 2', output: '3', explanation: 'Add the two numbers.' }],
    code: '',
    serverTime: new Date().toISOString(),
    ...overrides,
  };
}

/** A round summary as E8 returns it (never statements, samples or code). */
export function roundSummary(id, status = 'READY', extra = {}) {
  const started = status !== 'READY';
  return {
    id,
    status,
    durationMin: 30,
    createdAt: new Date(2026, 10, 11, 10, 0).toISOString(),
    startedAt: started ? new Date(2026, 10, 11, 10, 5).toISOString() : null,
    deadline: started ? new Date(2026, 10, 11, 10, 35).toISOString() : null,
    finishedAt: status === 'FINISHED' ? new Date(2026, 10, 11, 10, 20).toISOString() : null,
    finishReason: status === 'FINISHED' ? 'MANUAL' : null,
    serverTime: new Date(2026, 10, 11, 10, 10).toISOString(),
    slots: [{ index: 1, topic: 'arrays', difficulty: 'easy', opened: false, solved: false, runCount: 0, submitCount: 0 }],
    ...extra,
  };
}

/**
 * Replaces fetch with a small router. `routes` is a list of [method, matcher, handler]:
 *  - matcher is an exact path (with its query string) or a RegExp tested against it
 *  - handler is a function (url, init) => Response, or the name of a saved real round response
 * Routes you give win over the defaults: E4 answers with the signed-in user, E5 with no topics,
 * E7 with an empty list, E8 with a READY round, E12 with a question, E13 with 204. Anything else answers 404 NOT_FOUND.
 */
export function mockApi(routes = []) {
  const defaults = [
    ['GET', '/api/auth/me', () => json(200, { user: ME })],
    ['GET', '/api/topics', () => json(200, { topics: [] })],
    ['GET', /^\/api\/assessments(\?.*)?$/, () => json(200, emptyList())],
    ['GET', /^\/api\/assessments\/[^/?]+$/, (url) => json(200, roundSummary(url.split('/').pop()))],
    ['POST', /^\/api\/assessments\/[^/?]+\/questions\/\d+\/open$/, (url) => json(200, questionBody(Number(url.split('/').slice(-2)[0])))],
    ['PUT', /^\/api\/assessments\/[^/?]+\/questions\/\d+\/code$/, () => new Response(null, { status: 204 })],
  ];
  return mockFetch((url, init) => {
    const method = (init && init.method) || 'GET';
    const path = url.slice(API.length);
    for (const [m, matcher, handler] of [...routes, ...defaults]) {
      if (m !== method) continue;
      const hit = matcher instanceof RegExp ? matcher.test(path) : matcher === path;
      if (!hit) continue;
      return typeof handler === 'string' ? realRound(handler) : handler(url, init);
    }
    return apiError(404, 'NOT_FOUND', 'No such route in the test');
  });
}

/** Puts a session in localStorage, as if the user had logged in earlier (FR2). */
export function storeSession(token = 'tok', user = ME) {
  localStorage.setItem('oa.token', token);
  localStorage.setItem('oa.user', JSON.stringify(user));
}

export function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Clicks a field (found by its label) and pastes a value into it. */
export async function fill(user, label, value) {
  const field = screen.getByLabelText(label);
  await user.click(field);
  if (value) await user.paste(value);
  return field;
}

/** The calls a fetch mock received for one path, for example callsTo(fetchMock, '/api/auth/login'). */
export function callsTo(fetchMock, pathFragment) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(pathFragment));
}
