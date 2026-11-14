// FR15 from every entry point: a round is always shown by its real status.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import RoundGate from './components/RoundGate';
import real from './test/fixtures/real-rounds-responses.json';
import {
  LocationProbe,
  apiError,
  callsTo,
  json,
  mockApi,
  renderApp,
  roundSummary,
  storeSession,
  stubApiBase,
} from './test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession();
});

const location = () => screen.getByTestId('location').textContent;

const ID = 'abc123';
const STATUSES = ['READY', 'ACTIVE', 'FINISHED'];
const PATH = { READY: `/rounds/${ID}`, ACTIVE: `/rounds/${ID}/workspace`, FINISHED: `/rounds/${ID}/report` };
const SCREEN = { READY: 'S7', ACTIVE: 'S8', FINISHED: 'S10' };
const roundRoute = (status, id = ID) => ['GET', `/api/assessments/${id}`, () => json(200, roundSummary(id, status))];
// Only E8 (the round itself): the report (E16) lives under the same path and is a different call.
const roundGets = (fetchMock, id = ID) =>
  callsTo(fetchMock, `/api/assessments/${id}`).filter(
    ([url, init]) => String(url).endsWith(`/api/assessments/${id}`) && (!init?.method || init.method === 'GET'),
  );

describe('every entry path crossed with every round status', () => {
  const cases = STATUSES.flatMap((entry) => STATUSES.map((actual) => [entry, actual]));

  it.each(cases)('opening the %s route of a round that is %s ends on the screen for %s', async (entry, actual) => {
    mockApi([roundRoute(actual)]);
    renderApp(PATH[entry]);
    expect(await screen.findByTestId(`screen-${SCREEN[actual]}`)).toBeInTheDocument();
    expect(location()).toBe(PATH[actual]);
  });

  it.each(STATUSES)('a round that is already on the right route is loaded once (%s)', async (status) => {
    const fetchMock = mockApi([roundRoute(status)]);
    renderApp(PATH[status]);
    await screen.findByTestId(`screen-${SCREEN[status]}`);
    expect(roundGets(fetchMock)).toHaveLength(1);
  });

  it('shows a skeleton while the status is being found, and never flashes the wrong screen', async () => {
    let resolve;
    mockApi([['GET', `/api/assessments/${ID}`, () => new Promise((r) => (resolve = r))]]);
    renderApp(PATH.FINISHED);
    expect(await screen.findByLabelText('Loading round')).toBeInTheDocument();
    for (const id of ['S7', 'S8', 'S10']) expect(screen.queryByTestId(`screen-${id}`)).not.toBeInTheDocument();
    resolve(json(200, roundSummary(ID, 'FINISHED')));
    await screen.findByTestId('screen-S10');
  });
});

describe('redirects replace the history entry, so Back does not bounce the user', () => {
  function Back() {
    const navigate = useNavigate();
    return (
      <button type="button" onClick={() => navigate(-1)}>
        history back
      </button>
    );
  }

  it('Back after a redirect goes to the page before the round, not the redirecting address', async () => {
    mockApi([roundRoute('ACTIVE')]);
    render(
      <MemoryRouter initialEntries={['/dashboard', `/rounds/${ID}`]} initialIndex={1}>
        <AuthProvider>
          <App />
          <LocationProbe />
          <Back />
        </AuthProvider>
      </MemoryRouter>,
    );
    await screen.findByTestId('screen-S8');
    expect(location()).toBe(PATH.ACTIVE);
    await userEvent.click(screen.getByRole('button', { name: 'history back' }));
    expect(location()).toBe('/dashboard');
  });
});

describe('a round that cannot be loaded', () => {
  const ENTRIES = [
    ['the round router', PATH.READY],
    ['the workspace', PATH.ACTIVE],
    ['the report', PATH.FINISHED],
  ];

  it.each(ENTRIES)('a 404 on %s shows the not-found view with a link back to My rounds', async (_name, path) => {
    mockApi([['GET', `/api/assessments/${ID}`, () => apiError(404, 'NOT_FOUND', 'Round not found')]]);
    renderApp(path);
    const view = await screen.findByTestId('round-not-found');
    expect(within(view).getByRole('link', { name: 'Back to My rounds' })).toHaveAttribute('href', '/rounds');
    expect(location()).toBe(path); // no redirect
  });

  it.each(ENTRIES)('a failure on %s shows the error with Retry, and Retry routes by status', async (_name, path) => {
    let up = false;
    mockApi([['GET', `/api/assessments/${ID}`, () => (up ? json(200, roundSummary(ID, 'FINISHED')) : apiError(500, 'INTERNAL_ERROR'))]]);
    const user = userEvent.setup();
    renderApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S10');
    expect(location()).toBe(PATH.FINISHED);
  });

  it('a status the app does not know is an error, not a redirect loop', async () => {
    const fetchMock = mockApi([['GET', `/api/assessments/${ID}`, () => json(200, { ...roundSummary(ID), status: 'PAUSED' })]]);
    renderApp(PATH.READY);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(location()).toBe(PATH.READY);
    expect(roundGets(fetchMock)).toHaveLength(1);
  });

  it('an answer that is not a round is an error', async () => {
    mockApi([['GET', `/api/assessments/${ID}`, () => json(200, { hello: 'world' })]]);
    renderApp(PATH.ACTIVE);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('RoundGate hands the loaded round to the screen (no second E8 call)', () => {
  it('gives the screen the round, with the same deadline the server returned after Start (real responses)', async () => {
    const started = real.startForDeadline.body; // E10
    mockApi([['GET', `/api/assessments/${started.id}`, () => json(200, real.getAfterStartForDeadline.body)]]);
    render(
      <MemoryRouter initialEntries={[`/rounds/${started.id}/workspace`]}>
        <Routes>
          <Route
            path="/rounds/:id/workspace"
            element={
              <RoundGate expected="ACTIVE">
                {(round) => (
                  <div>
                    <span data-testid="deadline">{round.deadline}</span>
                    <span data-testid="server-time">{round.serverTime}</span>
                    <span data-testid="slots">{round.slots.length}</span>
                  </div>
                )}
              </RoundGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('deadline')).toHaveTextContent(started.deadline);
    expect(screen.getByTestId('server-time')).toHaveTextContent(real.getAfterStartForDeadline.body.serverTime);
    expect(screen.getByTestId('slots')).toHaveTextContent(String(started.slots.length));
  });
});

describe('entry points: the links in My rounds and on the dashboard', () => {
  const item = (id, status, extra = {}) => ({
    id,
    status,
    durationMin: 30,
    questionCount: 1,
    solvedCount: 0,
    createdAt: new Date(2026, 10, 11, 10, 0).toISOString(),
    startedAt: null,
    finishedAt: null,
    finishReason: null,
    ...extra,
  });
  const LIST = {
    items: [item('r-ready', 'READY'), item('r-active', 'ACTIVE'), item('r-done', 'FINISHED', { finishReason: 'MANUAL' })],
    page: 1,
    limit: 10,
    total: 3,
  };
  const listRoute = ['GET', '/api/assessments?page=1&limit=10', () => json(200, LIST)];

  it.each([
    ['Start', 'r-ready', 'READY', 'S7', '/rounds/r-ready'],
    ['Resume', 'r-active', 'ACTIVE', 'S8', '/rounds/r-active/workspace'],
    ['View report', 'r-done', 'FINISHED', 'S10', '/rounds/r-done/report'],
  ])('My rounds: %s opens the right screen', async (label, id, status, screenId, path) => {
    mockApi([listRoute, roundRoute(status, id)]);
    const user = userEvent.setup();
    renderApp('/rounds');
    await screen.findAllByTestId('round-row');
    await user.click(screen.getByRole('link', { name: new RegExp(`^${label}`) }));
    await screen.findByTestId(`screen-${screenId}`);
    expect(location()).toBe(path);
  });

  it('My rounds: Start for a round another tab has already started ends on the workspace', async () => {
    mockApi([listRoute, roundRoute('ACTIVE', 'r-ready')]);
    const user = userEvent.setup();
    renderApp('/rounds');
    await screen.findAllByTestId('round-row');
    await user.click(screen.getByRole('link', { name: /^Start/ }));
    await screen.findByTestId('screen-S8');
    expect(location()).toBe('/rounds/r-ready/workspace');
  });

  it('dashboard: Resume for a round that has run out of time ends on the report', async () => {
    mockApi([
      ['GET', '/api/assessments?limit=1', () => json(200, { items: [item('r-active', 'ACTIVE')], page: 1, limit: 1, total: 1 })],
      ['GET', '/api/assessments?status=ACTIVE&limit=1', () => json(200, { items: [item('r-active', 'ACTIVE')], page: 1, limit: 1, total: 1 })],
      ['GET', '/api/assessments/r-active', () => json(200, roundSummary('r-active', 'ACTIVE'))],
    ]);
    const user = userEvent.setup();
    renderApp('/dashboard');
    const card = await screen.findByRole('region', { name: 'Active round' });
    await within(card).findByText(/^Started /);
    // By the time the student clicks Resume the server has finished the round.
    mockApi([['GET', '/api/assessments/r-active', () => json(200, roundSummary('r-active', 'FINISHED', { finishReason: 'EXPIRED' }))]]);
    await act(async () => {
      await user.click(within(card).getByRole('link', { name: 'Resume' }));
    });
    await screen.findByTestId('screen-S10');
    await waitFor(() => expect(location()).toBe('/rounds/r-active/report'));
  });

  it('dashboard: Start on the ready card opens the round details page', async () => {
    mockApi([
      ['GET', '/api/assessments?limit=1', () => json(200, { items: [item('r-ready', 'READY')], page: 1, limit: 1, total: 1 })],
      ['GET', '/api/assessments?status=READY&limit=1', () => json(200, { items: [item('r-ready', 'READY')], page: 1, limit: 1, total: 1 })],
      roundRoute('READY', 'r-ready'),
    ]);
    const user = userEvent.setup();
    renderApp('/dashboard');
    const card = await screen.findByRole('region', { name: 'Ready round' });
    await user.click(within(card).getByRole('link', { name: 'Start' }));
    await screen.findByTestId('screen-S7');
    expect(location()).toBe('/rounds/r-ready');
  });
});
