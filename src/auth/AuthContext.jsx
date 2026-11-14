import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMe } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { clearSession, getToken, saveSession, saveUser } from './storage';

const AuthContext = createContext(null);

const PUBLIC_PATHS = ['/', '/login', '/register'];

// FR5: where to send a user whose token is no longer accepted.
export function loginUrlFor(pathname, search = '') {
  if (PUBLIC_PATHS.includes(pathname)) return '/login';
  return `/login?returnTo=${encodeURIComponent(pathname + search)}`;
}

/**
 * status:
 *  - 'loading': a stored token is being checked with E4 (FR4)
 *  - 'ready':   the check is finished; `user` is set when logged in
 *  - 'error':   E4 failed for a reason other than 401; the token is kept and the user can retry
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'ready'));
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  // FR5: a 401 UNAUTHORIZED from any call clears the session and goes to /login with returnTo.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
      setStatus('ready');
      const { pathname, search } = locationRef.current;
      navigate(loginUrlFor(pathname, search), { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  // FR4: on app start, if a token exists, call E4.
  useEffect(() => {
    if (!getToken()) {
      setStatus('ready');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    getMe({ signal: controller.signal })
      .then((data) => {
        saveUser(data.user);
        setUser(data.user);
        setStatus('ready');
      })
      .catch((err) => {
        if (err && err.name === 'AbortError') return;
        // A 401 was already handled by the unauthorized handler.
        if (err && err.code === 'UNAUTHORIZED') return;
        setError(err);
        setStatus('error');
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // FR2: store the token and the user object.
  const signIn = useCallback((token, nextUser) => {
    saveSession(token, nextUser);
    setUser(nextUser);
    setStatus('ready');
  }, []);

  // FR6: delete the stored session and go to /login. No server call.
  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ status, user, error, isAuthenticated: Boolean(user), signIn, logout, retry }),
    [status, user, error, signIn, logout, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
