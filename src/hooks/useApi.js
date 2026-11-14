import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `fetcher({ signal })` when the component mounts and whenever `deps` change or `reload()` is called.
 * Gives { status: 'loading' | 'success' | 'error', data, error, reload } (FR22).
 * The request is cancelled when the component unmounts or the inputs change.
 * `reload({ silent: true })` fetches again without going back to the loading state, so the data
 * on screen stays until the new data arrives.
 */
export function useApi(fetcher, deps = []) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const silentRef = useRef(false);

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const silent = silentRef.current;
    silentRef.current = false;
    const controller = new AbortController();
    if (!silent) setState({ status: 'loading', data: null, error: null });
    fetcherRef
      .current({ signal: controller.signal })
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        if (error && error.name === 'AbortError') return;
        setState({ status: 'error', data: null, error });
      });
    return () => controller.abort();
    // The caller lists what the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback((options) => {
    silentRef.current = Boolean(options && options.silent === true);
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}
