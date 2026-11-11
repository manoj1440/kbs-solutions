import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';

import { Logger } from '@nestjs/common';

import { assertVerificationProvidersConfigured, EnvSchema } from '../../config/env';

import { CashfreePanAdapter } from './cashfree-pan.adapter';
import {
  CASHFREE_TIMEOUT_MS,
  CASHFREE_VERIFICATION_BASE_URL,
  cashfreeSignature,
} from './cashfree-verification.client';

const CLIENT_ID = 'CF10000TESTCLIENT';
const SECRET = 'cfsk_ma_test_SECRET_0001';
const cfg = { env: 'sandbox' as const, clientId: CLIENT_ID, clientSecret: SECRET };
const PAN = 'ABCPV1234D';
const NAME = 'Rajesh Kumar Sharma';
const REGISTERED = 'RAJESH KUMAR SHARMA';
const OTHER_REGISTERED = 'SUNITA DEVI VERMA';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const valid = (extra: Record<string, unknown> = {}) => ({
  pan: PAN,
  type: 'Individual',
  reference_id: 161,
  name_provided: NAME,
  registered_name: REGISTERED,
  valid: true,
  message: 'PAN verified successfully',
  pan_status: 'VALID',
  ...extra,
});

describe('CashfreePanAdapter', () => {
  const realFetch = global.fetch;
  let logged: string[];
  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation(
          (...args: unknown[]) =>
            void logged.push(
              args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
            ),
        );
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
  /** Nothing personal or secret in the logs or in what the adapter returned. */
  const expectNothingSensitive = (...returned: unknown[]) => {
    const all = [...logged, ...returned.map((r) => JSON.stringify(r))].join('\n');
    for (const s of [
      PAN,
      PAN.toLowerCase(),
      '1234D',
      NAME,
      REGISTERED,
      'RAJESH',
      'Rajesh',
      'SHARMA',
      OTHER_REGISTERED,
      'SUNITA',
      SECRET,
      CLIENT_ID,
    ])
      expect(all).not.toContain(s);
  };

  it('sends one request: POST /verification/pan, client id + secret headers, api version, { pan, name } — no signature without a public key', async () => {
    const calls = stub(() =>
      json(valid({ name_match_score: '100.00', name_match_result: 'DIRECT_MATCH' })),
    );
    const r = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME });
    expect(r).toEqual({ status: 'VERIFIED', providerRef: '161' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://sandbox.cashfree.com/verification/pan');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toEqual({
      'x-client-id': CLIENT_ID,
      'x-client-secret': SECRET,
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-version': '2024-08-01',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ pan: PAN, name: NAME });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(logged.join('\n')).toContain('VERIFIED');
    expect(logged.join('\n')).toContain('ref 161');
    expectNothingSensitive(r);
  });

  it('production base URL, configured api version, PAN upper-cased, name reduced to the characters Cashfree allows', async () => {
    const calls = stub(() => json(valid({ name_match_result: 'DIRECT_MATCH' })));
    await new CashfreePanAdapter({ ...cfg, env: 'production', apiVersion: '2022-10-26' }).verify({
      pan: ' abcpv1234d ',
      name: "  Maria  D'Souza (Jr.) ",
    });
    expect(calls[0]?.url).toBe('https://api.cashfree.com/verification/pan');
    expect((calls[0]?.init.headers as Record<string, string>)['x-api-version']).toBe('2022-10-26');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      pan: PAN,
      name: 'Maria D Souza Jr.',
    });
    expect(CASHFREE_VERIFICATION_BASE_URL).toEqual({
      sandbox: 'https://sandbox.cashfree.com/verification',
      production: 'https://api.cashfree.com/verification',
    });
  });

  it('with a public key every request carries x-cf-signature = Base64(RSA-OAEP-SHA1("<clientId>.<unix seconds>"))', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const calls = stub(() => json(valid({ name_match_result: 'DIRECT_MATCH' })));
    // the env form: one line with literal \n
    await new CashfreePanAdapter({
      ...cfg,
      publicKeyPem: publicKey.replace(/\n/g, '\\n'),
      nowSec: () => 1_794_300_000,
    }).verify({ pan: PAN, name: NAME });
    const sig = (calls[0]?.init.headers as Record<string, string>)['x-cf-signature'] as string;
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const plain = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
      Buffer.from(sig, 'base64'),
    ).toString('utf8');
    expect(plain).toBe(`${CLIENT_ID}.1794300000`);
    expect(cashfreeSignature(CLIENT_ID, publicKey, 1)).not.toBe(
      cashfreeSignature(CLIENT_ID, publicKey, 1),
    ); // OAEP is randomised
    expect(logged.join('\n')).not.toContain(sig);
    expectNothingSensitive();
  });

  it("Cashfree's own name-match result decides: DIRECT / GOOD_PARTIAL → VERIFIED; MODERATE / POOR / NO_MATCH → MISMATCH", async () => {
    for (const [result, status] of [
      ['DIRECT_MATCH', 'VERIFIED'],
      ['GOOD_PARTIAL_MATCH', 'VERIFIED'],
      ['MODERATE_PARTIAL_MATCH', 'MISMATCH'],
      ['POOR_PARTIAL_MATCH', 'MISMATCH'],
      ['NO_MATCH', 'MISMATCH'],
    ] as const) {
      // the registered name is the same in every case: the provider's result wins over the local comparison
      stub(() => json(valid({ name_match_result: result })));
      const r = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME });
      expect(r).toEqual({ status, providerRef: '161' });
      expectNothingSensitive(r);
    }
  });

  it('without a provider result the registered name is compared with the strict rule — and never returned or logged', async () => {
    stub(() => json(valid({ registered_name: 'SHARMA  RAJESH KUMAR' })));
    const ok = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: 'rajesh kumar sharma' });
    expect(ok).toEqual({ status: 'VERIFIED', providerRef: '161' });

    stub(() => json(valid({ registered_name: OTHER_REGISTERED, name_match_result: '-' })));
    const no = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME });
    expect(no).toEqual({ status: 'MISMATCH', providerRef: '161' });
    expect(Object.keys(no).sort()).toEqual(['providerRef', 'status']);
    expectNothingSensitive(ok, no);
  });

  it('valid PAN but nothing to compare the name with → UNAVAILABLE (never VERIFIED on a guess); no name asked → VERIFIED on validity', async () => {
    stub(() => json({ pan: PAN, reference_id: 162, valid: true }));
    expect(await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME })).toEqual({
      status: 'UNAVAILABLE',
      providerRef: '162',
    });
    const calls = stub(() => json({ pan: PAN, reference_id: 163, valid: true }));
    expect(await new CashfreePanAdapter(cfg).verify({ pan: PAN })).toEqual({
      status: 'VERIFIED',
      providerRef: '163',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ pan: PAN });
    expectNothingSensitive();
  });

  it('invalid / not found / deactivated PAN → FAILED with the provider reference', async () => {
    stub(() =>
      json({
        pan: PAN,
        reference_id: 17974435,
        name_provided: null,
        valid: false,
        message: 'Invalid PAN',
        name_match_score: 0,
        name_match_result: '-',
        pan_status_code: 'N',
      }),
    );
    const r = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME });
    expect(r).toEqual({ status: 'FAILED', providerRef: '17974435' });
    stub(() => json(valid({ pan_status: 'DEACTIVATED', name_match_result: 'DIRECT_MATCH' })));
    expect((await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME })).status).toBe(
      'FAILED',
    );
    expectNothingSensitive(r);
  });

  it('a PAN that is not PAN-shaped is FAILED without calling the provider; a 400 about the PAN is FAILED too', async () => {
    const calls = stub(() => json({}));
    expect(await new CashfreePanAdapter(cfg).verify({ pan: 'ABC123', name: NAME })).toEqual({
      status: 'FAILED',
      providerRef: null,
    });
    expect(calls).toHaveLength(0);
    stub(() =>
      json(
        { type: 'validation_error', code: 'pan_length_short', message: 'Enter valid PAN.' },
        400,
      ),
    );
    expect(await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME })).toEqual({
      status: 'FAILED',
      providerRef: null,
    });
    expectNothingSensitive();
  });

  it('auth, 2FA, wallet, rate limit, server errors and odd bodies are all UNAVAILABLE — never FAILED — with one attempt', async () => {
    const cases: Array<[() => Response, string]> = [
      [
        () =>
          json(
            {
              type: 'authentication_error',
              code: 'authentication_failed',
              message: 'Invalid clientId and clientSecret combination',
            },
            401,
          ),
        'CASHFREE_VERIFICATION_CLIENT_ID',
      ],
      [
        () =>
          json(
            {
              type: 'authentication_error',
              code: 'ip_validation_failed',
              message: 'IP not whitelisted your current ip is 106.51.91.104.',
            },
            403,
          ),
        'IP whitelist',
      ],
      [
        () =>
          json(
            {
              type: 'validation_error',
              code: 'authentication_failed',
              message: 'x-cf-signature missing in the request header',
            },
            403,
          ),
        'CASHFREE_VERIFICATION_PUBLIC_KEY',
      ],
      [
        () =>
          json(
            {
              type: 'validation_error',
              code: 'insufficient_balance',
              message: 'Insufficient balance to process this request',
            },
            422,
          ),
        'recharge',
      ],
      [
        () =>
          json(
            {
              type: 'rate_limit_error',
              code: 'too_many_requests_per_ip',
              message: 'Too many requests from the IP, rate limit reached',
            },
            429,
          ),
        'HTTP 429 too_many_requests_per_ip',
      ],
      [
        () =>
          json(
            {
              type: 'internal_error',
              code: 'verification_failed',
              message: 'Unable to validate, please retry later',
            },
            500,
          ),
        'HTTP 500',
      ],
      [
        () =>
          json(
            {
              type: 'internal_error',
              code: 'verification_failed',
              message: 'Authorised source is temporarily unavailable',
            },
            502,
          ),
        'HTTP 502',
      ],
      [
        () =>
          json(
            {
              type: 'validation_error',
              code: 'x-client-secret_value_invalid',
              message: 'Client secret belongs to test environment',
            },
            400,
          ),
        'different environments',
      ],
      [() => new Response('<html>Bad gateway</html>', { status: 200 }), 'HTTP 200'],
      [
        () => json({ pan: PAN, reference_id: 5, registered_name: REGISTERED }),
        'without a `valid` flag',
      ],
      [
        () => json({ type: 'x', code: 'whatever', message: `echo ${PAN} ${NAME} ${SECRET}` }, 418),
        'HTTP 418',
      ],
    ];
    for (const [res, logHint] of cases) {
      logged.length = 0;
      const calls = stub(res);
      const r = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME });
      expect(r.status).toBe('UNAVAILABLE');
      expect(calls).toHaveLength(1); // no automatic retry
      expect(logged.join('\n')).toContain(logHint);
      expect(logged.join('\n')).not.toContain('106.51.91.104'); // provider messages are never logged
      expectNothingSensitive(r);
    }
  });

  it('timeout: aborts, one attempt, UNAVAILABLE', async () => {
    const calls = stub(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const r = await new CashfreePanAdapter({ ...cfg, timeoutMs: 20 }).verify({
      pan: PAN,
      name: NAME,
    });
    expect(r).toEqual({ status: 'UNAVAILABLE', providerRef: null });
    expect(calls).toHaveLength(1);
    expect(logged.join('\n')).toContain('no answer within 20 ms');
    expect(CASHFREE_TIMEOUT_MS).toBe(10_000);
    expectNothingSensitive(r);
  });

  it('network error → UNAVAILABLE; the underlying message is not logged', async () => {
    stub(() => {
      throw new TypeError(`fetch failed for ${PAN} ${NAME} ${SECRET}`);
    });
    const r = await new CashfreePanAdapter(cfg).verify({ pan: PAN, name: NAME });
    expect(r).toEqual({ status: 'UNAVAILABLE', providerRef: null });
    expect(logged.join('\n')).toContain('network error (TypeError)');
    expectNothingSensitive(r);
  });
});

describe('KYC_PROVIDER / PAN_PROVIDER = cashfree boot validation', () => {
  const keys = {
    CASHFREE_VERIFICATION_CLIENT_ID: 'CF1',
    CASHFREE_VERIFICATION_CLIENT_SECRET: 's',
    CASHFREE_VERIFICATION_ENV: 'sandbox' as const,
  };
  const mock = { KYC_PROVIDER: 'mock' as const, PAN_PROVIDER: 'mock' as const };

  it('refuses to boot without the keys and names every missing one (never a value)', () => {
    expect(() =>
      assertVerificationProvidersConfigured({ ...mock, PAN_PROVIDER: 'cashfree' }),
    ).toThrow(
      'PAN_PROVIDER=cashfree needs CASHFREE_VERIFICATION_CLIENT_ID, CASHFREE_VERIFICATION_CLIENT_SECRET, CASHFREE_VERIFICATION_ENV (see DOCS/runbooks/09-kyc-pan-provider.md)',
    );
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        KYC_PROVIDER: 'cashfree',
        API_PUBLIC_URL: 'https://api.kbs.test',
      }),
    ).toThrow('KYC_PROVIDER=cashfree needs CASHFREE_VERIFICATION_CLIENT_ID');
    expect(() =>
      assertVerificationProvidersConfigured({
        KYC_PROVIDER: 'cashfree',
        PAN_PROVIDER: 'cashfree',
        ...keys,
        CASHFREE_VERIFICATION_CLIENT_SECRET: '  ',
      }),
    ).toThrow(
      'KYC_PROVIDER=cashfree / PAN_PROVIDER=cashfree needs CASHFREE_VERIFICATION_CLIENT_SECRET',
    );
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        PAN_PROVIDER: 'cashfree',
        ...keys,
        CASHFREE_VERIFICATION_ENV: '',
      }),
    ).toThrow('needs CASHFREE_VERIFICATION_ENV');
    try {
      assertVerificationProvidersConfigured({
        ...mock,
        PAN_PROVIDER: 'cashfree',
        ...keys,
        CASHFREE_VERIFICATION_CLIENT_SECRET: SECRET,
        CASHFREE_VERIFICATION_CLIENT_ID: undefined,
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain(SECRET);
    }
  });

  it('production never runs on sandbox keys', () => {
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        PAN_PROVIDER: 'cashfree',
        ...keys,
        NODE_ENV: 'production',
      }),
    ).toThrow('needs CASHFREE_VERIFICATION_ENV=production');
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        PAN_PROVIDER: 'cashfree',
        ...keys,
        CASHFREE_VERIFICATION_ENV: 'production',
        NODE_ENV: 'production',
      }),
    ).not.toThrow();
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        PAN_PROVIDER: 'cashfree',
        ...keys,
        NODE_ENV: 'staging',
      }),
    ).not.toThrow();
  });

  it('DigiLocker needs an https API_PUBLIC_URL; PAN alone does not', () => {
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        KYC_PROVIDER: 'cashfree',
        ...keys,
        API_PUBLIC_URL: 'http://localhost:4000',
      }),
    ).toThrow('KYC_PROVIDER=cashfree needs API_PUBLIC_URL to be the public https URL');
    expect(() =>
      assertVerificationProvidersConfigured({ ...mock, KYC_PROVIDER: 'cashfree', ...keys }),
    ).toThrow('API_PUBLIC_URL');
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        KYC_PROVIDER: 'cashfree',
        ...keys,
        API_PUBLIC_URL: 'https://api.kbs.test',
      }),
    ).not.toThrow();
    expect(() =>
      assertVerificationProvidersConfigured({
        ...mock,
        PAN_PROVIDER: 'cashfree',
        ...keys,
        API_PUBLIC_URL: 'http://localhost:4000',
      }),
    ).not.toThrow();
  });

  it('a public key must be a readable RSA PEM (literal \\n accepted); the value is never echoed', () => {
    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const base = { ...mock, PAN_PROVIDER: 'cashfree' as const, ...keys };
    expect(() =>
      assertVerificationProvidersConfigured({
        ...base,
        CASHFREE_VERIFICATION_PUBLIC_KEY: publicKey,
      }),
    ).not.toThrow();
    expect(() =>
      assertVerificationProvidersConfigured({
        ...base,
        CASHFREE_VERIFICATION_PUBLIC_KEY: publicKey.replace(/\n/g, '\\n'),
      }),
    ).not.toThrow();
    expect(() =>
      assertVerificationProvidersConfigured({ ...base, CASHFREE_VERIFICATION_PUBLIC_KEY: '' }),
    ).not.toThrow();
    try {
      assertVerificationProvidersConfigured({
        ...base,
        CASHFREE_VERIFICATION_PUBLIC_KEY: 'not-a-key-VALUE',
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain(
        'CASHFREE_VERIFICATION_PUBLIC_KEY is not a readable RSA public key',
      );
      expect((e as Error).message).not.toContain('not-a-key-VALUE');
    }
  });

  it('mock needs nothing; schema: mock stays the default, unknown providers and environments are refused', () => {
    expect(() => assertVerificationProvidersConfigured(mock)).not.toThrow();
    const base = {
      DATABASE_URL: 'postgresql://x',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      DATA_ENCRYPTION_KEY: 'c'.repeat(44),
    };
    const d = EnvSchema.parse(base);
    expect(d.KYC_PROVIDER).toBe('mock');
    expect(d.PAN_PROVIDER).toBe('mock');
    expect(d.CASHFREE_VERIFICATION_ENV).toBeUndefined();
    expect(d.CASHFREE_VERIFICATION_API_VERSION).toBe('2024-08-01');
    expect(
      EnvSchema.safeParse({
        ...base,
        KYC_PROVIDER: 'cashfree',
        PAN_PROVIDER: 'cashfree',
        CASHFREE_VERIFICATION_ENV: 'production',
      }).success,
    ).toBe(true);
    expect(EnvSchema.safeParse({ ...base, CASHFREE_VERIFICATION_ENV: '' }).success).toBe(true);
    expect(EnvSchema.safeParse({ ...base, KYC_PROVIDER: 'digio' }).success).toBe(false);
    expect(EnvSchema.safeParse({ ...base, PAN_PROVIDER: 'nsdl' }).success).toBe(false);
    expect(EnvSchema.safeParse({ ...base, CASHFREE_VERIFICATION_ENV: 'live' }).success).toBe(false);
  });
});
