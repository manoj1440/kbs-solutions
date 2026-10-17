'use client';

import { createApiClient } from '@kbs/shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// ADR-015: one refresh at a time per page — concurrent 401s wait for the same request instead of each rotating the cookie
let inFlight: Promise<boolean> | null = null;
function refreshOnce() {
  inFlight ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Browser client: cookie auth (credentials: include). Refresh is attempted once on 401 (shared across concurrent calls). */
export const clientApi = createApiClient({
  baseUrl: API,
  credentials: 'include',
  onUnauthorized: refreshOnce,
});
