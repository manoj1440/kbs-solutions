import { Logger } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { assertOtpProviderConfigured, EnvSchema } from '../../config/env';

import { MSG91_TIMEOUT_MS, Msg91OtpAdapter } from './msg91-otp.adapter';

const AUTH_KEY = 'authkey-SECRET-0001';
const cfg = { host: 'control.msg91.com', authKey: AUTH_KEY, templateId: 'tpl669a29fb', senderId: 'KBSSOL', otpVariable: 'VAR1' };
const MOBILE = '+919812345678';
const CODE = '482913';

describe('Msg91OtpAdapter', () => {
  const realFetch = global.fetch;
  let logged: string[];
  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => void logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')));
    }
  });
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  const stub = (respond: (url: string, init: RequestInit) => Promise<Response> | Response) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, init);
    }) as unknown as typeof fetch;
    return calls;
  };
  const expectNothingSensitive = (...extra: string[]) => {
    const all = [...logged, ...extra].join('\n');
    expect(all).not.toContain(CODE);
    expect(all).not.toContain('9812345678');
    expect(all).not.toContain('98123');
    expect(all).not.toContain(AUTH_KEY);
  };
  const failure = async (p: Promise<unknown>) => {
    const e = await p.then(
      () => null,
      (err: unknown) => err,
    );
    expect(e).toBeInstanceOf(AppError);
    const err = e as AppError;
    expect(err.code).toBe('INTERNAL');
    expect(err.recovery).toBe('RETRY_LATER');
    expect(err.message).toBe('We could not send the code. Please try again in a moment.');
    expect(err.details).toBeUndefined();
    return err;
  };

  it('sends one template SMS: flow endpoint, authkey header, template id, sender, 91XXXXXXXXXX and the code as the template variable', async () => {
    const calls = stub(() => new Response(JSON.stringify({ message: '5e1e93cad6fc054d8e759a5b', type: 'success' }), { status: 200 }));
    const r = await new Msg91OtpAdapter(cfg).send(MOBILE, CODE);
    expect(r).toEqual({ accepted: true, providerRef: '5e1e93cad6fc054d8e759a5b' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://control.msg91.com/api/v5/flow');
    expect(calls[0]?.url).not.toContain('98123'); // nothing personal in the URL
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toEqual({ authkey: AUTH_KEY, 'content-type': 'application/json', accept: 'application/json' });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ template_id: 'tpl669a29fb', sender: 'KBSSOL', short_url: '0', recipients: [{ mobiles: '919812345678', VAR1: CODE }] });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(logged.join('\n')).toContain('+91••••••5678');
    expectNothingSensitive();
  });

  it('uses the configured host and variable name; a bare 10-digit number gets the 91 prefix', async () => {
    const calls = stub(() => new Response(JSON.stringify({ message: '5e1e93cad6fc054d8e759a5b', type: 'success' }), { status: 200 }));
    await new Msg91OtpAdapter({ ...cfg, host: 'api.msg91.test', otpVariable: 'OTP' }).send('9812345678', CODE);
    expect(calls[0]?.url).toBe('https://api.msg91.test/api/v5/flow');
    expect(JSON.parse(String(calls[0]?.init.body)).recipients).toEqual([{ mobiles: '919812345678', OTP: CODE }]);
  });

  it('provider error in a 200 body → app error; the provider text stays in the log, not in the response', async () => {
    const calls = stub(() => new Response(JSON.stringify({ message: 'The provided flow ID or template ID is invalid.', type: 'error' }), { status: 200 }));
    const err = await failure(new Msg91OtpAdapter(cfg).send(MOBILE, CODE));
    expect(calls).toHaveLength(1); // no automatic retry
    expect(JSON.stringify(err)).not.toMatch(/msg91|template|flow/i);
    expect(logged.join('\n')).toContain('template ID is invalid');
    expectNothingSensitive(err.message);
  });

  it('401 → app error with a hint about the key, never the key', async () => {
    stub(() => new Response(JSON.stringify({ message: 'Auth Key missing', type: 'error' }), { status: 401 }));
    await failure(new Msg91OtpAdapter(cfg).send(MOBILE, CODE));
    expect(logged.join('\n')).toContain('HTTP 401');
    expect(logged.join('\n')).toContain('MSG91_AUTH_KEY');
    expectNothingSensitive();
  });

  it('provider text that echoes the number or the code is scrubbed before logging', async () => {
    stub(() => new Response(JSON.stringify({ message: `Invalid mobile 919812345678 for otp ${CODE}`, type: 'error' }), { status: 400 }));
    await failure(new Msg91OtpAdapter(cfg).send(MOBILE, CODE));
    expect(logged.join('\n')).toContain('Invalid mobile');
    expectNothingSensitive();
  });

  it('5xx, a non-JSON body and a success without a request id are all failures', async () => {
    for (const res of [() => new Response('<html>Bad gateway</html>', { status: 502 }), () => new Response('OK', { status: 200 }), () => new Response(JSON.stringify({ type: 'success' }), { status: 200 })]) {
      stub(res);
      await failure(new Msg91OtpAdapter(cfg).send(MOBILE, CODE));
    }
    expectNothingSensitive();
  });

  it('timeout: aborts the request, one attempt, app error', async () => {
    const calls = stub(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    await failure(new Msg91OtpAdapter({ ...cfg, timeoutMs: 20 }).send(MOBILE, CODE));
    expect(calls).toHaveLength(1);
    expect(logged.join('\n')).toContain('no answer within 20 ms');
    expect(MSG91_TIMEOUT_MS).toBe(10_000);
    expectNothingSensitive();
  });

  it('network error → app error; the underlying message is not logged', async () => {
    stub(() => {
      throw new TypeError(`fetch failed for ${MOBILE} ${CODE} ${AUTH_KEY}`);
    });
    await failure(new Msg91OtpAdapter(cfg).send(MOBILE, CODE));
    expect(logged.join('\n')).toContain('network error (TypeError)');
    expectNothingSensitive();
  });

  it('a number that is not an Indian mobile is never sent to the provider', async () => {
    const calls = stub(() => new Response('{}', { status: 200 }));
    await failure(new Msg91OtpAdapter(cfg).send('+14155550123', CODE));
    await failure(new Msg91OtpAdapter(cfg).send('+915812345678', CODE));
    expect(calls).toHaveLength(0);
    expect(logged.join('\n')).not.toContain(CODE);
  });
});

describe('OTP_PROVIDER=msg91 boot validation', () => {
  const full = { OTP_PROVIDER: 'msg91' as const, MSG91_AUTH_KEY: 'k', MSG91_TEMPLATE_ID: 't', MSG91_SENDER_ID: 'KBSSOL' };

  it('refuses to boot without the keys and names every missing one (never a value)', () => {
    expect(() => assertOtpProviderConfigured({ OTP_PROVIDER: 'msg91' })).toThrow('OTP_PROVIDER=msg91 needs MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, MSG91_SENDER_ID');
    expect(() => assertOtpProviderConfigured({ ...full, MSG91_TEMPLATE_ID: '' })).toThrow('needs MSG91_TEMPLATE_ID');
    expect(() => assertOtpProviderConfigured({ ...full, MSG91_SENDER_ID: '   ' })).toThrow('needs MSG91_SENDER_ID');
    try {
      assertOtpProviderConfigured({ ...full, MSG91_AUTH_KEY: AUTH_KEY, MSG91_SENDER_ID: undefined });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain(AUTH_KEY);
    }
  });

  it('boots with all keys; console needs none', () => {
    expect(() => assertOtpProviderConfigured(full)).not.toThrow();
    expect(() => assertOtpProviderConfigured({ OTP_PROVIDER: 'console' })).not.toThrow();
  });

  it('schema: console stays the default, unknown providers and a host with a scheme or path are refused', () => {
    const base = { DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), DATA_ENCRYPTION_KEY: 'c'.repeat(44) };
    const d = EnvSchema.parse(base);
    expect(d.OTP_PROVIDER).toBe('console');
    expect(d.MSG91_HOST).toBe('control.msg91.com');
    expect(d.MSG91_OTP_VARIABLE).toBe('VAR1');
    expect(EnvSchema.safeParse({ ...base, OTP_PROVIDER: 'msg91' }).success).toBe(true);
    expect(EnvSchema.safeParse({ ...base, OTP_PROVIDER: 'twilio' }).success).toBe(false);
    expect(EnvSchema.safeParse({ ...base, MSG91_HOST: 'http://evil.example' }).success).toBe(false);
    expect(EnvSchema.safeParse({ ...base, MSG91_HOST: 'control.msg91.com/x' }).success).toBe(false);
  });
});
