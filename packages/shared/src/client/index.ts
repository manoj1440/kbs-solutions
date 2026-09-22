import type { ApiError, ApiMeta } from '../schemas/common';

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}
export interface ApiFailure {
  error: ApiError;
  meta: ApiMeta;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
    public readonly meta: ApiMeta | undefined,
  ) {
    super(error.message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => Promise<boolean> | boolean; // return true if a retry should happen (after refresh)
  fetchImpl?: typeof fetch;
  extraHeaders?: () => Record<string, string>;
  credentials?: 'include' | 'omit' | 'same-origin';
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Minimal typed client shared by web and mobile: envelope parsing, idempotency keys, 401 retry hook. */
export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetchImpl ?? fetch;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    init: { idempotencyKey?: string; retry?: boolean } = {},
  ): Promise<ApiSuccess<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-Id': uuid(),
      ...(opts.extraHeaders?.() ?? {}),
    };
    const token = await opts.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (MUTATING.has(method)) headers['Idempotency-Key'] = init.idempotencyKey ?? uuid();

    const res = await f(`${opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      credentials: opts.credentials,
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as ApiSuccess<T> | ApiFailure) : ({} as ApiSuccess<T>);
    if (res.ok) return json as ApiSuccess<T>;
    if (res.status === 401 && !init.retry && opts.onUnauthorized) {
      const shouldRetry = await opts.onUnauthorized();
      if (shouldRetry) return request<T>(method, path, body, { ...init, retry: true });
    }
    const failure = json as ApiFailure;
    throw new ApiClientError(res.status, failure.error ?? { code: 'INTERNAL', message: res.statusText }, failure.meta);
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
      request<T>('POST', path, body, { idempotencyKey }),
    put: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
      request<T>('PUT', path, body, { idempotencyKey }),
    patch: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
      request<T>('PATCH', path, body, { idempotencyKey }),
    delete: <T>(path: string) => request<T>('DELETE', path),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
