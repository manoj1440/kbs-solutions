'use client';

import { useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * F-804: keeps an open web workspace signed in. Renews the session two minutes before the access cookie lapses and
 * when the tab regains focus after a long pause. Cookie-only: the browser never reads a token. Failures are ignored —
 * the next page load takes the /session hop, which explains the outcome.
 */
export function SessionKeepAlive({ accessExpiresInSec }: { accessExpiresInSec: number }) {
  useEffect(() => {
    const everyMs = Math.max(60, accessExpiresInSec - 120) * 1000;
    let last = Date.now();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (r.ok) last = Date.now();
      } catch {
        /* offline: try again on the next tick or focus */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void refresh(), everyMs);
    const onFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > everyMs) void refresh();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [accessExpiresInSec]);
  return null;
}
