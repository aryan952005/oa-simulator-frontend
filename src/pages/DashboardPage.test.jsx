import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../lib/format';
import real from '../test/fixtures/real-rounds-responses.json';
import {
  ME,
  apiError,
  callsTo,
  emptyList,
  json,
  mockApi,
  realRound,
  realRoundBody,
  renderApp,
  storeSession,
  stubApiBase,
} from '../test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession('tok', ME);
});

const location = () => screen.getByTestId('location').textContent;

// The five E7 calls the dashboard makes, and the real backend answers for a user with 14 rounds.
const LIST = {
  all: '/api/assessments?limit=1',
  ready: '/api/assessments?status=READY&limit=1',
  active: '/api/assessments?status=ACTIVE&limit=1',
  finished: '/api/assessments?status=FINISHED&limit=1',
  recent: '/api/assessments?limit=5',
};
const REAL_ROUTES = [
  ['GET', LIST.all, 'listAllLimit1'],
  ['GET', LIST.ready, 'listReadyLimit1'],
  ['GET', LIST.active, 'listActiveLimit1'],
  ['GET', LIST.finished, 'listFinishedLimit1'],
  ['GET', LIST.recent, 'listRecent'],
  ['GET', `/api/assessments/${real.getRoundActive.body.id}`, 'getRoundActive'],
];

const listBody = (items, total = items.length) => ({ items, page: 1, limit: items.length || 1, total });
const route = (path, body) => ['GET', path, () => json(200, body)];

async function openDashboard(routes = REAL_ROUTES) {
  const user = userEvent.setup();
  const fetchMock = mockApi(routes);
  renderApp('/dashboard');
  await screen.findByTestId('screen-S4');
  return { user, fetchMock };
}

const stat = (name) => screen.getByTestId(`stat-${name}`);

describe('S4 greeting and layout', () => {
  it('greets the user by name from oa.user', async () => {
    await openDashboard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi, Alex Chen');
  });

  it('has a Create round button that goes to /rounds/new', async () => {
    const { user } = await openDashboard();
    const screenS4 = screen.getByTestId('screen-S4');
    await user.click(within(screenS4).getByRole('link', { name: 'Create round' }));
    expect(location()).toBe('/rounds/new');
  });
});

describe('S4 stat cards equal the E7 totals (real backend response)', () => {
  it('shows Rounds, Ready, Active and Finished from `total`', async () => {
    await openDashboard();
    await waitFor(() => expect(stat('rounds')).toBeInTheDocument());
    await waitFor(() => expect(stat('finished')).toBeInTheDocument());
    expect(stat('rounds')).toHaveTextContent(String(real.listAllLimit1.body.total));
    expect(stat('ready')).toHaveTextContent(String(real.listReadyLimit1.body.total));
    expect(stat('active')).toHaveTextContent(String(real.listActiveLimit1.body.total));
    expect(stat('finished')).toHaveTextContent(String(real.listFinishedLimit1.body.total));
    // The real user has 14 rounds: 12 ready, 1 active, 1 finished.
    expect([stat('rounds'), stat('ready'), stat('active'), stat('finished')].map((e) => e.textContent)).toEqual(['14', '12', '1', '1']);
  });

  it('makes one E7 call per status with limit=1, one without a status, and one with limit=5', async () => {
    const { fetchMock } = await openDashboard();
    await waitFor(() => expect(stat('finished')).toBeInTheDocument());
    const urls = callsTo(fetchMock, '/api/assessments')
      .map(([url]) => url.replace('http://api.test', ''))
      .filter((u) => u.includes('?'));
    expect(new Set(urls)).toEqual(new Set(Object.values(LIST)));
  });

  it('shows the totals it is given, not a count of the rows', async () => {
    await openDashboard([
      route(LIST.all, listBody([], 37)),
      route(LIST.ready, listBody([], 20)),
      route(LIST.active, listBody([], 0)),
      route(LIST.finished, listBody([], 17)),
      route(LIST.recent, listBody([])),
    ]);
    await waitFor(() => expect(stat('rounds')).toHaveTextContent('37'));
    expect(stat('ready')).toHaveTextContent('20');
    expect(stat('active')).toHaveTextContent('0');
    expect(stat('finished')).toHaveTextContent('17');
  });

  it('shows a loading state, then the number', async () => {
    let resolve;
    mockApi([['GET', LIST.all, () => new Promise((r) => (resolve = r))]]);
    renderApp('/dashboard');
    await screen.findByTestId('screen-S4');
    expect(screen.queryByTestId('stat-rounds')).not.toBeInTheDocument();
    resolve(realRound('listAllLimit1'));
    expect(await screen.findByTestId('stat-rounds')).toHaveTextContent('14');
  });

  it('a stat that fails shows "Could not load" with Retry, and Retry loads it', async () => {
    let up = false;
    const { user, fetchMock } = await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => path !== LIST.finished),
      ['GET', LIST.finished, () => (up ? realRound('listFinishedLimit1') : apiError(500, 'INTERNAL_ERROR'))],
    ]);
    const retry = await screen.findByRole('button', { name: 'Retry Finished' });
    expect(screen.getAllByText('Could not load')).toHaveLength(1);
    expect(stat('rounds')).toBeInTheDocument(); // the other cards are not affected
    up = true;
    await user.click(retry);
    await waitFor(() => expect(stat('finished')).toHaveTextContent('1'));
    expect(callsTo(fetchMock, LIST.finished)).toHaveLength(2);
  });
});

describe('S4 active round card', () => {
  it('is shown when an ACTIVE round exists: found with E7, then E8, with the start time and the questions', async () => {
    const { fetchMock } = await openDashboard();
    const card = await screen.findByRole('region', { name: 'Active round' });
    await within(card).findByText(/^Started /);
    const detail = real.getRoundActive.body;
    const urls = callsTo(fetchMock, `/api/assessments/${detail.id}`).map(([url]) => url);
    expect(urls).toEqual([`http://api.test/api/assessments/${detail.id}`]);
    expect(within(card).getByText(`Started ${formatDateTime(detail.startedAt)}`)).toBeInTheDocument();
    expect(within(card).getAllByRole('listitem')).toHaveLength(detail.slots.length);
    expect(within(card).getByText('Q1 · Arrays · Easy')).toBeInTheDocument();
  });

  it('Resume opens that round’s workspace', async () => {
    const { user } = await openDashboard();
    const card = await screen.findByRole('region', { name: 'Active round' });
    const resume = within(card).getByRole('link', { name: 'Resume' });
    expect(resume).toHaveAttribute('href', `/rounds/${real.listActiveLimit1.body.items[0].id}/workspace`);
    await user.click(resume);
    expect(location()).toBe(`/rounds/${real.listActiveLimit1.body.items[0].id}/workspace`);
    await screen.findByTestId('screen-S8');
  });

  it('shows the status chip of each question, computed from the slot', async () => {
    const detail = realRoundBody('getRoundActive');
    detail.slots = [
      { index: 1, topic: 'arrays', difficulty: 'easy', opened: false, solved: false, runCount: 0, submitCount: 0 },
      { index: 2, topic: 'strings', difficulty: 'medium', opened: true, solved: false, runCount: 0, submitCount: 0 },
      { index: 3, topic: 'math', difficulty: 'hard', opened: true, solved: false, runCount: 2, submitCount: 0 },
      { index: 4, topic: 'hashing', difficulty: 'easy', opened: true, solved: true, runCount: 1, submitCount: 1 },
    ];
    await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => !path.endsWith(real.getRoundActive.body.id)),
      route(`/api/assessments/${detail.id}`, detail),
    ]);
    const card = await screen.findByRole('region', { name: 'Active round' });
    const items = await within(card).findAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Q1 · Arrays · EasyNot opened',
      'Q2 · Strings · MediumOpened',
      'Q3 · Math · HardAttempted',
      'Q4 · Hashing · EasySolved',
    ]);
  });

  it('is not shown when there is no ACTIVE round, and E8 is not called', async () => {
    const { fetchMock } = await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => path !== LIST.active),
      route(LIST.active, listBody([], 0)),
    ]);
    await waitFor(() => expect(stat('active')).toHaveTextContent('0'));
    expect(screen.queryByRole('region', { name: 'Active round' })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, `/api/assessments/${real.getRoundActive.body.id}`)).toHaveLength(0);
  });

  describe('countdown (FR11 to FR14)', () => {
    const SERVER_NOW = new Date(2026, 10, 12, 10, 0, 0);
    const activeBody = (remainingMs) =>
      json(200, {
        ...realRoundBody('getRoundActive'),
        serverTime: SERVER_NOW.toISOString(),
        deadline: new Date(SERVER_NOW.getTime() + remainingMs).toISOString(),
      });
    const withClock = (laptopSkewMs) => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(new Date(SERVER_NOW.getTime() + laptopSkewMs));
    };
    const routesWith = (body) => [
      ...REAL_ROUTES.filter(([, path]) => !path.endsWith(real.getRoundActive.body.id)),
      ['GET', `/api/assessments/${real.getRoundActive.body.id}`, () => body],
    ];
    const timer = async () => within(await screen.findByRole('region', { name: 'Active round' })).findByRole('timer', { name: 'Time left' });

    afterEach(() => vi.useRealTimers());

    it('shows the time left on the active round card', async () => {
      withClock(0);
      await openDashboard(routesWith(activeBody((38 * 60 + 24) * 1000)));
      expect(await timer()).toHaveTextContent('38:24');
    });

    it('matches the server even when the laptop clock is 10 minutes wrong', async () => {
      withClock(10 * 60 * 1000); // the laptop is 10 minutes ahead of the server
      await openDashboard(routesWith(activeBody((38 * 60 + 24) * 1000)));
      expect(await timer()).toHaveTextContent('38:24'); // not 28:24
    });

    it('matches the server when the laptop clock is 10 minutes behind', async () => {
      withClock(-10 * 60 * 1000);
      await openDashboard(routesWith(activeBody((38 * 60 + 24) * 1000)));
      expect(await timer()).toHaveTextContent('38:24'); // not 48:24
    });

    it('counts down once per second', async () => {
      withClock(0);
      await openDashboard(routesWith(activeBody(90 * 1000)));
      const el = await timer();
      expect(el).toHaveTextContent('01:30');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(el).toHaveTextContent('01:27');
    });

    it('uses H:MM:SS over an hour', async () => {
      withClock(0);
      await openDashboard(routesWith(activeBody((62 * 60 + 5) * 1000)));
      expect(await timer()).toHaveTextContent('1:02:05');
    });

    it('turns amber under 5 minutes, and not before', async () => {
      withClock(0);
      await openDashboard(routesWith(activeBody(5 * 60 * 1000 + 5000)));
      const el = await timer();
      expect(el).toHaveAttribute('data-warning', 'false');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(el).toHaveAttribute('data-warning', 'true');
    });

    it('never goes below 00:00', async () => {
      withClock(0);
      await openDashboard(routesWith(activeBody(2000)));
      const el = await timer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(el).toHaveTextContent('00:00');
    });
  });

  it('shows an error with Retry when E8 fails', async () => {
    let up = false;
    const id = real.getRoundActive.body.id;
    const { user } = await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => !path.endsWith(id)),
      ['GET', `/api/assessments/${id}`, () => (up ? realRound('getRoundActive') : apiError(500, 'INTERNAL_ERROR'))],
    ]);
    const card = await screen.findByRole('region', { name: 'Active round' });
    expect(await within(card).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    up = true;
    await user.click(within(card).getByRole('button', { name: 'Retry' }));
    await within(card).findByText(/^Started /);
  });

  it('shows a loading state while E8 is pending', async () => {
    const id = real.getRoundActive.body.id;
    let resolve;
    await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => !path.endsWith(id)),
      ['GET', `/api/assessments/${id}`, () => new Promise((r) => (resolve = r))],
    ]);
    expect(await screen.findByLabelText('Loading active round')).toBeInTheDocument();
    resolve(realRound('getRoundActive'));
    await screen.findByText(/^Started /);
  });
});

describe('S4 ready round card', () => {
  it('shows the newest READY round: created date and time, duration, and question count', async () => {
    await openDashboard();
    const card = await screen.findByRole('region', { name: 'Ready round' });
    const newest = real.listReadyLimit1.body.items[0];
    expect(within(card).getByText(formatDateTime(newest.createdAt))).toBeInTheDocument();
    expect(within(card).getByText(`${newest.durationMin} min`)).toBeInTheDocument();
    expect(within(card).getByText(newest.questionCount === 1 ? '1 question' : `${newest.questionCount} questions`)).toBeInTheDocument();
  });

  it('Start goes to the round details page, not straight into the round (FD6)', async () => {
    const { user, fetchMock } = await openDashboard();
    const card = await screen.findByRole('region', { name: 'Ready round' });
    const start = within(card).getByRole('link', { name: 'Start' });
    expect(start).toHaveAttribute('href', `/rounds/${real.listReadyLimit1.body.items[0].id}`);
    await user.click(start);
    expect(location()).toBe(`/rounds/${real.listReadyLimit1.body.items[0].id}`);
    await screen.findByTestId('screen-S7');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/start'))).toHaveLength(0);
  });

  it('is not shown when there is no READY round', async () => {
    await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => path !== LIST.ready),
      route(LIST.ready, listBody([], 0)),
    ]);
    await waitFor(() => expect(stat('ready')).toHaveTextContent('0'));
    expect(screen.queryByRole('region', { name: 'Ready round' })).not.toBeInTheDocument();
  });

  it('shows the error with Retry when its E7 call fails', async () => {
    let up = false;
    const { user } = await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => path !== LIST.ready),
      ['GET', LIST.ready, () => (up ? realRound('listReadyLimit1') : apiError(500, 'INTERNAL_ERROR'))],
    ]);
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    up = true;
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await screen.findByRole('region', { name: 'Ready round' });
  });
});

describe('S4 recent rounds', () => {
  it('shows up to 5 rounds with the columns Created, Duration, Questions, Solved, Status and Ended', async () => {
    await openDashboard();
    const section = screen.getByRole('region', { name: 'Recent rounds' });
    await within(section).findAllByTestId('round-row');
    expect(within(section).getAllByTestId('round-row')).toHaveLength(5);
    const headers = within(section).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.slice(0, 6)).toEqual(['Created', 'Duration', 'Questions', 'Solved', 'Status', 'Ended']);
  });

  it('has a link to My rounds', async () => {
    const { user } = await openDashboard();
    const section = screen.getByRole('region', { name: 'Recent rounds' });
    await user.click(within(section).getByRole('link', { name: 'View all rounds' }));
    expect(location()).toBe('/rounds');
    await screen.findByTestId('screen-S6');
  });

  it('has Start, Resume and View report actions but no Delete (Delete lives in S6 and S7)', async () => {
    await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => path !== LIST.recent),
      route(LIST.recent, {
        items: [
          { ...real.listRecent.body.items[0] },
          { ...real.listRecent.body.items[0], id: 'a1', status: 'ACTIVE' },
          { ...real.listRecent.body.items[0], id: 'f1', status: 'FINISHED', finishReason: 'MANUAL' },
        ],
        page: 1,
        limit: 5,
        total: 14,
      }),
    ]);
    const section = screen.getByRole('region', { name: 'Recent rounds' });
    await within(section).findAllByTestId('round-row');
    expect(within(section).getAllByRole('link', { name: /^Start round/ })).toHaveLength(1);
    expect(within(section).getAllByRole('link', { name: /^Resume round/ })).toHaveLength(1);
    expect(within(section).getAllByRole('link', { name: /^View report/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('shows a loading state, an error with Retry, and recovers', async () => {
    let up = false;
    const { user } = await openDashboard([
      ...REAL_ROUTES.filter(([, path]) => path !== LIST.recent),
      ['GET', LIST.recent, () => (up ? realRound('listRecent') : apiError(500, 'INTERNAL_ERROR'))],
    ]);
    const section = screen.getByRole('region', { name: 'Recent rounds' });
    expect(await within(section).findByRole('alert')).toBeInTheDocument();
    up = true;
    await user.click(within(section).getByRole('button', { name: 'Retry' }));
    await within(section).findAllByTestId('round-row');
  });
});

describe('S4 empty state: no rounds at all', () => {
  const EMPTY = [
    route(LIST.all, listBody([], 0)),
    route(LIST.ready, listBody([], 0)),
    route(LIST.active, listBody([], 0)),
    route(LIST.finished, listBody([], 0)),
    route(LIST.recent, listBody([], 0)),
  ];

  it('shows "You have not created a round yet" with a Create round button', async () => {
    await openDashboard(EMPTY);
    const section = screen.getByRole('region', { name: 'Recent rounds' });
    expect(await within(section).findByText('You have not created a round yet')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Create round' })).toHaveAttribute('href', '/rounds/new');
  });

  it('shows zero in every stat and no active or ready card', async () => {
    await openDashboard(EMPTY);
    await waitFor(() => expect(stat('finished')).toHaveTextContent('0'));
    expect([stat('rounds'), stat('ready'), stat('active'), stat('finished')].map((e) => e.textContent)).toEqual(['0', '0', '0', '0']);
    expect(screen.queryByRole('region', { name: 'Active round' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ready round' })).not.toBeInTheDocument();
  });

  it('uses the default empty list when the user has nothing', async () => {
    const { fetchMock } = await openDashboard([]);
    await waitFor(() => expect(stat('rounds')).toHaveTextContent('0'));
    expect(emptyList().total).toBe(0);
    expect(callsTo(fetchMock, '/api/assessments').length).toBeGreaterThanOrEqual(5);
  });
});

describe('S4 removed from the design', () => {
  it('does not show the total solved, the PRO PLAN card, the role text, Performance, IDs or the auto-save line', async () => {
    await openDashboard();
    await screen.findByRole('region', { name: 'Active round' });
    await screen.findAllByTestId('round-row');
    const text = document.body.textContent;
    expect(text).not.toMatch(/pro plan|candidate|performance|auto-?save|tests passed|solve rate|total solved/i);
    expect(text).not.toMatch(/\d+(\.\d+)?\s*%/);
    expect(text).not.toMatch(/#OA-|Round #/);
    for (const { id } of real.listRecent.body.items) expect(text).not.toContain(id);
  });
});
