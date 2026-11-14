import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ME, json, mockFetch, renderApp, storeSession, stubApiBase } from '../test/helpers';

beforeEach(() => {
  stubApiBase();
  mockFetch(() => json(200, { user: ME }));
});

const location = () => screen.getByTestId('location').textContent;
const UNKNOWN = ['/no/such/page', '/rounds/abc/unknown', '/dashboard/extra'];

describe('not-found page for an unknown address', () => {
  it.each(UNKNOWN)('%s shows it and keeps the address', async (path) => {
    renderApp(path);
    const page = await screen.findByTestId('screen-not-found');
    expect(page).toHaveTextContent('Page not found');
    expect(page).toHaveTextContent('There is nothing at this address.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
    expect(location()).toBe(path);
  });

  it('a visitor is offered the home page, and it opens the landing page', async () => {
    const user = userEvent.setup();
    renderApp('/nothing-here');
    await user.click(await screen.findByRole('link', { name: 'Go home' }));
    expect(await screen.findByTestId('screen-S1')).toBeInTheDocument();
    expect(location()).toBe('/');
    expect(screen.queryByRole('link', { name: 'Back to My rounds' })).not.toBeInTheDocument();
  });

  it('a logged-in user is offered My rounds, and it opens that list', async () => {
    storeSession();
    const user = userEvent.setup();
    renderApp('/nothing-here');
    await user.click(await screen.findByRole('link', { name: 'Back to My rounds' }));
    expect(await screen.findByTestId('screen-S6')).toBeInTheDocument();
    expect(location()).toBe('/rounds');
    expect(screen.queryByRole('link', { name: 'Go home' })).not.toBeInTheDocument();
  });

  it('the logo links to the right start page for each kind of user', async () => {
    renderApp('/nothing-here');
    expect(await screen.findByRole('link', { name: /OA Simulator/ })).toHaveAttribute('href', '/');
  });

  it('shows the logo link to the dashboard for a logged-in user', async () => {
    storeSession();
    renderApp('/nothing-here');
    expect(await screen.findByRole('link', { name: /OA Simulator/ })).toHaveAttribute('href', '/dashboard');
  });

  it('calls no endpoint other than the start-up check, and shows no round id', async () => {
    storeSession();
    const fetchMock = mockFetch(() => json(200, { user: ME }));
    renderApp('/rounds/abc123/unknown');
    const page = await screen.findByTestId('screen-not-found');
    expect(page).not.toHaveTextContent('abc123');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['http://api.test/api/auth/me']);
  });
});
