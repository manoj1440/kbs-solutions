import { describe, expect, it } from 'vitest';

import { ApiClientError, createApiClient } from '../src/client';

const respond = (status: number, body: string, contentType = 'application/json') =>
  (async () => new Response(body, { status, headers: { 'Content-Type': contentType } })) as unknown as typeof fetch;

describe('createApiClient response parsing (F-908 P8)', () => {
  it('returns the envelope on a JSON success', async () => {
    const api = createApiClient({ baseUrl: 'http://x', fetchImpl: respond(200, JSON.stringify({ data: { ok: 1 }, meta: {} })) });
    await expect(api.get<{ ok: number }>('/a')).resolves.toMatchObject({ data: { ok: 1 } });
  });

  it('throws ApiClientError with the server error on a JSON failure', async () => {
    const api = createApiClient({
      baseUrl: 'http://x',
      fetchImpl: respond(404, JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Lead not found' }, meta: {} })),
    });
    await expect(api.get('/a')).rejects.toMatchObject({ status: 404, error: { code: 'NOT_FOUND' } });
  });

  it('turns an HTML error page into a plain ApiClientError instead of a SyntaxError', async () => {
    const api = createApiClient({ baseUrl: 'http://x', fetchImpl: respond(502, '<!doctype html><h1>Bad gateway</h1>', 'text/html') });
    const err = await api.get('/a').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 502, error: { code: 'INTERNAL', message: 'Unexpected response from the server. Try again.' } });
  });
});
