import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ME, apiError, callsTo, fill, json, mockApi, mockFetch, realResponse, renderApp, roundSummary, stubApiBase } from '../test/helpers';

beforeEach(() => stubApiBase());

const location = () => screen.getByTestId('location').textContent;
const submitButton = () => screen.getByRole('button', { name: /^Sign in|Signing in/ });

async function openLogin(path = '/login') {
  const user = userEvent.setup();
  renderApp(path);
  await screen.findByTestId('screen-S2');
  return user;
}

describe('S2 on load', () => {
  it('shows no banner, and no field is pre-filled', async () => {
    mockFetch(() => json(200, {}));
    await openLogin();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('makes no network call on load', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    await openLogin();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an email field, a password field, a Sign in button and a link to Create account', async () => {
    mockFetch(() => json(200, {}));
    await openLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(submitButton()).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
  });

  it('does not show the features the spec removes', async () => {
    mockFetch(() => json(200, {}));
    await openLogin();
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remember/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/student email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/social/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('the show/hide toggle switches the password between hidden and visible', async () => {
    mockFetch(() => json(200, {}));
    const user = await openLogin();
    const password = screen.getByLabelText('Password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});

describe('S2 browser checks', () => {
  it('blocks an empty submit with field messages and no network call', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openLogin();
    await user.click(submitButton());
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a badly formatted email', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openLogin();
    await fill(user, 'Email', 'not-an-email');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears a field message when the user edits that field', async () => {
    mockFetch(() => json(200, {}));
    const user = await openLogin();
    await user.click(submitButton());
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'a');
    expect(screen.queryByText('Enter your email.')).not.toBeInTheDocument();
  });
});

describe('S2 sign in', () => {
  it('sends E3 with the email and password and no Authorization header, stores the session, and goes to /dashboard', async () => {
    const fetchMock = mockFetch((url) =>
      url.endsWith('/api/auth/login') ? realResponse('loginOk') : json(200, { user: ME }),
    );
    const user = await openLogin();
    await fill(user, 'Email', '  alex@example.com ');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    await screen.findByTestId('screen-S4');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'alex@example.com', password: 'correct-horse' });
    expect(init.headers.Authorization).toBeUndefined();
    expect(localStorage.getItem('oa.token')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('oa.user'))).toHaveProperty('email');
    expect(location()).toBe('/dashboard');
  });

  it('goes back to returnTo after a successful login', async () => {
    mockApi([
      ['POST', '/api/auth/login', () => realResponse('loginOk')],
      ['GET', '/api/assessments/abc', () => json(200, roundSummary('abc', 'FINISHED'))],
    ]);
    const user = await openLogin('/login?returnTo=%2Frounds%2Fabc%2Freport');
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    await screen.findByTestId('screen-S10');
    expect(location()).toBe('/rounds/abc/report');
  });

  it('ignores a returnTo that points off this site', async () => {
    mockFetch(() => realResponse('loginOk'));
    const user = await openLogin('/login?returnTo=%2F%2Fevil.example');
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    await screen.findByTestId('screen-S4');
    expect(location()).toBe('/dashboard');
  });

  it('Enter submits the form', async () => {
    const fetchMock = mockApi([['POST', '/api/auth/login', () => realResponse('loginOk')]]);
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.keyboard('{Enter}');
    await screen.findByTestId('screen-S4');
    expect(callsTo(fetchMock, '/api/auth/login')).toHaveLength(1);
  });

  it('shows a loading state and sends only one request when clicked twice', async () => {
    let resolve;
    const fetchMock = mockFetch(() => new Promise((r) => (resolve = r)));
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    const busy = screen.getByRole('button', { name: 'Signing in…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    await user.keyboard('{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(realResponse('loginOk'));
    await screen.findByTestId('screen-S4');
  });
});

describe('S2 errors (real backend responses)', () => {
  const BANNER = 'Email or password is incorrect.';

  it.each([
    ['a wrong password', 'loginWrongPassword'],
    ['an unknown email', 'loginUnknownEmail'],
  ])('INVALID_CREDENTIALS for %s shows the same banner and clears the password', async (_name, key) => {
    mockFetch(() => realResponse(key));
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'wrong-password');
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(BANNER);
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('alex@example.com');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(localStorage.getItem('oa.token')).toBeNull();
    expect(location()).toBe('/login');
  });

  it('VALIDATION_ERROR shows each message under its field and no banner', async () => {
    mockFetch(() => realResponse('loginValidationBad'));
    const user = await openLogin();
    await fill(user, 'Email', 'a@b.co');
    await fill(user, 'Password', 'short');
    await user.click(submitButton());
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    await waitFor(() => expect(email).toHaveAccessibleDescription('Invalid email'));
    expect(password).toHaveAccessibleDescription('Must be 8 to 72 bytes long');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('VALIDATION_ERROR that names no known field shows a banner', async () => {
    mockFetch(() => apiError(400, 'VALIDATION_ERROR', 'Invalid input'));
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid input');
  });

  it('TOO_MANY_REQUESTS shows a banner with the wait time from Retry-After', async () => {
    mockFetch(() => realResponse('tooManyRequests'));
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Try again in 60 seconds.');
  });

  it('NETWORK_ERROR shows a banner with Retry, and Retry sends the same form again', async () => {
    let up = false;
    const fetchMock = mockApi([
      [
        'POST',
        '/api/auth/login',
        () => {
          if (!up) throw new TypeError('Failed to fetch');
          return realResponse('loginOk');
        },
      ],
    ]);
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(screen.getByLabelText('Password')).toHaveValue('correct-horse');
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S4');
    const loginCalls = callsTo(fetchMock, '/api/auth/login');
    expect(loginCalls).toHaveLength(2);
    expect(JSON.parse(loginCalls[1][1].body)).toEqual({ email: 'alex@example.com', password: 'correct-horse' });
  });

  it('INTERNAL_ERROR shows a banner with Retry', async () => {
    mockFetch(() => apiError(500, 'INTERNAL_ERROR', 'Something went wrong'));
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'correct-horse');
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('a new submit removes the old banner', async () => {
    let first = true;
    mockFetch(() => {
      if (first) {
        first = false;
        return realResponse('loginWrongPassword');
      }
      return new Promise(() => {}); // stays pending
    });
    const user = await openLogin();
    await fill(user, 'Email', 'alex@example.com');
    await fill(user, 'Password', 'wrong-password');
    await user.click(submitButton());
    await screen.findByRole('alert');
    await fill(user, 'Password', 'another-password');
    await user.click(submitButton());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
