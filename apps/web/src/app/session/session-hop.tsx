'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { loginUrlFor, safeNext } from '@/lib/session-paths';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Asks the API to renew the session with the httpOnly refresh cookie (the browser attaches it; this code never sees a
 * token), then returns to `next`. A refused refresh goes to login with the reason (session ended / deactivated).
 */
export function SessionHop() {
  const sp = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [slow, setSlow] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setTimeout(() => setSlow(true), 4000);
    void (async () => {
      try {
        const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (res.ok) {
          window.location.replace(next);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        window.location.replace(loginUrlFor(body.error?.code ?? null, next));
      } catch {
        // API unreachable: do not pretend the session ended — offer a retry
        setSlow(true);
      } finally {
        clearTimeout(t);
      }
    })();
  }, [next]);
  return (
    <div role="status" aria-live="polite" className="grid max-w-sm gap-3 text-center">
      <p className="text-lg font-semibold">Restoring your session…</p>
      {slow ? (
        <>
          <p className="text-muted-foreground text-sm">We couldn&apos;t reach KBS. Check your connection and try again.</p>
          <div className="flex justify-center gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => window.location.reload()}>
              Try again
            </button>
            <a className="rounded-md border px-3 py-2 text-sm" href={loginUrlFor(null, next)}>
              Sign in
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
