// The only module that makes HTTP calls (FR7).
// Every failure is thrown as an ApiError with { status, code, message, details, retryAfterSeconds } (FR8).
// This module never logs request or response bodies (FR10).

import { getToken } from '../auth/storage';
import { syncClock } from '../lib/clock';

const GENERIC_MESSAGE = 'Something went wrong. Try again.';
const NETWORK_MESSAGE = "Can't reach the server. Check your connection.";

export class ApiError extends Error {
  constructor({ status = null, code, message, details = null, retryAfterSeconds = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// FR5: a 401 UNAUTHORIZED from any call is handled by the auth layer (clear session, go to /login).
let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function getBaseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) {
    throw new Error('VITE_API_BASE_URL is not set. Copy .env.example to .env.');
  }
  return base.replace(/\/+$/, '');
}

function secondsFromMs(ms) {
  return Math.ceil(ms / 1000);
}

function retryAfterFrom(code, details, response) {
  if (code === 'COOLDOWN' && details && typeof details.retryAfterMs === 'number') {
    return secondsFromMs(details.retryAfterMs);
  }
  if (code === 'TOO_MANY_REQUESTS') {
    const header = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(header) && header > 0) return Math.ceil(header);
  }
  return null;
}

async function toApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const err = body && typeof body === 'object' ? body.error : null;
  if (!err || typeof err.code !== 'string') {
    // FR9: not the documented error shape, so treat it as an internal error.
    return new ApiError({ status: response.status, code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE });
  }
  const details = err.details ?? null;
  return new ApiError({
    status: response.status,
    code: err.code,
    message: typeof err.message === 'string' ? err.message : GENERIC_MESSAGE,
    details,
    retryAfterSeconds: retryAfterFrom(err.code, details, response),
  });
}

/**
 * Calls the backend.
 * @param {string} path  e.g. '/api/auth/me'
 * @param {{ method?: string, body?: unknown, auth?: boolean, signal?: AbortSignal }} [options]
 *   auth defaults to true: the Authorization header is sent when a token is stored (FR3).
 * @returns the parsed JSON body, or null for a 204.
 */
export async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Read outside the try block: a missing setting is a developer error, not a network failure.
  const url = `${getBaseUrl()}${path}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause && cause.name === 'AbortError') throw cause;
    throw new ApiError({ status: null, code: 'NETWORK_ERROR', message: NETWORK_MESSAGE });
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === 'UNAUTHORIZED' && unauthorizedHandler) unauthorizedHandler(error);
    throw error;
  }

  if (response.status === 204) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    // FR9: JSON was expected and the body is not valid JSON.
    throw new ApiError({ status: response.status, code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE });
  }
  // FR12: each response that contains `serverTime` sets the clock offset, measured as it arrives.
  if (data && typeof data === 'object' && typeof data.serverTime === 'string') syncClock(data.serverTime);
  return data;
}
