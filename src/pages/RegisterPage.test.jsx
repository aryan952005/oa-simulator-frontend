import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiError, callsTo, fill, json, mockApi, mockFetch, realResponse, renderApp, stubApiBase } from '../test/helpers';

beforeEach(() => stubApiBase());

const location = () => screen.getByTestId('location').textContent;
const submitButton = () => screen.getByRole('button', { name: /^Create account|Creating account/ });

async function openRegister() {
  const user = userEvent.setup();
  renderApp('/register');
  await screen.findByTestId('screen-S3');
  return user;
}

async function fillValid(user, { password = 'correct-horse', confirmation = password } = {}) {
  await fill(user, 'Full name', '  Alex Chen ');
  await fill(user, 'Email', ' alex@example.com ');
  await fill(user, 'Password', password);
  await fill(user, 'Confirm password', confirmation);
}

// A checklist row is "met" when its hidden status text says so.
function rule(text) {
  const list = screen.getByRole('list', { name: 'Password rules' });
  return within(list).getByText(text).closest('li');
}
const isMet = (row) => row.textContent.includes('(met)') && !row.textContent.includes('(not met)');

describe('S3 on load', () => {
  it('shows no banner, and no field is pre-filled', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    await openRegister();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    for (const label of ['Full name', 'Email', 'Password', 'Confirm password']) {
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has a link to Log in', async () => {
    mockFetch(() => json(200, {}));
    await openRegister();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('does not show the features the spec removes', async () => {
    mockFetch(() => json(200, {}));
    await openRegister();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/honor code/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/strong password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thousands|14,200|privacy|manifesto/i)).not.toBeInTheDocument();
  });

  it('has a separate show/hide toggle on each password field', async () => {
    mockFetch(() => json(200, {}));
    const user = await openRegister();
    const password = screen.getByLabelText('Password');
    const confirmation = screen.getByLabelText('Confirm password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(confirmation).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show confirm password' }));
    expect(confirmation).toHaveAttribute('type', 'text');
  });
});

describe('S3 password checklist', () => {
  it('has three rows, none met at first', async () => {
    mockFetch(() => json(200, {}));
    await openRegister();
    const rows = within(screen.getByRole('list', { name: 'Password rules' })).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    for (const label of ['At least 8 bytes', 'At most 72 bytes', 'Matches the confirmation']) {
      expect(isMet(rule(label))).toBe(false);
      expect(rule(label)).toHaveTextContent('(not met)');
    }
  });

  it('ticks the rows live as the password and confirmation change', async () => {
    mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fill(user, 'Password', 'abc');
    expect(isMet(rule('At least 8 bytes'))).toBe(false);
    expect(isMet(rule('At most 72 bytes'))).toBe(true);
    await fill(user, 'Password', 'defghij'); // now "abcdefghij", 10 bytes
    expect(isMet(rule('At least 8 bytes'))).toBe(true);
    expect(isMet(rule('Matches the confirmation'))).toBe(false);
    await fill(user, 'Confirm password', 'abcdefghij');
    expect(isMet(rule('Matches the confirmation'))).toBe(true);
    await fill(user, 'Confirm password', 'x');
    expect(isMet(rule('Matches the confirmation'))).toBe(false);
  });

  it('counts bytes, not characters: "éééé" is 4 characters and 8 bytes, so "At least 8 bytes" is met', async () => {
    mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fill(user, 'Password', 'éééé');
    expect(isMet(rule('At least 8 bytes'))).toBe(true);
  });

  it('counts bytes, not characters: "ééé" is 3 characters and 6 bytes, so it is not enough', async () => {
    mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fill(user, 'Password', 'ééé');
    expect(isMet(rule('At least 8 bytes'))).toBe(false);
  });

  it('counts bytes, not characters: 37 characters of "é" are 74 bytes, so "At most 72 bytes" is not met', async () => {
    mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fill(user, 'Password', 'é'.repeat(37));
    expect(isMet(rule('At least 8 bytes'))).toBe(true);
    expect(isMet(rule('At most 72 bytes'))).toBe(false);
  });

  it('36 characters of "é" are exactly 72 bytes, so both length rows are met', async () => {
    mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fill(user, 'Password', 'é'.repeat(36));
    expect(isMet(rule('At least 8 bytes'))).toBe(true);
    expect(isMet(rule('At most 72 bytes'))).toBe(true);
  });
});

describe('S3 browser checks (no network call)', () => {
  it('a mismatched confirmation blocks the submit', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fillValid(user, { password: 'correct-horse', confirmation: 'correct-hors' });
    await user.click(submitButton());
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(location()).toBe('/register');
  });

  it('an empty submit shows a message under every field', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openRegister();
    await user.click(submitButton());
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Enter your full name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter a password.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a one-character name is blocked', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fillValid(user);
    await user.clear(screen.getByLabelText('Full name'));
    await fill(user, 'Full name', 'A');
    await user.click(submitButton());
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Name must be 2 to 50 characters.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a badly formatted email is blocked', async () => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fillValid(user);
    await user.clear(screen.getByLabelText('Email'));
    await fill(user, 'Email', 'not-an-email');
    await user.click(submitButton());
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a 7-byte password', 'a'.repeat(7)],
    ['a 73-byte password', 'a'.repeat(73)],
    ['37 characters of "é" (74 bytes)', 'é'.repeat(37)],
    ['3 characters of "é" (6 bytes)', 'ééé'],
  ])('blocks %s', async (_label, password) => {
    const fetchMock = mockFetch(() => json(200, {}));
    const user = await openRegister();
    await fillValid(user, { password });
    await user.click(submitButton());
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password must be 8 to 72 bytes.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('S3 create account', () => {
  it('sends E2 with only name, email and password (trimmed), stores the session, and lands on /dashboard logged in', async () => {
    const fetchMock = mockFetch(() => realResponse('registerOk'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    await screen.findByTestId('screen-S4');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/auth/register');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Alex Chen', email: 'alex@example.com', password: 'correct-horse' });
    expect(init.headers.Authorization).toBeUndefined();
    expect(localStorage.getItem('oa.token')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('oa.user'))).toHaveProperty('name', 'Alex Chen');
    expect(location()).toBe('/dashboard');
    expect(screen.getByTestId('topbar-user-name')).toHaveTextContent('Alex Chen');
  });

  it('accepts a multi-byte password that is long enough in bytes ("éééé")', async () => {
    const fetchMock = mockFetch(() => realResponse('registerPasswordMultiByteOk'));
    const user = await openRegister();
    await fillValid(user, { password: 'éééé' });
    await user.click(submitButton());
    await screen.findByTestId('screen-S4');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).password).toBe('éééé');
  });

  it('shows a loading state and sends only one request when clicked twice', async () => {
    let resolve;
    const fetchMock = mockFetch(() => new Promise((r) => (resolve = r)));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    const busy = screen.getByRole('button', { name: 'Creating account…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(realResponse('registerOk'));
    await screen.findByTestId('screen-S4');
  });
});

describe('S3 errors (real backend responses)', () => {
  it('EMAIL_TAKEN shows "This email already has an account." under the email field and no banner', async () => {
    mockFetch(() => realResponse('registerEmailTaken'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('This email already has an account.'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(location()).toBe('/register');
    expect(localStorage.getItem('oa.token')).toBeNull();
  });

  it('VALIDATION_ERROR shows each message under its field', async () => {
    mockFetch(() => realResponse('registerValidationAllBad'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Invalid email'));
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('String must contain at least 2 character(s)');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Must be 8 to 72 bytes long');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('VALIDATION_ERROR on the password alone (the backend rejected a 74-byte password)', async () => {
    mockFetch(() => realResponse('registerPasswordTooLongBytes'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    await waitFor(() =>
      expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Must be 8 to 72 bytes long'),
    );
    expect(screen.getByLabelText('Email')).not.toHaveAccessibleDescription('Invalid email');
  });

  it('VALIDATION_ERROR that names no known field shows a banner', async () => {
    mockFetch(() => apiError(400, 'VALIDATION_ERROR', 'Invalid input'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid input');
  });

  it('TOO_MANY_REQUESTS shows a banner with the wait time from Retry-After', async () => {
    mockFetch(() => realResponse('tooManyRequests'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Try again in 60 seconds.');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('NETWORK_ERROR shows a banner with Retry, and Retry sends the same form again', async () => {
    let up = false;
    const fetchMock = mockApi([
      [
        'POST',
        '/api/auth/register',
        () => {
          if (!up) throw new TypeError('Failed to fetch');
          return realResponse('registerOk');
        },
      ],
    ]);
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(screen.getByLabelText('Password')).toHaveValue('correct-horse');
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S4');
    expect(callsTo(fetchMock, '/api/auth/register')).toHaveLength(2);
  });

  it('INTERNAL_ERROR shows a banner with Retry', async () => {
    mockFetch(() => apiError(500, 'INTERNAL_ERROR', 'Something went wrong'));
    const user = await openRegister();
    await fillValid(user);
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
