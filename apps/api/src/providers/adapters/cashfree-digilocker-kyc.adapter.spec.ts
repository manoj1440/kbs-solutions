import { generateKeyPairSync } from 'node:crypto';

import { Logger } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';

import { CashfreeDigilockerKycAdapter } from './cashfree-digilocker-kyc.adapter';
import { MockKycAdapter } from './mock-kyc.adapter';

const CLIENT_ID = 'CF10000TESTCLIENT';
const SECRET = 'cfsk_ma_test_SECRET_0001';
const NOW = new Date('2026-11-11T06:30:00.000Z'); // 12:00 IST
const cfg = {
  env: 'sandbox' as const,
  clientId: CLIENT_ID,
  clientSecret: SECRET,
  apiPublicUrl: 'https://api.kbs.test/',
  now: () => NOW,
};
const SESSION = 'kbs-0123456789abcdef0123456789abcdef';
const FULL_NAME = 'Mallesh Fakkirappa Dollin';
const DIGILOCKER_URL = 'https://verification-test.cashfree.com/dgl/h7562ci7us0';

/** Everything Cashfree returns about the person; none of it may leave the adapter. */
const PII = {
  uid: 'xxxxxxxx5647',
  care_of: 'S/O: Fakkirappa Dollin',
  dob: '02-02-1995',
  gender: 'M',
  name: 'Mallesh Fakkirappa Dollin',
  photo_link: '/9j/4AAQSkZJRgABAgAAAQABAAD/2wBDAAgGBgcGBQgHB',
  split_address: {
    country: 'India',
    dist: 'Haveri',
    house: 'Shri Kanaka Nilaya',
    landmark: '',
    pincode: '581115',
    po: 'Ranebennur',
    state: 'Karnataka',
    street: 'Umashankar Nagar 1st Main 5th Cross',
    subdist: 'Ranibennur',
    vtc: 'Ranibennur',
  },
  year_of_birth: 1995,
  xml_file: 'https://files.cashfree.test/aadhaar-xml-48h.zip',
};
const SENSITIVE = [
  PII.uid,
  '5647',
  PII.care_of,
  'Fakkirappa',
  'Dollin',
  'Mallesh',
  'MALLESH',
  PII.dob,
  '1995',
  PII.photo_link,
  '581115',
  'Haveri',
  'Kanaka',
  'Umashankar',
  PII.xml_file,
  '9999999999',
  SECRET,
  CLIENT_ID,
  DIGILOCKER_URL,
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const statusBody = (status: string, extra: Record<string, unknown> = {}) => ({
  user_details:
    status === 'AUTHENTICATED'
      ? { name: PII.name, dob: PII.dob, gender: 'M', eaadhaar: 'Y', mobile: '9999999999' }
      : {},
  status,
  document_requested: ['AADHAAR'],
  document_consent: status === 'AUTHENTICATED' ? ['AADHAAR'] : null,
  document_consent_validity: null,
  verification_id: SESSION,
  reference_id: 12345,
  ...extra,
});
const docBody = (extra: Record<string, unknown> = {}) => ({
  reference_id: 408,
  verification_id: SESSION,
  status: 'SUCCESS',
  ...PII,
  message: 'Aadhaar Card Exists',
  ...extra,
});

describe('CashfreeDigilockerKycAdapter', () => {
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

  /** Responses are served in order: the status call, then the document call. */
  const stub = (
    ...responses: Array<(url: string, init: RequestInit) => Promise<Response> | Response>
  ) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      const respond = responses[calls.length];
      calls.push({ url, init });
      if (!respond) throw new Error('unexpected extra request');
      return respond(url, init);
    }) as unknown as typeof fetch;
    return calls;
  };
  const expectNothingSensitive = (...returned: unknown[]) => {
    // KBS-generated session ids are random hex and may legitimately appear; they are taken out before looking for fragments
    const all = [
      ...logged,
      ...returned.map((r) =>
        r instanceof Error ? `${r.message} ${JSON.stringify(r)}` : JSON.stringify(r),
      ),
    ]
      .join('\n')
      .replace(/kbs-[0-9a-f]{32}/g, 'kbs-<id>');
    for (const s of SENSITIVE) expect(all).not.toContain(s);
  };
  const complete = (
    adapter = new CashfreeDigilockerKycAdapter(cfg),
    payload: unknown = { fullName: FULL_NAME },
  ) => adapter.complete({ sessionRef: SESSION, payload });

  describe('start', () => {
    it('creates an Aadhaar-only DigiLocker session with a KBS-generated id and returns the DigiLocker URL', async () => {
      const calls = stub(() =>
        json({
          verification_id: 'x',
          reference_id: 12345,
          url: DIGILOCKER_URL,
          status: 'PENDING',
          document_requested: ['AADHAAR'],
          redirect_url: 'https://api.kbs.test/api/v1/onboarding/identity/return',
          user_flow: 'signup',
        }),
      );
      const adapter = new CashfreeDigilockerKycAdapter(cfg);
      const r = await adapter.start({
        userId: 'user-42',
        consentAt: new Date('2026-11-10T10:00:00Z'),
        fullName: FULL_NAME,
      });

      expect(adapter.name).toBe('cashfree');
      expect(adapter.method).toBe('DIGILOCKER_AADHAAR');
      expect(r.sessionRef).toMatch(/^kbs-[0-9a-f]{32}$/);
      expect(r.sessionRef.length).toBeLessThanOrEqual(50);
      expect(r.actionUrl).toBe(DIGILOCKER_URL);
      expect(r.instructions).toBe(
        "Open DigiLocker, sign in and allow KBS Solutions to verify your Aadhaar. Then come back and tap 'I have completed verification'.",
      );
      expect(Object.keys(r).sort()).toEqual(['actionUrl', 'instructions', 'sessionRef']);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe('https://sandbox.cashfree.com/verification/digilocker');
      expect(calls[0]?.init.method).toBe('POST');
      expect(calls[0]?.init.headers).toEqual({
        'x-client-id': CLIENT_ID,
        'x-client-secret': SECRET,
        accept: 'application/json',
        'content-type': 'application/json',
      });
      const sent = JSON.parse(String(calls[0]?.init.body));
      expect(sent).toEqual({
        verification_id: r.sessionRef,
        document_requested: ['AADHAAR'],
        redirect_url: 'https://api.kbs.test/api/v1/onboarding/identity/return',
        user_flow: 'signup',
        company_name: 'KBS Solutions',
      });
      // nothing about the person goes to Cashfree at start
      expect(String(calls[0]?.init.body)).not.toContain('user-42');
      expect(String(calls[0]?.init.body)).not.toContain('Mallesh');
      expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
      expect(logged.join('\n')).toContain(`session ${r.sessionRef} created (ref 12345)`);
      expectNothingSensitive(); // the DigiLocker URL is not logged either
    });

    it('two sessions never share an id; production uses api.cashfree.com; a public key adds x-cf-signature', async () => {
      const { publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const ok = () => json({ reference_id: 1, url: DIGILOCKER_URL, status: 'PENDING' });
      const calls = stub(ok, ok);
      const adapter = new CashfreeDigilockerKycAdapter({
        ...cfg,
        env: 'production',
        publicKeyPem: publicKey,
      });
      const a = await adapter.start({ userId: 'u', consentAt: NOW });
      const b = await adapter.start({ userId: 'u', consentAt: NOW });
      expect(a.sessionRef).not.toBe(b.sessionRef);
      expect(calls[0]?.url).toBe('https://api.cashfree.com/verification/digilocker');
      expect((calls[0]?.init.headers as Record<string, string>)['x-cf-signature']).toMatch(
        /^[A-Za-z0-9+/]+=*$/,
      );
    });

    it('any provider problem → one attempt and a retry-later app error that says nothing about the provider', async () => {
      const responses: Array<() => Response> = [
        () =>
          json(
            {
              type: 'authentication_error',
              code: 'authentication_failed',
              message: 'Invalid clientId and clientSecret combination',
            },
            401,
          ),
        () =>
          json(
            {
              type: 'authentication_error',
              code: 'ip_validation_failed',
              message: 'IP not whitelisted your current ip is 106.51.91.104.',
            },
            403,
          ),
        () => new Response('Not Found', { status: 404 }), // DigiLocker not activated on the account
        () =>
          json(
            {
              type: 'validation_error',
              code: 'redirect_url_value_invalid',
              message: 'redirect_url should start with https.',
            },
            400,
          ),
        () =>
          json(
            {
              type: 'validation_error',
              code: 'insufficient_balance',
              message: 'Insufficient balance to process this request',
            },
            422,
          ),
        () =>
          json(
            {
              type: 'rate_limit_error',
              code: 'too_many_requests_per_operation',
              message: 'rate limit reached',
            },
            429,
          ),
        () =>
          json(
            {
              type: 'internal_error',
              code: 'verification_failed',
              message: 'something went wrong',
            },
            500,
          ),
        () => json({ reference_id: 1, status: 'PENDING' }), // 200 without a url
        () => json({ reference_id: 1, url: 'http://not-https.example/dgl/x', status: 'PENDING' }),
      ];
      for (const res of responses) {
        const calls = stub(res);
        const e = await new CashfreeDigilockerKycAdapter(cfg)
          .start({ userId: 'u', consentAt: NOW })
          .then(
            () => null,
            (err: unknown) => err,
          );
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).code).toBe('RATE_LIMITED');
        expect((e as AppError).recovery).toBe('RETRY_LATER');
        expect((e as AppError).message).not.toMatch(/cashfree|digilocker|whitelist|balance/i);
        expect(calls).toHaveLength(1);
        expectNothingSensitive(e);
      }
      expect(logged.join('\n')).toContain('HTTP 403 ip_validation_failed');
      expect(logged.join('\n')).toContain('is this product activated');
      expect(logged.join('\n')).not.toContain('106.51.91.104');
    });

    it('timeout and network error → retry-later app error', async () => {
      stub(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      );
      await expect(
        new CashfreeDigilockerKycAdapter({ ...cfg, timeoutMs: 20 }).start({
          userId: 'u',
          consentAt: NOW,
        }),
      ).rejects.toBeInstanceOf(AppError);
      expect(logged.join('\n')).toContain('no answer within 20 ms');
      stub(() => {
        throw new TypeError(`fetch failed ${SECRET}`);
      });
      await expect(
        new CashfreeDigilockerKycAdapter(cfg).start({ userId: 'u', consentAt: NOW }),
      ).rejects.toBeInstanceOf(AppError);
      expect(logged.join('\n')).toContain('network error (TypeError)');
      expectNothingSensitive();
    });
  });

  describe('complete', () => {
    it('authenticated + name matches + adult → VERIFIED; exact requests; only { method, verifiedNameMatch, ageBand } leaves the adapter', async () => {
      const calls = stub(
        () => json(statusBody('AUTHENTICATED')),
        () => json(docBody()),
      );
      const r = await complete();
      expect(r).toEqual({
        status: 'VERIFIED',
        providerRef: '408',
        evidenceSummary: {
          method: 'DIGILOCKER_AADHAAR',
          verifiedNameMatch: true,
          ageBand: 'ADULT',
        },
      });

      expect(calls).toHaveLength(2);
      expect(calls[0]?.url).toBe(
        `https://sandbox.cashfree.com/verification/digilocker?verification_id=${SESSION}`,
      );
      expect(calls[1]?.url).toBe(
        `https://sandbox.cashfree.com/verification/digilocker/document/AADHAAR?verification_id=${SESSION}`,
      );
      for (const c of calls) {
        expect(c.init.method).toBe('GET');
        expect(c.init.headers).toEqual({
          'x-client-id': CLIENT_ID,
          'x-client-secret': SECRET,
          accept: 'application/json',
        });
        expect(c.init.body).toBeUndefined();
        expect(c.url).not.toContain('Mallesh'); // the name is compared locally, never sent
      }
      expect(logged.join('\n')).toContain(`session ${SESSION} VERIFIED (ref 408)`);
      expectNothingSensitive(r);
    });

    it('not finished on DigiLocker → PENDING, the document is not requested', async () => {
      const calls = stub(() => json(statusBody('PENDING')));
      const r = await complete();
      expect(r).toEqual({
        status: 'PENDING',
        providerRef: SESSION,
        evidenceSummary: { method: 'DIGILOCKER_AADHAAR' },
      });
      expect(calls).toHaveLength(1);
    });

    it('document still being fetched (202 validation_pending) → PENDING', async () => {
      stub(
        () => json(statusBody('AUTHENTICATED')),
        () =>
          json(
            {
              type: 'validation_error',
              code: 'validation_pending',
              message: 'Validation in process check after some time',
            },
            202,
          ),
      );
      expect((await complete()).status).toBe('PENDING');
      expectNothingSensitive();
    });

    it('expired link / consent denied → FAILED with a reason code and no document request', async () => {
      for (const [state, reason] of [
        ['EXPIRED', 'LINK_EXPIRED'],
        ['CONSENT_DENIED', 'CONSENT_DENIED'],
      ] as const) {
        const calls = stub(() => json(statusBody(state)));
        const r = await complete();
        expect(r).toEqual({
          status: 'FAILED',
          providerRef: '12345',
          evidenceSummary: {
            method: 'DIGILOCKER_AADHAAR',
            verifiedNameMatch: null,
            ageBand: null,
            reason,
          },
        });
        expect(calls).toHaveLength(1);
        expectNothingSensitive(r);
      }
    });

    it('document errors that are about the person → FAILED with a reason code', async () => {
      for (const [res, reason] of [
        [
          () =>
            json(
              {
                type: 'validation_error',
                code: 'url_expired',
                message: 'Digilocker request URL is expired',
              },
              400,
            ),
          'LINK_EXPIRED',
        ],
        [
          () =>
            json(
              {
                type: 'validation_error',
                code: 'session_expired',
                message: 'Digilocker consent session expired',
              },
              400,
            ),
          'CONSENT_SESSION_EXPIRED',
        ],
        [
          () =>
            json(
              {
                type: 'validation_error',
                code: 'consent_not_granted',
                message: 'Consent not provided for document',
              },
              400,
            ),
          'DOCUMENT_CONSENT_NOT_GIVEN',
        ],
        [
          () =>
            json(
              {
                type: 'validation_error',
                code: 'user_detail_mismatch',
                message: "PAN card name of the user doesn't match with that in Aadhaar card",
              },
              400,
            ),
          'PROVIDER_DETAIL_MISMATCH',
        ],
        [
          () =>
            json({
              reference_id: 408,
              verification_id: SESSION,
              status: 'AADHAAR_NOT_LINKED',
              name: null,
              dob: null,
              uid: null,
            }),
          'DOCUMENT_NOT_LINKED',
        ],
        [
          () =>
            json(
              {
                type: 'not_found_error',
                code: 'verification_id_value_invalid',
                message: 'Please enter a valid verification_id',
              },
              404,
            ),
          'SESSION_NOT_FOUND',
        ],
      ] as const) {
        stub(() => json(statusBody('AUTHENTICATED')), res);
        const r = await complete();
        expect(r.status).toBe('FAILED');
        expect(r.evidenceSummary).toEqual({
          method: 'DIGILOCKER_AADHAAR',
          verifiedNameMatch: null,
          ageBand: null,
          reason,
        });
        expectNothingSensitive(r);
      }
    });

    it('a session Cashfree does not know → FAILED; a malformed session id is never sent', async () => {
      stub(() =>
        json(
          {
            type: 'not_found_error',
            code: 'verification_id_value_invalid',
            message: 'Please enter a valid verification_id',
          },
          404,
        ),
      );
      expect((await complete()).evidenceSummary.reason).toBe('SESSION_NOT_FOUND');
      const calls = stub();
      const r = await new CashfreeDigilockerKycAdapter(cfg).complete({
        sessionRef: 'kbs 123&x=1',
        payload: { fullName: FULL_NAME },
      });
      expect(r.status).toBe('FAILED');
      expect(calls).toHaveLength(0);
      expect(logged.join('\n')).not.toContain('kbs 123');
    });

    it('name on the document differs from the profile name → FAILED NAME_MISMATCH (the document name is not revealed)', async () => {
      stub(
        () => json(statusBody('AUTHENTICATED')),
        () => json(docBody()),
      );
      const r = await complete(undefined, { fullName: 'Rakesh Verma' });
      expect(r).toEqual({
        status: 'FAILED',
        providerRef: '408',
        evidenceSummary: {
          method: 'DIGILOCKER_AADHAAR',
          verifiedNameMatch: false,
          ageBand: 'ADULT',
          reason: 'NAME_MISMATCH',
        },
      });
      expectNothingSensitive(r);
      expect(logged.join('\n')).not.toContain('Rakesh');
    });

    it('name comparison uses the shared rule: case, spacing, dots and word order do not matter', async () => {
      stub(
        () => json(statusBody('AUTHENTICATED')),
        () => json(docBody()),
      );
      expect(
        (await complete(undefined, { fullName: '  dollin  MALLESH fakkirappa. ' })).status,
      ).toBe('VERIFIED');
    });

    it('age: under 18 on the day → MINOR; the 18th birthday itself (India time) → ADULT; no usable date → AGE_UNKNOWN', async () => {
      const run = async (doc: Record<string, unknown>, now = NOW) => {
        stub(
          () => json(statusBody('AUTHENTICATED')),
          () => json(docBody(doc)),
        );
        const r = await complete(new CashfreeDigilockerKycAdapter({ ...cfg, now: () => now }));
        return [r.status, r.evidenceSummary.ageBand, r.evidenceSummary.reason];
      };
      expect(await run({ dob: '12-11-2008' })).toEqual(['FAILED', 'MINOR', 'MINOR']); // 18 tomorrow
      expect(await run({ dob: '11-11-2008' })).toEqual(['VERIFIED', 'ADULT', undefined]); // 18 today
      // 20:00 UTC on the 10th is already the 11th in India
      expect(await run({ dob: '11-11-2008' }, new Date('2026-11-10T20:00:00.000Z'))).toEqual([
        'VERIFIED',
        'ADULT',
        undefined,
      ]);
      expect(await run({ dob: '11-11-2008' }, new Date('2026-11-10T12:00:00.000Z'))).toEqual([
        'FAILED',
        'MINOR',
        'MINOR',
      ]);
      expect(await run({ dob: '1995-02-02' })).toEqual(['VERIFIED', 'ADULT', undefined]);
      // only a year: decided only when every birthday in that year gives the same answer
      expect(await run({ dob: null, year_of_birth: 2000 })).toEqual([
        'VERIFIED',
        'ADULT',
        undefined,
      ]);
      expect(await run({ dob: '', year_of_birth: 2012 })).toEqual(['FAILED', 'MINOR', 'MINOR']);
      expect(await run({ dob: undefined, year_of_birth: 2008 })).toEqual([
        'FAILED',
        null,
        'AGE_UNKNOWN',
      ]);
      expect(await run({ dob: '31-02-1990', year_of_birth: null })).toEqual([
        'FAILED',
        null,
        'AGE_UNKNOWN',
      ]);
      expectNothingSensitive();
    });

    it('document without a name → FAILED NAME_NOT_READABLE; no profile name supplied → FAILED PROFILE_NAME_MISSING without calling the provider', async () => {
      stub(
        () => json(statusBody('AUTHENTICATED')),
        () => json(docBody({ name: '  ' })),
      );
      expect((await complete()).evidenceSummary).toEqual({
        method: 'DIGILOCKER_AADHAAR',
        verifiedNameMatch: null,
        ageBand: 'ADULT',
        reason: 'NAME_NOT_READABLE',
      });
      for (const payload of [
        undefined,
        null,
        'MOCK_OK',
        {},
        { fullName: '  ' },
        { fullName: 42 },
      ]) {
        const calls = stub();
        const r = await new CashfreeDigilockerKycAdapter(cfg).complete({
          sessionRef: SESSION,
          payload,
        });
        expect(r).toEqual({
          status: 'FAILED',
          providerRef: SESSION,
          evidenceSummary: {
            method: 'DIGILOCKER_AADHAAR',
            verifiedNameMatch: null,
            ageBand: null,
            reason: 'PROFILE_NAME_MISSING',
          },
        });
        expect(calls).toHaveLength(0);
      }
    });

    it('provider problems on either call → UNAVAILABLE (never FAILED), no retry, providerRef stays the session id', async () => {
      const problems: Array<() => Response> = [
        () =>
          json(
            {
              type: 'authentication_error',
              code: 'authentication_failed',
              message: 'Invalid clientId and clientSecret combination',
            },
            401,
          ),
        () =>
          json(
            {
              type: 'authentication_error',
              code: 'ip_validation_failed',
              message: 'IP not whitelisted your current ip is 106.51.91.104.',
            },
            403,
          ),
        () => new Response('Not Found', { status: 404 }),
        () =>
          json(
            {
              type: 'validation_error',
              code: 'insufficient_balance',
              message: 'Insufficient balance',
            },
            422,
          ),
        () =>
          json(
            {
              type: 'rate_limit_error',
              code: 'too_many_requests_per_ip',
              message: 'rate limit reached',
            },
            429,
          ),
        () =>
          json(
            {
              type: 'internal_error',
              code: 'verification_failed',
              message: 'something went wrong',
            },
            500,
          ),
        () =>
          json(
            {
              type: 'internal_error',
              code: 'verification_failed',
              message: 'Authorised source is temporarily unavailable',
            },
            502,
          ),
        () =>
          json(
            {
              type: 'validation_error',
              code: 'invalid_request',
              message: 'Please provide verification_id or reference_id',
            },
            400,
          ),
        () => new Response('<html>oops</html>', { status: 200 }),
        () => json({ ...docBody(), ...statusBody('SOMETHING_NEW'), status: 'SOMETHING_NEW' }),
      ];
      const expected = {
        status: 'UNAVAILABLE',
        providerRef: SESSION,
        evidenceSummary: { method: 'DIGILOCKER_AADHAAR' },
      };
      for (const res of problems) {
        const first = stub(res);
        const a = await complete();
        expect(a).toEqual(expected);
        expect(first).toHaveLength(1);
        const second = stub(() => json(statusBody('AUTHENTICATED')), res);
        const b = await complete();
        expect(b).toEqual(expected);
        expect(second).toHaveLength(2);
        expectNothingSensitive(a, b);
      }
      expect(logged.join('\n')).toContain('status: HTTP 401 authentication_failed');
      expect(logged.join('\n')).toContain('document: HTTP 502 verification_failed');
      expect(logged.join('\n')).not.toContain('106.51.91.104');
    });

    it('timeout / network error on either call → UNAVAILABLE', async () => {
      const hang = (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      const boom = () => {
        throw new TypeError(`fetch failed ${SECRET} ${PII.uid}`);
      };
      const fast = new CashfreeDigilockerKycAdapter({ ...cfg, timeoutMs: 20 });
      stub(hang);
      expect((await complete(fast)).status).toBe('UNAVAILABLE');
      stub(() => json(statusBody('AUTHENTICATED')), hang);
      expect((await complete(fast)).status).toBe('UNAVAILABLE');
      stub(boom);
      expect((await complete()).status).toBe('UNAVAILABLE');
      stub(() => json(statusBody('AUTHENTICATED')), boom);
      expect((await complete()).status).toBe('UNAVAILABLE');
      expect(logged.join('\n')).toContain('no answer within 20 ms');
      expect(logged.join('\n')).toContain('network error (TypeError)');
      expectNothingSensitive();
    });
  });
});

describe('MockKycAdapter (behaviour unchanged by the port additions)', () => {
  it('still completes only with payload MOCK_OK and returns no actionUrl', async () => {
    const mock = new MockKycAdapter();
    const s = await mock.start({
      userId: 'u1',
      consentAt: new Date('2026-11-10T10:00:00Z'),
      fullName: 'Any Name',
    });
    expect(s.sessionRef).toMatch(/^kyc-/);
    expect(s).not.toHaveProperty('actionUrl');
    expect(s.instructions).not.toContain('Any Name');
    expect(await mock.complete({ sessionRef: s.sessionRef, payload: 'MOCK_OK' })).toEqual({
      status: 'VERIFIED',
      providerRef: s.sessionRef,
      evidenceSummary: {
        method: 'MOCK_OFFLINE_VERIFICATION',
        verifiedNameMatch: true,
        ageBand: 'ADULT',
      },
    });
    expect(
      (await mock.complete({ sessionRef: s.sessionRef, payload: { fullName: 'Any Name' } })).status,
    ).toBe('FAILED');
  });
});
