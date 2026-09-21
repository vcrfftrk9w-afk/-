import { useEffect, useState } from 'react';

/** Тикающее «сейчас»: нужно, чтобы договорённости срабатывали вовремя. */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
