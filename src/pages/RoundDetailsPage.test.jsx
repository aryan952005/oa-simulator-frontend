import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatDateTime } from '../lib/format';
import real from '../test/fixtures/real-rounds-responses.json';
import {
  apiError,
  callsTo,
  json,
  mockApi,
  realResponse,
  realRound,
  realRoundBody,
  renderApp,
  roundSummary,
  storeSession,
  stubApiBase,
} from '../test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession();
});

const location = () => screen.getByTestId('location').textContent;

// A real READY round with three questions, and the real answers for starting a round.
const READY = real.getRoundReady3.body;
const ID = READY.id;
const STARTED = real.startForDeadline.body; // E10, 200
const STARTED_ID = STARTED.id;
const readyRoute = (body = READY) => ['GET', `/api/assessments/${body.id}`, () => json(200, body)];
const startRoute = (handler) => ['POST', `/api/assessments/${ID}/start`, handler];
const deleteRoute = (handler) => ['DELETE', `/api/assessments/${ID}`, handler];
const noContent = () => new Response(null, { status: 204 });
const posts = (fetchMock, fragment) =>
  callsTo(fetchMock, fragment).filter(([, init]) => init?.method === 'POST');

async function openDetails(routes = [readyRoute()], id = ID) {
  const user = userEvent.setup();
  const fetchMock = mockApi(routes);
  renderApp(`/rounds/${id}`);
  await screen.findByTestId('screen-S7');
  return { user, fetchMock };
}

const startButton = () => screen.getByRole('button', { name: /^Start$|^Starting/ });

describe('S7 what it shows (real E8 response)', () => {
  it('shows a READY badge and loads the round with E8', async () => {
    const { fetchMock } = await openDetails();
    const page = screen.getByTestId('screen-S7');
    expect(within(page).getByText('Ready')).toBeInTheDocument();
    expect(callsTo(fetchMock, `/api/assessments/${ID}`).filter(([, init]) => !init?.method || init.method === 'GET')).toHaveLength(1);
  });

  it('shows the duration, the question count and the created date and time', async () => {
    await openDetails();
    const card = (label) => screen.getByRole('group', { name: label });
    expect(card('Duration')).toHaveTextContent('62 min');
    expect(card('Questions')).toHaveTextContent('3');
    expect(card('Created')).toHaveTextContent(formatDateTime(READY.createdAt));
  });

  it('shows one locked card per question with Q n, the topic and the difficulty', async () => {
    await openDetails();
    const cards = screen.getAllByTestId('locked-question');
    expect(cards.map((c) => c.textContent.replace('lock', ''))).toEqual([
      'Q1Arrays · EasyLocked',
      'Q2Strings · MediumLocked',
      'Q3Math · HardLocked',
    ]);
  });

  it('shows nothing from the question itself: no statement, samples, code or hidden data', async () => {
    await openDetails();
    // The question cards hold only Q n, the topic and the difficulty. (The rules panel mentions
    // "sample tests" as a rule, so only the cards are checked for question content.)
    for (const card of screen.getAllByTestId('locked-question')) {
      expect(card.textContent).not.toMatch(/statement|sample|input|output|constraints|hidden|expected|def |print\(/i);
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(Object.keys(READY.slots[0]).sort()).toEqual(['difficulty', 'index', 'opened', 'runCount', 'solved', 'submitCount', 'topic']);
  });

  it('never shows the round id (FR18)', async () => {
    await openDetails();
    expect(screen.getByTestId('screen-S7')).not.toHaveTextContent(ID);
  });

  it('has the rules panel with the six lines from the spec, with numbers from the limits file', async () => {
    await openDetails();
    const rules = screen.getByRole('region', { name: 'Rules' });
    expect(within(rules).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The clock starts when you press Start and does not pause.',
      'You can move between questions freely.',
      'Run checks the sample tests. You can run each question up to 30 times, at most once every 3 seconds.',
      'Submit checks every test. You can submit each question up to 20 times, at most once every 5 seconds.',
      'Only one round can be active at a time.',
      'You can finish early. When time runs out, the round finishes on its own.',
    ]);
  });

  it('shows the same rules for every round', async () => {
    const other = { ...READY, slots: READY.slots.slice(0, 1), durationMin: 12 };
    await openDetails([readyRoute(other)], other.id);
    expect(within(screen.getByRole('region', { name: 'Rules' })).getAllByRole('listitem')).toHaveLength(6);
  });

  it('has Back to My rounds, Delete and Start', async () => {
    await openDetails();
    expect(screen.getByRole('link', { name: 'Back to My rounds' })).toHaveAttribute('href', '/rounds');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(startButton()).toBeEnabled();
  });

  it('does not show what the spec removes', async () => {
    await openDetails();
    const text = screen.getByTestId('screen-S7').textContent;
    expect(text).not.toMatch(/expires in|7 days|168 hours/i);
    expect(text).not.toMatch(/latency|sandbox|terminal|ping|worker|cluster/i);
    expect(text).not.toMatch(/memory|256|timeout|python 3|keymap|vim|sublime/i);
    expect(text).not.toMatch(/\best\.|\b\d+\s?ms\b/i); // the design's "Est. 12m" and latency figures
  });
});

describe('S7 loading, error and not-found states (FR22, FR1)', () => {
  it('shows a skeleton while E8 loads', async () => {
    let resolve;
    mockApi([['GET', `/api/assessments/${ID}`, () => new Promise((r) => (resolve = r))]]);
    renderApp(`/rounds/${ID}`);
    expect(await screen.findByLabelText('Loading round')).toBeInTheDocument();
    resolve(json(200, READY));
    await screen.findByTestId('screen-S7');
    expect(screen.queryByLabelText('Loading round')).not.toBeInTheDocument();
  });

  it('shows the error with Retry, and Retry loads the round', async () => {
    let up = false;
    const fetchMock = mockApi([['GET', `/api/assessments/${ID}`, () => (up ? json(200, READY) : apiError(500, 'INTERNAL_ERROR'))]]);
    const user = userEvent.setup();
    renderApp(`/rounds/${ID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S7');
    expect(callsTo(fetchMock, `/api/assessments/${ID}`)).toHaveLength(2);
  });

  it('a 404 shows the not-found view with a link back to My rounds', async () => {
    mockApi([['GET', '/api/assessments/000000000000000000000000', () => realRound('getRoundNotFound')]]);
    renderApp('/rounds/000000000000000000000000');
    const view = await screen.findByTestId('round-not-found');
    expect(within(view).getByRole('link', { name: 'Back to My rounds' })).toHaveAttribute('href', '/rounds');
    expect(screen.queryByTestId('screen-S7')).not.toBeInTheDocument();
  });

  it('an id that is not a valid id also gives the not-found view (the real backend answers 404)', async () => {
    mockApi([['GET', '/api/assessments/abc123', () => realRound('getRoundBadId')]]);
    renderApp('/rounds/abc123');
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
  });
});

describe('S7 Start', () => {
  // The round is READY until Start is accepted, then E8 reports the real ACTIVE round.
  function startFlow(extra = []) {
    let started = false;
    const ready = { ...realRoundBody('getAfterStartForDeadline'), status: 'ACTIVE' };
    const readyBody = { ...ready, status: 'READY', startedAt: null, deadline: null };
    return [
      ['GET', `/api/assessments/${STARTED_ID}`, () => json(200, started ? real.getAfterStartForDeadline.body : readyBody)],
      ['POST', `/api/assessments/${STARTED_ID}/start`, () => {
        started = true;
        return realRound('startForDeadline');
      }],
      ...extra,
    ];
  }

  it('calls E10 with no body and opens the workspace on 200', async () => {
    const { user, fetchMock } = await openDetails(startFlow(), STARTED_ID);
    await user.click(startButton());
    await screen.findByTestId('screen-S8');
    const [start] = posts(fetchMock, `/api/assessments/${STARTED_ID}/start`);
    expect(start[0]).toBe(`http://api.test/api/assessments/${STARTED_ID}/start`);
    expect(start[1].body).toBeUndefined();
    expect(location()).toBe(`/rounds/${STARTED_ID}/workspace`);
  });

  it('the workspace loads the same deadline E10 returned (real responses)', async () => {
    // E10 and the E8 the workspace makes right after Start give one and the same deadline.
    expect(real.startForDeadline.body.deadline).toBeTruthy();
    expect(real.getAfterStartForDeadline.body.deadline).toBe(real.startForDeadline.body.deadline);
    expect(real.getAfterStartForDeadline.body.startedAt).toBe(real.startForDeadline.body.startedAt);
  });

  it('disables Start while the request is pending, so a double click sends one request', async () => {
    let resolve;
    const { user, fetchMock } = await openDetails(
      [readyRoute(), startRoute(() => new Promise((r) => (resolve = r)))],
    );
    await user.click(startButton());
    const busy = screen.getByRole('button', { name: 'Starting…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    await user.dblClick(busy);
    expect(posts(fetchMock, '/start')).toHaveLength(1);
    resolve(realRound('startForDeadline'));
    await waitFor(() => expect(location()).toBe(`/rounds/${ID}/workspace`));
  });

  it('a second tab: ROUND_NOT_READY (real response) routes away to the workspace, with no second clock', async () => {
    // Tab 1 already started the round. This tab still shows READY, and E8 now says ACTIVE.
    let calls = 0;
    const { user, fetchMock } = await openDetails([
      ['GET', `/api/assessments/${ID}`, () => json(200, calls++ === 0 ? READY : { ...real.getAfterStartForDeadline.body, id: ID })],
      startRoute(() => realRound('startRoundNotReady')),
    ]);
    await user.click(startButton());
    await screen.findByTestId('screen-S8');
    expect(location()).toBe(`/rounds/${ID}/workspace`);
    expect(posts(fetchMock, '/start')).toHaveLength(1); // one attempt, and no retry that could start a clock
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ROUND_NOT_READY for a round that already finished routes to the report', async () => {
    let calls = 0;
    const { user } = await openDetails([
      ['GET', `/api/assessments/${ID}`, () => json(200, calls++ === 0 ? READY : { ...real.getRoundFinished.body, id: ID })],
      startRoute(() => realRound('startRoundNotReady')),
    ]);
    await user.click(startButton());
    await screen.findByTestId('screen-S10');
    expect(location()).toBe(`/rounds/${ID}/report`);
  });

  it('ROUND_NOT_READY when E8 still says READY shows a generic banner, and Start can be tried again', async () => {
    const { user, fetchMock } = await openDetails([readyRoute(), startRoute(() => realRound('startRoundNotReady'))]);
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(location()).toBe(`/rounds/${ID}`);
    expect(startButton()).toBeEnabled();
    expect(posts(fetchMock, '/start')).toHaveLength(1);
  });

  it('ACTIVE_ROUND_EXISTS (real response) shows the banner with a link to the active round found with E7', async () => {
    const activeId = real.listActiveForExists.body.items[0].id;
    const { user, fetchMock } = await openDetails([
      readyRoute(),
      startRoute(() => realRound('startRoundActiveExists')),
      ['GET', '/api/assessments?status=ACTIVE&limit=1', () => realRound('listActiveForExists')],
    ]);
    await user.click(startButton());
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('You already have an active round.');
    const link = await within(banner).findByRole('link', { name: 'Go to your active round' });
    expect(link).toHaveAttribute('href', `/rounds/${activeId}/workspace`);
    expect(callsTo(fetchMock, 'status=ACTIVE')).toHaveLength(1);
    expect(location()).toBe(`/rounds/${ID}`);
    expect(startButton()).toBeEnabled();
  });

  it('the link opens that round’s workspace', async () => {
    const activeId = real.listActiveForExists.body.items[0].id;
    const { user } = await openDetails([
      readyRoute(),
      startRoute(() => realRound('startRoundActiveExists')),
      ['GET', '/api/assessments?status=ACTIVE&limit=1', () => realRound('listActiveForExists')],
      ['GET', `/api/assessments/${activeId}`, () => json(200, roundSummary(activeId, 'ACTIVE'))],
    ]);
    await user.click(startButton());
    await user.click(await screen.findByRole('link', { name: 'Go to your active round' }));
    await screen.findByTestId('screen-S8');
    expect(location()).toBe(`/rounds/${activeId}/workspace`);
  });

  it('ACTIVE_ROUND_EXISTS shows the banner without a link when E7 finds no active round', async () => {
    const { user } = await openDetails([
      readyRoute(),
      startRoute(() => realRound('startRoundActiveExists')),
      ['GET', '/api/assessments?status=ACTIVE&limit=1', () => json(200, { items: [], page: 1, limit: 1, total: 0 })],
    ]);
    await user.click(startButton());
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('You already have an active round.');
    await waitFor(() => expect(startButton()).toBeEnabled());
    expect(within(banner).queryByRole('link')).not.toBeInTheDocument();
  });

  it('ACTIVE_ROUND_EXISTS shows the banner without a link when E7 fails', async () => {
    const { user } = await openDetails([
      readyRoute(),
      startRoute(() => realRound('startRoundActiveExists')),
      ['GET', '/api/assessments?status=ACTIVE&limit=1', () => apiError(500, 'INTERNAL_ERROR')],
    ]);
    await user.click(startButton());
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('You already have an active round.');
    expect(within(banner).queryByRole('link')).not.toBeInTheDocument();
  });

  it('NOT_FOUND shows the not-found view', async () => {
    const { user } = await openDetails([readyRoute(), startRoute(() => realRound('startRoundNotFound'))]);
    await user.click(startButton());
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-S7')).not.toBeInTheDocument();
  });

  it('a network error shows a banner with Retry, and Retry starts the round', async () => {
    let up = false;
    const { user, fetchMock } = await openDetails([
      ['GET', `/api/assessments/${ID}`, () => json(200, up ? { ...real.getAfterStartForDeadline.body, id: ID } : READY)],
      startRoute(() => {
        if (!up) throw new TypeError('Failed to fetch');
        return realRound('startForDeadline');
      }),
    ]);
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(startButton()).toBeEnabled();
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S8');
    expect(posts(fetchMock, '/start')).toHaveLength(2);
  });

  it('INTERNAL_ERROR shows a banner with Retry', async () => {
    const { user } = await openDetails([readyRoute(), startRoute(() => apiError(500, 'INTERNAL_ERROR', 'boom'))]);
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('TOO_MANY_REQUESTS (real response) shows the wait, without Retry', async () => {
    const { user } = await openDetails([readyRoute(), startRoute(() => realResponse('tooManyRequests'))]);
    await user.click(startButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Try again in 60 seconds.');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('S7 Delete', () => {
  const confirmButton = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' });

  it('asks first with the exact text, and Cancel makes no call', async () => {
    const { user, fetchMock } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this round? This cannot be undone.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
    expect(location()).toBe(`/rounds/${ID}`);
  });

  it('Escape also cancels', async () => {
    const { user, fetchMock } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('calls E9 only after confirmation, then goes to My rounds with a short confirmation', async () => {
    let finish;
    const { user, fetchMock } = await openDetails([readyRoute(), deleteRoute(() => new Promise((r) => (finish = r)))]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false); // asked first, nothing sent yet
    await user.click(confirmButton());

    // In flight: still on the page, with progress shown.
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1));
    expect(location()).toBe(`/rounds/${ID}`);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deleting…' })).toBeDisabled();

    finish(noContent());
    await screen.findByTestId('screen-S6');
    expect(location()).toBe('/rounds');
    expect(await screen.findByRole('status')).toHaveTextContent('Round deleted.');
  });

  it('sends DELETE to the round’s own address', async () => {
    const { user, fetchMock } = await openDetails([readyRoute(), deleteRoute(noContent)]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(confirmButton());
    await screen.findByTestId('screen-S6');
    const [call] = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(call[0]).toBe(`http://api.test/api/assessments/${ID}`);
  });

  it('ROUND_NOT_READY (real response) reloads the round and routes by its status', async () => {
    let calls = 0;
    const { user } = await openDetails([
      ['GET', `/api/assessments/${ID}`, () => json(200, calls++ === 0 ? READY : { ...real.getAfterStartForDeadline.body, id: ID })],
      deleteRoute(() => realRound('deleteRoundNotReady')),
    ]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(confirmButton());
    await screen.findByTestId('screen-S8');
    expect(location()).toBe(`/rounds/${ID}/workspace`);
    expect(screen.queryByText('Round deleted.')).not.toBeInTheDocument();
  });

  it('NOT_FOUND shows the not-found view', async () => {
    const { user } = await openDetails([readyRoute(), deleteRoute(() => realRound('deleteNotFound'))]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(confirmButton());
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
  });

  it('a network error keeps the round, shows a banner with Retry, and Retry deletes it', async () => {
    let up = false;
    const { user, fetchMock } = await openDetails([
      readyRoute(),
      deleteRoute(() => {
        if (!up) throw new TypeError('Failed to fetch');
        return noContent();
      }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(location()).toBe(`/rounds/${ID}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S6');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(2);
  });
});
