import { request } from './client';

// E2: POST /api/auth/register -> 201 { token, user: { id, name, email } }
export function register({ name, email, password }) {
  return request('/api/auth/register', { method: 'POST', body: { name, email, password }, auth: false });
}

// E3: POST /api/auth/login -> 200 { token, user: { id, name, email } }
export function login({ email, password }) {
  return request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
}

// E4: GET /api/auth/me -> { user: { id, name, email } }
export function getMe(options) {
  return request('/api/auth/me', options);
}
