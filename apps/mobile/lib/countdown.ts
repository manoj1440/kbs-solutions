import { useCallback, useEffect, useState } from 'react';

const at = (seconds: number) => Date.now() + seconds * 1000;
const leftUntil = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000));

/** m:ss for a countdown. */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Live countdown to a deadline. It counts against the clock, not ticks, so it stays right after the app was in the
 * background. `pct` is the share of the wait still left (for a progress bar).
 */
export function useCountdown(initialSeconds = 0) {
  const [wait, setWait] = useState(() => ({
    until: at(initialSeconds),
    total: Math.max(1, initialSeconds),
  }));
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft(leftUntil(wait.until)), 250);
    return () => clearInterval(t);
  }, [wait]);
  const start = useCallback((seconds: number, total = seconds) => {
    setWait({ until: at(seconds), total: Math.max(1, total) });
    setSecondsLeft(seconds);
  }, []);
  const pct = secondsLeft > 0 ? Math.min(100, (secondsLeft / wait.total) * 100) : 0;
  return { secondsLeft, pct, start };
}

/** The wait the API reports with AUTH_OTP_RESEND_TOO_SOON, if this error is one. */
export function resendWait(e: unknown): { seconds: number; total: number } | null {
  const err = (e as { error?: { code?: string; details?: unknown } } | null)?.error;
  if (err?.code !== 'AUTH_OTP_RESEND_TOO_SOON') return null;
  const d = err.details as { retryAfterSec?: number; cooldownSec?: number } | undefined;
  return d?.retryAfterSec
    ? { seconds: d.retryAfterSec, total: d.cooldownSec ?? d.retryAfterSec }
    : null;
}
