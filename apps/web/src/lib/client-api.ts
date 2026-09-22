'use client';

import { createApiClient } from '@kbs/shared';

/** Browser client: cookie auth (credentials: include). Refresh is attempted once on 401. */
export const clientApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  credentials: 'include',
  onUnauthorized: async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
    return res.ok;
  },
});
