import { useEffect, useState } from 'react';
import { remainingMs } from '../lib/clock';

/** Milliseconds left until `deadline` on the server's clock. Updates once per second (FR14). */
export function useCountdown(deadline) {
  const [ms, setMs] = useState(() => remainingMs(deadline));

  useEffect(() => {
    setMs(remainingMs(deadline));
    const timer = setInterval(() => setMs(remainingMs(deadline)), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  return ms;
}
