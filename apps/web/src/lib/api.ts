import 'server-only';

import type { MeResponse } from '@kbs/shared';
import { cookies } from 'next/headers';

export const API_URL = process.env.API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Server-side fetch that forwards the browser's auth cookies to the API. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta: Record<string, unknown> }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { accept: 'application/json', cookie: cookieHeader, ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; meta?: Record<string, unknown>; error?: { code: string; message: string } };
  if (!res.ok) throw new ApiError(res.status, body.error?.code ?? 'INTERNAL', body.error?.message ?? res.statusText);
  return { data: body.data as T, meta: body.meta ?? {} };
}

/** Current session or null (never throws for 401). */
export async function getSession(): Promise<MeResponse | null> {
  try {
    const r = await apiFetch<MeResponse>('/auth/me');
    return r.data;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}
