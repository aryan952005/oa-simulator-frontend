import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatDateTime } from '../lib/format';
import real from '../test/fixtures/real-rounds-responses.json';
import { apiError, callsTo, json, mockApi, realRound, renderApp, storeSession, stubApiBase } from '../test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession();
});

const location = () => screen.getByTestId('location').textContent;

const item = (n, overrides = {}) => ({
  id: `round-${n}`,
  status: 'READY',
  durationMin: 30,
  questionCount: 2,
  solvedCount: 0,
  createdAt: new Date(2026, 10, 11, 10, n).toISOString(),
  startedAt: null,
  finishedAt: null,
  finishReason: null,
  ...overrides,
});
const listBody = (items, { total = items.length, page = 1, limit = 10 } = {}) => ({ items, page, limit, total });
const listRoute = (query, handler) => ['GET', `/api/assessments?${query}`, typeof handler === 'string' ? handler : () => json(200, handler)];
const deleteCalls = (fetchMock) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');

// The real backend answers for a user with 14 rounds: 12 READY, 1 ACTIVE and 1 FINISHED.
const REAL_ROUTES = [
  listRoute('page=1&limit=10', 'listAllPage1'),
  listRoute('page=2&limit=10', 'listAllPage2'),
  listRoute('status=READY&page=1&limit=10', 'listReadyPage1'),
  listRoute('status=FINISHED&page=1&limit=10', 'listFinishedPage1'),
];

const rows = () => screen.getAllByTestId('round-row');
const pill = (name) => within(screen.getByRole('group', { name: 'Filter rounds' })).getByRole('button', { name });
const range = () => screen.getByTestId('range').textContent;
const pageOf = () => screen.getByTestId('page-of').textContent;

async function openRounds(routes = REAL_ROUTES) {
  const user = userEvent.setup();
  const fetchMock = mockApi(routes);
  renderApp('/rounds');
  await screen.findByTestId('screen-S6');
  return { user, fetchMock };
}

describe('S6 table (real backend response)', () => {
  it('shows the columns Created, Duration, Questions, Solved, Status, Ended and Actions', async () => {
    await openRounds();
    await screen.findAllByTestId('round-row');
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Created', 'Duration', 'Questions', 'Solved', 'Status', 'Ended', 'Actions']);
  });

  it('page 1 shows 10 of the 14 rounds, with the range and the page count', async () => {
    await openRounds();
    await screen.findAllByTestId('round-row');
    expect(rows()).toHaveLength(10);
    expect(range()).toBe('Showing 1–10 of 14');
    expect(pageOf()).toBe('Page 1 of 2');
  });

  it('names a round by its date and time, never by its ID (FR18)', async () => {
    await openRounds();
    await screen.findAllByTestId('round-row');
    const ids = [...real.listAllPage1.body.items, ...real.listAllPage2.body.items].map((r) => r.id);
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join('\n');
    for (const id of ids) {
      // The id appears only inside link addresses (href), never as visible text or in an accessible label.
      expect(document.body.textContent).not.toContain(id);
      expect(labels).not.toContain(id);
    }
  });

  it('shows the created time, the duration, the question count and Solved as "n of m"', async () => {
    await openRounds();
    await screen.findAllByTestId('round-row');
    const first = real.listAllPage1.body.items[0];
    const cells = within(rows()[0]).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[0]).toBe(formatDateTime(first.createdAt));
    expect(cells[1]).toBe(`${first.durationMin} min`);
    expect(cells[2]).toBe(String(first.questionCount));
    expect(cells[3]).toBe(`${first.solvedCount} of ${first.questionCount}`);
  });

  it('shows each status with its action: Start and Delete, Resume, View report', async () => {
    const { user } = await openRounds();
    await screen.findAllByTestId('round-row');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(rows()).toHaveLength(4));
    const items = real.listAllPage2.body.items;
    expect(items.map((r) => r.status)).toEqual(['READY', 'READY', 'ACTIVE', 'FINISHED']);

    const ready = rows()[0];
    expect(within(ready).getByText('Ready')).toBeInTheDocument();
    expect(within(ready).getByRole('link', { name: /^Start round/ })).toHaveAttribute('href', `/rounds/${items[0].id}`);
    expect(within(ready).getByRole('button', { name: /^Delete round/ })).toBeInTheDocument();
    expect(within(ready).getAllByRole('cell')[5]).toHaveTextContent('—');

    const active = rows()[2];
    expect(within(active).getByText('Active')).toBeInTheDocument();
    expect(within(active).getByRole('link', { name: /^Resume round/ })).toHaveAttribute('href', `/rounds/${items[2].id}/workspace`);
    expect(within(active).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(within(active).getAllByRole('cell')[5]).toHaveTextContent('—');

    const finished = rows()[3];
    expect(within(finished).getByText('Finished')).toBeInTheDocument();
    expect(within(finished).getByRole('link', { name: /^View report/ })).toHaveAttribute('href', `/rounds/${items[3].id}/report`);
    expect(within(finished).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(within(finished).getAllByRole('cell')[5]).toHaveTextContent('Finished by you');
    expect(within(finished).getAllByRole('cell')[1]).toHaveTextContent('62 min');
  });

  it('shows Time ran out for a round that expired', async () => {
    await openRounds([
      listRoute('page=1&limit=10', listBody([item(1, { status: 'FINISHED', finishReason: 'EXPIRED', solvedCount: 1 })])),
    ]);
    await screen.findAllByTestId('round-row');
    expect(within(rows()[0]).getAllByRole('cell')[5]).toHaveTextContent('Time ran out');
    expect(within(rows()[0]).getAllByRole('cell')[3]).toHaveTextContent('1 of 2');
  });

  it('shows a loading state first, then the rows', async () => {
    let resolve;
    mockApi([['GET', '/api/assessments?page=1&limit=10', () => new Promise((r) => (resolve = r))]]);
    renderApp('/rounds');
    expect(await screen.findByLabelText('Loading rounds')).toBeInTheDocument();
    resolve(realRound('listAllPage1'));
    await screen.findAllByTestId('round-row');
    expect(screen.queryByLabelText('Loading rounds')).not.toBeInTheDocument();
  });

  it('does not show what the spec removes: search, sort, topic chips, round numbers, remaining time', async () => {
    await openRounds();
    await screen.findAllByTestId('round-row');
    const text = document.body.textContent;
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(text).not.toMatch(/sort|search|remaining|success rate|round #|schedule new|archival/i);
    expect(text).not.toMatch(/\d+\s*%/);
  });
});

describe('S6 filters', () => {
  it('has the pills All, Ready, Active and Finished, with All selected at first', async () => {
    await openRounds();
    expect(['All', 'Ready', 'Active', 'Finished'].map((n) => pill(n).textContent)).toEqual(['All', 'Ready', 'Active', 'Finished']);
    expect(pill('All')).toHaveAttribute('aria-pressed', 'true');
    expect(pill('Ready')).toHaveAttribute('aria-pressed', 'false');
  });

  it('All sends no status parameter', async () => {
    const { fetchMock } = await openRounds();
    await screen.findAllByTestId('round-row');
    expect(callsTo(fetchMock, '/api/assessments')[0][0]).toBe('http://api.test/api/assessments?page=1&limit=10');
  });

  it('Ready sets status=READY and shows the READY rounds', async () => {
    const { user, fetchMock } = await openRounds();
    await screen.findAllByTestId('round-row');
    await user.click(pill('Ready'));
    await waitFor(() => expect(range()).toBe('Showing 1–10 of 12'));
    expect(callsTo(fetchMock, 'status=READY')[0][0]).toBe('http://api.test/api/assessments?status=READY&page=1&limit=10');
    expect(pill('Ready')).toHaveAttribute('aria-pressed', 'true');
    expect(pill('All')).toHaveAttribute('aria-pressed', 'false');
    expect(rows()).toHaveLength(10);
  });

  it('Finished sets status=FINISHED', async () => {
    const { user, fetchMock } = await openRounds();
    await screen.findAllByTestId('round-row');
    await user.click(pill('Finished'));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(callsTo(fetchMock, 'status=FINISHED')).toHaveLength(1);
    expect(range()).toBe('Showing 1–1 of 1');
  });

  it('changing the filter returns to page 1', async () => {
    const { user, fetchMock } = await openRounds();
    await screen.findAllByTestId('round-row');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(pageOf()).toBe('Page 2 of 2'));
    await user.click(pill('Ready'));
    await waitFor(() => expect(pageOf()).toBe('Page 1 of 2'));
    const urls = callsTo(fetchMock, '/api/assessments').map(([url]) => url);
    expect(urls).toContain('http://api.test/api/assessments?status=READY&page=1&limit=10');
    expect(urls).not.toContain('http://api.test/api/assessments?status=READY&page=2&limit=10');
  });

  it('All after a filter removes the status parameter again', async () => {
    const { user, fetchMock } = await openRounds();
    await screen.findAllByTestId('round-row');
    await user.click(pill('Ready'));
    await waitFor(() => expect(range()).toBe('Showing 1–10 of 12'));
    await user.click(pill('All'));
    await waitFor(() => expect(range()).toBe('Showing 1–10 of 14'));
    const urls = callsTo(fetchMock, '/api/assessments').map(([url]) => url);
    expect(urls.filter((u) => u === 'http://api.test/api/assessments?page=1&limit=10')).toHaveLength(2);
  });

  it('Active and Finished use the real counts', async () => {
    expect(real.listActiveLimit1.body.total).toBe(1);
    expect(real.listFinishedLimit1.body.total).toBe(1);
  });
});

describe('S6 paging', () => {
  it('Next and Previous move through the pages', async () => {
    const { user } = await openRounds();
    await screen.findAllByTestId('round-row');
    const next = screen.getByRole('button', { name: 'Next' });
    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    await user.click(next);
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(range()).toBe('Showing 11–14 of 14');
    expect(pageOf()).toBe('Page 2 of 2');
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();

    await user.click(previous);
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(pageOf()).toBe('Page 1 of 2');
  });

  it('sends page and limit (PAGE_SIZE) to E7', async () => {
    const { user, fetchMock } = await openRounds();
    await screen.findAllByTestId('round-row');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(rows()).toHaveLength(4));
    const urls = callsTo(fetchMock, '/api/assessments').map(([url]) => url);
    expect(urls).toContain('http://api.test/api/assessments?page=2&limit=10');
  });

  it.each([
    [0, 'Page 1 of 1'],
    [1, 'Page 1 of 1'],
    [10, 'Page 1 of 1'],
    [11, 'Page 1 of 2'],
    [25, 'Page 1 of 3'],
  ])('the page count is computed from total: %i rounds give "%s"', async (total, text) => {
    const items = Array.from({ length: Math.min(total, 10) }, (_, i) => item(i + 1));
    await openRounds([listRoute('page=1&limit=10', listBody(items, { total }))]);
    if (total === 0) {
      await screen.findByText('No rounds yet');
      expect(screen.queryByTestId('page-of')).not.toBeInTheDocument();
    } else {
      await screen.findAllByTestId('round-row');
      expect(pageOf()).toBe(text);
    }
  });

  it('Next is disabled on the last page when the total fills pages exactly', async () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1));
    await openRounds([listRoute('page=1&limit=10', listBody(items, { total: 10 }))]);
    await screen.findAllByTestId('round-row');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('S6 empty and error states', () => {
  it('no rounds at all shows "No rounds yet" with a Create round button', async () => {
    await openRounds([listRoute('page=1&limit=10', listBody([]))]);
    expect(await screen.findByText('No rounds yet')).toBeInTheDocument();
    expect(within(screen.getByTestId('screen-S6')).getByRole('link', { name: 'Create round' })).toHaveAttribute('href', '/rounds/new');
  });

  it.each([
    ['Ready', 'READY', 'No ready rounds'],
    ['Active', 'ACTIVE', 'No active rounds'],
    ['Finished', 'FINISHED', 'No finished rounds'],
  ])('no rounds for the %s filter (%s) shows "%s"', async (label, status, text) => {
    const { user } = await openRounds([
      listRoute('page=1&limit=10', listBody([item(1)])),
      listRoute(`status=${status}&page=1&limit=10`, listBody([])),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(pill(label));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(within(screen.getByTestId('screen-S6')).queryByRole('link', { name: 'Create round' })).not.toBeInTheDocument();
  });

  it('shows the error with Retry, and Retry loads the rounds', async () => {
    let up = false;
    const fetchMock = mockApi([
      ['GET', '/api/assessments?page=1&limit=10', () => (up ? realRound('listAllPage1') : apiError(500, 'INTERNAL_ERROR'))],
    ]);
    const user = userEvent.setup();
    renderApp('/rounds');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findAllByTestId('round-row');
    expect(callsTo(fetchMock, '/api/assessments?page=1')).toHaveLength(2);
  });

  it('a network failure shows the network banner with Retry', async () => {
    mockApi([
      [
        'GET',
        '/api/assessments?page=1&limit=10',
        () => {
          throw new TypeError('Failed to fetch');
        },
      ],
    ]);
    renderApp('/rounds');
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
  });
});

describe('S6 Delete', () => {
  const twoReady = listBody([item(1), item(2)]);
  const oneReady = listBody([item(2)]);
  const deleteRoute = (id, handler) => ['DELETE', `/api/assessments/${id}`, handler];
  const noContent = () => new Response(null, { status: 204 });
  const deleteButtons = () => screen.getAllByRole('button', { name: /^Delete round/ });

  it('asks first, and Cancel makes no call', async () => {
    const { user, fetchMock } = await openRounds([listRoute('page=1&limit=10', twoReady)]);
    await screen.findAllByTestId('round-row');
    await user.click(deleteButtons()[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this round? This cannot be undone.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteCalls(fetchMock)).toHaveLength(0);
    expect(rows()).toHaveLength(2);
  });

  it('Escape also cancels', async () => {
    const { user, fetchMock } = await openRounds([listRoute('page=1&limit=10', twoReady)]);
    await screen.findAllByTestId('round-row');
    await user.click(deleteButtons()[0]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('removes the row only after E9 returns 204', async () => {
    let finishDelete;
    let listCalls = 0;
    const { user, fetchMock } = await openRounds([
      ['GET', '/api/assessments?page=1&limit=10', () => json(200, listCalls++ === 0 ? twoReady : oneReady)],
      deleteRoute('round-1', () => new Promise((r) => (finishDelete = r))),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(deleteButtons()[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    // The request is in flight: the row is still there and the dialog shows progress.
    await waitFor(() => expect(deleteCalls(fetchMock)).toHaveLength(1));
    expect(deleteCalls(fetchMock)[0][0]).toBe('http://api.test/api/assessments/round-1');
    expect(rows()).toHaveLength(2);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deleting…' })).toBeDisabled();

    finishDelete(noContent());
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Round deleted.');
    await waitFor(() => expect(range()).toBe('Showing 1–1 of 1'));
  });

  it('keeps the row when the delete fails with a network error, and Retry deletes it', async () => {
    let up = false;
    const { user, fetchMock } = await openRounds([
      listRoute('page=1&limit=10', twoReady),
      deleteRoute('round-1', () => {
        if (!up) throw new TypeError('Failed to fetch');
        return noContent();
      }),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(deleteButtons()[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(rows()).toHaveLength(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(deleteCalls(fetchMock)).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ROUND_NOT_READY (real response): no confirmation, and the list is loaded again', async () => {
    let listCalls = 0;
    const started = listBody([item(1, { status: 'ACTIVE', startedAt: new Date().toISOString() }), item(2)]);
    const { user } = await openRounds([
      ['GET', '/api/assessments?page=1&limit=10', () => json(200, listCalls++ === 0 ? twoReady : started)],
      deleteRoute('round-1', () => realRound('deleteNotReady')),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(deleteButtons()[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(within(rows()[0]).getByText('Active')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(2);
  });

  it('NOT_FOUND (real response): the list is loaded again without the round', async () => {
    let listCalls = 0;
    const { user } = await openRounds([
      ['GET', '/api/assessments?page=1&limit=10', () => json(200, listCalls++ === 0 ? twoReady : oneReady)],
      deleteRoute('round-1', () => realRound('deleteNotFound')),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(deleteButtons()[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('after the last round of a later page is deleted, goes back one page', async () => {
    const page2 = listBody([item(11)], { total: 11, page: 2 });
    const page1 = listBody(Array.from({ length: 10 }, (_, i) => item(i + 1)), { total: 11 });
    const page1After = listBody(Array.from({ length: 10 }, (_, i) => item(i + 1)), { total: 10 });
    let page1Calls = 0;
    const { user, fetchMock } = await openRounds([
      ['GET', '/api/assessments?page=1&limit=10', () => json(200, page1Calls++ === 0 ? page1 : page1After)],
      listRoute('page=2&limit=10', page2),
      deleteRoute('round-11', noContent),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(pageOf()).toBe('Page 2 of 2'));
    await user.click(deleteButtons()[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(pageOf()).toBe('Page 1 of 1'));
    expect(deleteCalls(fetchMock)).toHaveLength(1);
    expect(rows()).toHaveLength(10);
  });

  it('only READY rows can be deleted', async () => {
    await openRounds([
      listRoute(
        'page=1&limit=10',
        listBody([item(1), item(2, { status: 'ACTIVE' }), item(3, { status: 'FINISHED', finishReason: 'MANUAL' })]),
      ),
    ]);
    await screen.findAllByTestId('round-row');
    expect(screen.getAllByRole('button', { name: /^Delete round/ })).toHaveLength(1);
  });

  it('sends the user to the right place from each action', async () => {
    const { user } = await openRounds([
      listRoute('page=1&limit=10', listBody([item(1), item(2, { status: 'ACTIVE' }), item(3, { status: 'FINISHED', finishReason: 'EXPIRED' })])),
    ]);
    await screen.findAllByTestId('round-row');
    await user.click(within(rows()[0]).getByRole('link', { name: /^Start/ }));
    expect(location()).toBe('/rounds/round-1');
  });
});
