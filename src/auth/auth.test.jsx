import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { request } from '../api/client';
import { ME, apiError, callsTo, json, mockApi, mockFetch, renderApp, storeSession, stubApiBase } from '../test/helpers';
import { loginUrlFor } from './AuthContext';
import { initials } from './initials';

beforeEach(() => stubApiBase());

const location = () => screen.getByTestId('location').textContent;

describe('FR2: token and user storage keys', () => {
  it('E4 success keeps the token under oa.token and refreshes the user under oa.user', async () => {
    storeSession('tok', { id: 'u1', name: 'Old Name', email: 'alex@example.com' });
    mockFetch(() => json(200, { user: ME }));
    renderApp('/dashboard');
    await screen.findByTestId('screen-S4');
    expect(localStorage.getItem('oa.token')).toBe('tok');
    expect(JSON.parse(localStorage.getItem('oa.user'))).toEqual(ME);
  });

  it('signIn stores both keys', async () => {
    const { AuthProvider, useAuth } = await import('./AuthContext');
    const { MemoryRouter } = await import('react-router-dom');
    const { render } = await import('@testing-library/react');
    let api;
    function Grab() {
      api = useAuth();
      return null;
    }
    render(
      <MemoryRouter>
        <AuthProvider>
          <Grab />
        </AuthProvider>
      </MemoryRouter>,
    );
    act(() => api.signIn('new-token', ME));
    expect(localStorage.getItem('oa.token')).toBe('new-token');
    expect(JSON.parse(localStorage.getItem('oa.user'))).toEqual(ME);
  });
});

describe('FR4: validate a stored token with E4 on start', () => {
  it('calls GET /api/auth/me with the Bearer token and shows a skeleton while waiting', async () => {
    storeSession('tok');
    let resolve;
    const fetchMock = mockFetch(() => new Promise((r) => (resolve = r)));
    renderApp('/dashboard');
    expect(screen.getByTestId('startup-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-S4')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/auth/me');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
    await act(async () => resolve(json(200, { user: ME })));
    expect(await screen.findByTestId('screen-S4')).toBeInTheDocument();
    expect(screen.queryByTestId('startup-skeleton')).not.toBeInTheDocument();
  });

  it('makes no call when there is no token', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    renderApp('/login');
    await screen.findByTestId('screen-S2');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('on 401, clears the stored token and user and goes to /login', async () => {
    storeSession('expired');
    mockFetch(() => apiError(401, 'UNAUTHORIZED', 'Token expired'));
    renderApp('/dashboard');
    await screen.findByTestId('screen-S2');
    expect(localStorage.getItem('oa.token')).toBeNull();
    expect(localStorage.getItem('oa.user')).toBeNull();
    expect(location().startsWith('/login')).toBe(true);
  });

  it('on a network failure, keeps the token and shows the banner with Retry, then recovers', async () => {
    storeSession('tok');
    let up = false;
    mockFetch(() => {
      if (!up) throw new TypeError('Failed to fetch');
      return json(200, { user: ME });
    });
    renderApp('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(localStorage.getItem('oa.token')).toBe('tok');
    up = true;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('screen-S4')).toBeInTheDocument();
  });

  it('on a server error, shows the generic banner and keeps the token', async () => {
    storeSession('tok');
    mockFetch(() => apiError(500, 'INTERNAL_ERROR', 'boom'));
    renderApp('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(localStorage.getItem('oa.token')).toBe('tok');
  });
});

describe('FR5: any 401 UNAUTHORIZED clears the session and goes to /login with returnTo', () => {
  async function loggedInOn(path) {
    storeSession('tok');
    const fetchMock = mockFetch((url) => (url.endsWith('/api/auth/me') ? json(200, { user: ME }) : null));
    renderApp(path);
    await waitFor(() => expect(screen.queryByTestId('startup-skeleton')).not.toBeInTheDocument());
    return fetchMock;
  }

  it('after a 401 from a later call, returnTo holds the page the user was on', async () => {
    const fetchMock = await loggedInOn('/rounds');
    fetchMock.mockImplementation(async () => apiError(401, 'UNAUTHORIZED', 'Expired'));
    await act(async () => {
      await request('/api/assessments').catch(() => {});
    });
    await waitFor(() => expect(location()).toBe('/login?returnTo=%2Frounds'));
    expect(localStorage.getItem('oa.token')).toBeNull();
    expect(localStorage.getItem('oa.user')).toBeNull();
  });

  it('returnTo keeps the query string', async () => {
    const fetchMock = await loggedInOn('/rounds?page=2');
    fetchMock.mockImplementation(async () => apiError(401, 'UNAUTHORIZED', 'Expired'));
    await act(async () => {
      await request('/api/assessments?page=2').catch(() => {});
    });
    await waitFor(() => expect(location()).toBe('/login?returnTo=%2Frounds%3Fpage%3D2'));
  });

  it('INVALID_CREDENTIALS (also a 401) does not clear the session', async () => {
    const fetchMock = await loggedInOn('/dashboard');
    fetchMock.mockImplementation(async () => apiError(401, 'INVALID_CREDENTIALS', 'Nope'));
    await act(async () => {
      await request('/api/auth/login', { method: 'POST', body: {}, auth: false }).catch(() => {});
    });
    expect(localStorage.getItem('oa.token')).toBe('tok');
    expect(location()).toBe('/dashboard');
  });

  it('loginUrlFor never adds returnTo for a public path', () => {
    expect(loginUrlFor('/login', '')).toBe('/login');
    expect(loginUrlFor('/', '')).toBe('/login');
    expect(loginUrlFor('/rounds/abc/report', '')).toBe('/login?returnTo=%2Frounds%2Fabc%2Freport');
  });
});

describe('FR6: logout', () => {
  it('deletes oa.token and oa.user, goes to /login, and makes no server call', async () => {
    storeSession('tok');
    const fetchMock = mockApi();
    renderApp('/dashboard');
    await screen.findByTestId('screen-S4');
    expect(callsTo(fetchMock, '/api/auth/me')).toHaveLength(1); // E4 on start
    await waitFor(() => expect(screen.getByTestId('stat-rounds')).toBeInTheDocument()); // the dashboard has finished loading
    const callsBeforeLogout = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByTestId('screen-S2');
    expect(location()).toBe('/login');
    expect(localStorage.getItem('oa.token')).toBeNull();
    expect(localStorage.getItem('oa.user')).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(callsBeforeLogout); // logout made no server call
    expect(callsTo(fetchMock, 'logout')).toHaveLength(0);
  });

  it('after logout a protected route sends the user back to /login', async () => {
    storeSession('tok');
    mockFetch(() => json(200, { user: ME }));
    renderApp('/dashboard');
    await screen.findByTestId('screen-S4');
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByTestId('screen-S2');
    expect(screen.queryByTestId('screen-S4')).not.toBeInTheDocument();
  });
});

describe('initials (DESIGN.md decision 10)', () => {
  it.each([
    ['Alex Chen', 'AC'],
    ['alex', 'A'],
    ['  mary  jane  watson ', 'MW'],
    ['', '?'],
    [undefined, '?'],
  ])('%j gives %j', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
