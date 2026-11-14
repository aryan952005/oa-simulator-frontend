// FR22 across the whole app: every screen that loads data has a loading, an error (with Retry) and, where
// it makes sense, an empty state, and a 404 shows the not-found view (FR1). The same checks run on every
// screen, so a screen that misses one shows up here. The per-screen files test the details.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import real from './test/fixtures/real-report-responses.json';
import { MIN, RID, roundBody } from './test/workspaceHarness';
import { ME, apiError, emptyList, json, mockApi, renderApp, roundSummary, storeSession, stubApiBase } from './test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession();
  window.innerWidth = 1280;
});

const NETWORK_TEXT = "Can't reach the server. Check your connection.";
const SERVER_TEXT = 'Something went wrong. Try again.';

// One data call with a mode that the test flips: pending, network failure, 500, 404, or fine.
function switchable() {
  const state = { mode: 'loading' };
  const answer = (ok) => () => {
    switch (state.mode) {
      case 'loading':
        return new Promise(() => {});
      case 'network':
        throw new TypeError('Failed to fetch');
      case 'server':
        return apiError(500, 'INTERNAL_ERROR');
      case 'notfound':
        return apiError(404, 'NOT_FOUND', 'Round not found');
      default:
        return ok();
    }
  };
  return { state, answer };
}

const LIST = /^\/api\/assessments(\?.*)?$/;
const FINISHED_REPORT = real.excellent;

// Each screen: how to open it, which data call to switch, how loading looks, and what shows once it works.
const SCREENS = [
  {
    name: 'S4 Dashboard',
    path: '/dashboard',
    calls: (a) => [['GET', LIST, a(() => json(200, emptyList()))]],
    loading: () => screen.findByLabelText('Loading rounds'),
    done: () => screen.findByText('You have not created a round yet'),
    empty: 'You have not created a round yet',
  },
  {
    name: 'S5 Create round',
    path: '/rounds/new',
    calls: (a) => [['GET', '/api/topics', a(() => json(200, { topics: [] }))]],
    loading: () => screen.findByLabelText('Loading topics'),
    done: () => screen.findByText('No questions are available yet'),
    empty: 'No questions are available yet',
  },
  {
    name: 'S6 My rounds',
    path: '/rounds',
    calls: (a) => [['GET', LIST, a(() => json(200, emptyList()))]],
    loading: () => screen.findByLabelText('Loading rounds'),
    done: () => screen.findByText('No rounds yet'),
    empty: 'No rounds yet',
  },
  {
    name: 'S7 Round details (E8)',
    path: '/rounds/r1',
    calls: (a) => [['GET', '/api/assessments/r1', a(() => json(200, roundSummary('r1', 'READY')))]],
    loading: () => screen.findByLabelText('Loading round'),
    done: () => screen.findByTestId('screen-S7'),
    notFound: true,
  },
  {
    name: 'S8 Workspace (E8)',
    path: `/rounds/${RID}/workspace`,
    calls: (a) => [['GET', `/api/assessments/${RID}`, a(() => json(200, roundBody({ remainingMs: 30 * MIN })))]],
    loading: () => screen.findByLabelText('Loading round'),
    done: () => screen.findByTestId('screen-S8'),
    notFound: true,
  },
  {
    name: 'S10 Report, the round (E8)',
    path: '/rounds/r1/report',
    calls: (a) => [
      ['GET', '/api/assessments/r1', a(() => json(200, roundSummary('r1', 'FINISHED')))],
      ['GET', '/api/assessments/r1/report', () => json(200, FINISHED_REPORT.report.body)],
    ],
    loading: () => screen.findByLabelText('Loading round'),
    done: () => screen.findByTestId('screen-S10'),
    notFound: true,
  },
  {
    name: 'S10 Report (E16)',
    path: '/rounds/r1/report',
    calls: (a) => [
      ['GET', '/api/assessments/r1', () => json(200, roundSummary('r1', 'FINISHED'))],
      ['GET', '/api/assessments/r1/report', a(() => json(200, FINISHED_REPORT.report.body))],
    ],
    loading: () => screen.findByLabelText('Loading report'),
    done: () => screen.findByTestId('grade-badge'),
    notFound: true,
  },
];

// Presses every Retry button on the screen until none is left (a screen may have several, one per card).
async function pressRetry(user) {
  for (let guard = 0; guard < 10; guard += 1) {
    const buttons = screen.queryAllByRole('button', { name: /^Retry/ });
    if (buttons.length === 0) return;
    await user.click(buttons[0]);
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Retry/ }).length).toBeLessThan(buttons.length));
  }
}

describe.each(SCREENS)('$name', (screenConfig) => {
  // Opens the screen with its data call in `mode` from the start.
  function open(mode) {
    const { state, answer } = switchable();
    state.mode = mode;
    mockApi(screenConfig.calls(answer));
    renderApp(screenConfig.path);
    return state;
  }

  it('shows a loading state while the data is on its way, and nothing else yet', async () => {
    open('loading');
    await screenConfig.loading();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    if (screenConfig.empty) expect(screen.queryByText(screenConfig.empty)).not.toBeInTheDocument();
  });

  it.each([
    ['network', NETWORK_TEXT],
    ['server', SERVER_TEXT],
  ])('a %s failure shows the message with Retry (never the empty state), and Retry recovers', async (mode, text) => {
    const user = userEvent.setup();
    const state = open(mode);
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent.includes(text))).toBe(true);
    expect(screen.getAllByRole('button', { name: /^Retry/ }).length).toBeGreaterThan(0);
    if (screenConfig.empty) expect(screen.queryByText(screenConfig.empty)).not.toBeInTheDocument();
    state.mode = 'ok';
    await pressRetry(user);
    await screenConfig.done();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  if (screenConfig.notFound) {
    it('a 404 shows the not-found view with a link back to My rounds (FR1)', async () => {
      const user = userEvent.setup();
      open('notfound');
      const view = await screen.findByTestId('round-not-found');
      expect(view).toHaveTextContent('Round not found');
      expect(screen.queryByRole('button', { name: /^Retry/ })).not.toBeInTheDocument();
      await user.click(within(view).getByRole('link', { name: 'Back to My rounds' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/rounds');
    });
  } else {
    it('has no not-found view (this screen is not about one round)', async () => {
      open('loading');
      await screenConfig.loading();
      expect(screen.queryByTestId('round-not-found')).not.toBeInTheDocument();
    });
  }

  if (screenConfig.empty) {
    it('shows its empty state once the data arrives with nothing in it', async () => {
      open('ok');
      expect(await screen.findByText(screenConfig.empty)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  }
});

describe('App start (E4, FR4)', () => {
  it('shows a skeleton while the stored token is checked', async () => {
    const { state, answer } = switchable();
    state.mode = 'loading';
    mockApi([['GET', '/api/auth/me', answer(() => json(200, { user: ME }))]]);
    renderApp('/dashboard');
    expect(await screen.findByTestId('startup-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['network', NETWORK_TEXT],
    ['server', SERVER_TEXT],
  ])('a %s failure shows the message with Retry, and Retry opens the app', async (mode, text) => {
    const user = userEvent.setup();
    const { state, answer } = switchable();
    state.mode = mode;
    mockApi([['GET', '/api/auth/me', answer(() => json(200, { user: ME }))]]);
    renderApp('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    state.mode = 'ok';
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('screen-S4')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});

// The empty states that are not a whole screen.
describe('empty parts of a screen', () => {
  it('S6: a filter with no rounds says so, without the "create" prompt of a user with no rounds at all', async () => {
    const user = userEvent.setup();
    mockApi([]);
    renderApp('/rounds');
    expect(await screen.findByText('No rounds yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finished' }));
    expect(await screen.findByText('No finished rounds')).toBeInTheDocument();
  });
});
