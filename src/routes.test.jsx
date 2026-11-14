import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ME, json, mockApi, mockFetch, renderApp, roundSummary, storeSession, stubApiBase } from './test/helpers';

beforeEach(() => stubApiBase());

const location = () => screen.getByTestId('location').textContent;

const PROTECTED = [
  ['/dashboard', 'S4'],
  ['/rounds/new', 'S5'],
  ['/rounds', 'S6'],
  ['/rounds/abc123', 'S7'],
  ['/rounds/abc123/workspace', 'S8'],
  ['/rounds/abc123/report', 'S10'],
];

// The status E8 must report for a round route to show its own screen (FR15).
const ROUND_STATUS = { S7: 'READY', S8: 'ACTIVE', S10: 'FINISHED' };
const roundRoute = (status) => ['GET', '/api/assessments/abc123', () => json(200, roundSummary('abc123', status))];

const PUBLIC = [
  ['/', 'S1'],
  ['/login', 'S2'],
  ['/register', 'S3'],
];

describe('every route shows its screen (section 2)', () => {
  it.each(PROTECTED)('logged in: %s shows %s', async (path, screenId) => {
    storeSession();
    mockApi(ROUND_STATUS[screenId] ? [roundRoute(ROUND_STATUS[screenId])] : []);
    renderApp(path);
    expect(await screen.findByTestId(`screen-${screenId}`)).toBeInTheDocument();
    expect(location()).toBe(path);
  });

  it.each(PUBLIC)('logged out: %s shows %s', async (path, screenId) => {
    mockFetch(() => json(200, {}));
    renderApp(path);
    expect(await screen.findByTestId(`screen-${screenId}`)).toBeInTheDocument();
    expect(location()).toBe(path);
  });

  it.each([false, true])('anything else shows the not-found page (logged in: %s)', async (loggedIn) => {
    if (loggedIn) storeSession();
    mockFetch(() => json(200, { user: ME }));
    renderApp('/no/such/page');
    expect(await screen.findByTestId('screen-not-found')).toBeInTheDocument();
    expect(location()).toBe('/no/such/page');
  });

  it('never displays a round id (FR18)', async () => {
    storeSession();
    mockApi([roundRoute('READY')]);
    renderApp('/rounds/abc123');
    const page = await screen.findByTestId('screen-S7');
    expect(page).not.toHaveTextContent('abc123');
    expect(screen.getByLabelText('Sidebar')).not.toHaveTextContent('abc123');
  });
});

describe('FR23: a logged-out user on a protected route goes to /login with returnTo', () => {
  it.each(PROTECTED)('%s', async (path) => {
    const fetchMock = mockFetch(() => json(200, {}));
    renderApp(path);
    expect(await screen.findByTestId('screen-S2')).toBeInTheDocument();
    expect(location()).toBe(`/login?returnTo=${encodeURIComponent(path)}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FR24: a logged-in user on /, /login or /register goes to /dashboard', () => {
  it.each(['/', '/login', '/register'])('%s', async (path) => {
    storeSession();
    mockFetch(() => json(200, { user: ME }));
    renderApp(path);
    expect(await screen.findByTestId('screen-S4')).toBeInTheDocument();
    expect(location()).toBe('/dashboard');
  });
});

describe('app shell', () => {
  async function openShell(path = '/dashboard') {
    storeSession();
    mockFetch(() => json(200, { user: ME }));
    renderApp(path);
    await screen.findByLabelText('Sidebar');
  }

  it('has a sidebar with Dashboard, My rounds, Create round and Log out, and no Performance item', async () => {
    await openShell();
    const sidebar = screen.getByLabelText('Sidebar');
    expect(within(sidebar).getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/dashboard');
    expect(within(sidebar).getByRole('link', { name: /My rounds/ })).toHaveAttribute('href', '/rounds');
    expect(within(sidebar).getByRole('link', { name: /Create round/ })).toHaveAttribute('href', '/rounds/new');
    expect(within(sidebar).getByRole('button', { name: /Log out/ })).toBeInTheDocument();
    expect(within(sidebar).queryByText(/Performance/)).not.toBeInTheDocument();
  });

  it("has a top bar with the user's name and initials", async () => {
    await openShell();
    expect(screen.getByTestId('topbar-user-name')).toHaveTextContent('Alex Chen');
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('marks the current page in the sidebar', async () => {
    await openShell('/rounds/new');
    const sidebar = screen.getByLabelText('Sidebar');
    expect(within(sidebar).getByRole('link', { name: /Create round/ })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar).getByRole('link', { name: /My rounds/ })).not.toHaveAttribute('aria-current');
  });

  it('is not used on the workspace, which has its own header', async () => {
    storeSession();
    mockApi([roundRoute('ACTIVE')]);
    renderApp('/rounds/abc123/workspace');
    await screen.findByTestId('screen-S8');
    expect(screen.queryByLabelText('Sidebar')).not.toBeInTheDocument();
  });
});

describe('public header', () => {
  it('shows the logo, a Log in link and a Create account link on the landing page', async () => {
    mockFetch(() => json(200, {}));
    renderApp('/');
    await screen.findByTestId('screen-S1');
    const header = screen.getByRole('banner');
    expect(within(header).getByText('OA Simulator')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(within(header).getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
  });
});
