import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOffsetMs } from '../lib/clock';
import { apiError, json, mockFetch, stubApiBase, storeSession } from '../test/helpers';
import { request } from './client';

beforeEach(() => stubApiBase());

describe('FR3: Authorization header', () => {
  it('sends Bearer <token> on a protected request', async () => {
    storeSession('abc.def.ghi');
    const fetchMock = mockFetch(() => json(200, { ok: true }));
    await request('/api/topics');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('sends no Authorization header when there is no token', async () => {
    const fetchMock = mockFetch(() => json(200, { ok: true }));
    await request('/api/topics');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('sends no Authorization header on a public call (auth: false)', async () => {
    storeSession('abc');
    const fetchMock = mockFetch(() => json(200, {}));
    await request('/api/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' }, auth: false });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe('FR7: one API module, base URL from the environment', () => {
  it('builds the URL from VITE_API_BASE_URL and drops a trailing slash', async () => {
    stubApiBase('http://api.example:9999/');
    const fetchMock = mockFetch(() => json(200, {}));
    await request('/api/auth/me');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.example:9999/api/auth/me');
  });

  it('fails loudly when VITE_API_BASE_URL is missing', async () => {
    stubApiBase('');
    mockFetch(() => json(200, {}));
    await expect(request('/api/auth/me')).rejects.toThrow(/VITE_API_BASE_URL/);
  });

  it('is the only file in src that calls fetch', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(name) && !/\.test\.|helpers\.jsx$|setup\.js$/.test(name)) files.push(full);
      }
    };
    walk(join(process.cwd(), 'src'));
    const callers = files
      .filter((f) => /\bfetch\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(process.cwd(), f));
    expect(callers).toEqual(['src/api/client.js']);
  });
});

describe('FR8: error normalization', () => {
  it('returns { status, code, message, details, retryAfterSeconds }', async () => {
    mockFetch(() => apiError(409, 'EMAIL_TAKEN', 'Email taken'));
    const err = await request('/api/auth/register', { method: 'POST', body: {}, auth: false }).catch((e) => e);
    expect(err).toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email taken',
      details: null,
      retryAfterSeconds: null,
    });
  });

  it('keeps field details for VALIDATION_ERROR', async () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    mockFetch(() => apiError(400, 'VALIDATION_ERROR', 'Bad input', details));
    const err = await request('/api/auth/login', { method: 'POST', body: {}, auth: false }).catch((e) => e);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });

  it.each([
    [1000, 1],
    [1001, 2],
    [2500, 3],
    [1, 1],
    [3000, 3],
  ])('COOLDOWN: retryAfterMs %i gives retryAfterSeconds %i (divided by 1000, rounded up)', async (ms, seconds) => {
    mockFetch(() => apiError(429, 'COOLDOWN', 'Wait', { retryAfterMs: ms }));
    const err = await request('/api/assessments/1/questions/1/run', { method: 'POST', body: {} }).catch((e) => e);
    expect(err.code).toBe('COOLDOWN');
    expect(err.retryAfterSeconds).toBe(seconds);
  });

  it('TOO_MANY_REQUESTS: reads the wait time from the Retry-After header', async () => {
    mockFetch(() => json(429, { error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down' } }, { 'Retry-After': '42' }));
    const err = await request('/api/auth/login', { method: 'POST', body: {}, auth: false }).catch((e) => e);
    expect(err).toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS', retryAfterSeconds: 42 });
  });

  it('a failed network request gives the code NETWORK_ERROR', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const err = await request('/api/topics').catch((e) => e);
    expect(err).toMatchObject({ status: null, code: 'NETWORK_ERROR' });
  });
});

describe('FR9: invalid JSON is INTERNAL_ERROR', () => {
  it('on a successful response whose body is not JSON', async () => {
    mockFetch(() => new Response('<html>oops</html>', { status: 200 }));
    const err = await request('/api/topics').catch((e) => e);
    expect(err).toMatchObject({ status: 200, code: 'INTERNAL_ERROR' });
  });

  it('on an error response whose body is not JSON', async () => {
    mockFetch(() => new Response('Bad gateway', { status: 502 }));
    const err = await request('/api/topics').catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('on an error response that is JSON but not the documented shape', async () => {
    mockFetch(() => json(500, { oops: true }));
    const err = await request('/api/topics').catch((e) => e);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('204 responses', () => {
  it('return null without reading a body', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    await expect(request('/api/assessments/1', { method: 'DELETE' })).resolves.toBeNull();
  });
});

describe('FR10: no logging of bodies', () => {
  it('does not write to the console on success or failure', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    mockFetch(() => json(200, { secret: 'body' }));
    await request('/api/topics', { method: 'POST', body: { password: 'hunter2hunter2' } });
    mockFetch(() => apiError(401, 'INVALID_CREDENTIALS', 'nope'));
    await request('/api/auth/login', { method: 'POST', body: { password: 'hunter2hunter2' }, auth: false }).catch(() => {});
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('FR12: every response with serverTime sets the clock offset', () => {
  it('sets the offset from serverTime when the response arrives', async () => {
    const serverTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // the server is 10 minutes ahead
    mockFetch(() => json(200, { id: 'r1', serverTime }));
    await request('/api/assessments/r1');
    expect(getOffsetMs()).toBeGreaterThan(9.9 * 60 * 1000);
    expect(getOffsetMs()).toBeLessThan(10.1 * 60 * 1000);
  });

  it('a later response sets it again', async () => {
    mockFetch(() => json(200, { serverTime: new Date(Date.now() + 10 * 60 * 1000).toISOString() }));
    await request('/api/assessments/r1');
    mockFetch(() => json(200, { serverTime: new Date(Date.now() - 5 * 60 * 1000).toISOString() }));
    await request('/api/assessments/r1');
    expect(getOffsetMs()).toBeLessThan(-4.9 * 60 * 1000);
  });

  it('does not change the offset for a response without serverTime', async () => {
    mockFetch(() => json(200, { items: [] }));
    await request('/api/assessments');
    expect(getOffsetMs()).toBe(0);
  });

  it('does not change the offset for an error response or one with an invalid serverTime', async () => {
    mockFetch(() => apiError(409, 'ROUND_NOT_ACTIVE', 'x'));
    await request('/api/assessments/r1/questions/1/open', { method: 'POST' }).catch(() => {});
    mockFetch(() => json(200, { serverTime: 'not a date' }));
    await request('/api/assessments/r1');
    expect(getOffsetMs()).toBe(0);
  });

  it('a 204 has no serverTime and leaves the offset alone', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    await request('/api/assessments/r1/questions/1/code', { method: 'PUT', body: { code: 'x' } });
    expect(getOffsetMs()).toBe(0);
  });
});
