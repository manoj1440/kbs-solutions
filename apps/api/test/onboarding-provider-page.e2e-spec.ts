import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { KYC_PROVIDER, type KycProvider } from '../src/providers/ports';

import { auth, bootTestApp, resetDatabase } from './helpers';

type Complete = Awaited<ReturnType<KycProvider['complete']>>;

/**
 * Identity providers that verify on their own page (DigiLocker): the app opens `actionUrl`, the Advisor comes back and
 * the result is read from the provider. A stand-in provider replaces the mock; nothing here calls a real vendor.
 */
describe('FOS-01 identity on the provider page (REQ-10 §10.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  const api = () => request(app.getHttpServer());
  let next: Complete;
  const seenPayloads: unknown[] = [];

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const kyc = app.get<KycProvider>(KYC_PROVIDER) as unknown as Record<string, unknown>;
    Object.defineProperty(kyc, 'name', { value: 'standin' });
    Object.defineProperty(kyc, 'method', { value: 'DIGILOCKER_AADHAAR' });
    kyc.start = async () => ({ sessionRef: 'kbs-session-1', instructions: 'Open the page.', actionUrl: 'https://provider.example.test/consent' });
    kyc.complete = async (input: { sessionRef: string; payload: unknown }) => {
      seenPayloads.push(input.payload);
      return next;
    };
  });
  afterAll(async () => app.close());

  it('start returns the page to open; pending records nothing; a failure explains itself; verified advances with outcome only', async () => {
    const req = await api().post('/api/v1/auth/otp/request').send({ mobile: '9333300077', purpose: 'ADVISOR_SIGNUP' }).expect(201);
    const login = (await api().post('/api/v1/auth/otp/verify').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201)).body.data;
    const t = auth(login.accessToken);
    await api().put('/api/v1/onboarding/me/personal').set(t).send({ fullName: 'Asha Advisor', email: 'asha@example.com' }).expect(200);
    const me = (await api().get('/api/v1/onboarding/me').set(t).expect(200)).body.data;
    await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: me.privacyNoticeVersion ?? 'v1-draft', identityConsent: true, termsAccepted: true }).expect(200);

    const started = (await api().post('/api/v1/onboarding/me/identity/start').set(t).send({}).expect(201)).body.data;
    expect(started.identity).toMatchObject({ status: 'PENDING', sessionRef: 'kbs-session-1', actionUrl: 'https://provider.example.test/consent' });

    // not finished on the provider's page: 409, nothing recorded, same session still usable
    next = { status: 'PENDING', providerRef: 'kbs-session-1', evidenceSummary: { method: 'DIGILOCKER_AADHAAR' } };
    const pending = await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef: 'kbs-session-1' }).expect(409);
    expect(pending.body.error.details).toMatchObject({ status: 'PENDING' });
    expect(await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: login.user.id } })).toMatchObject({ identityStatus: 'PENDING', identityProviderRef: 'kbs-session-1', identityVerifiedAt: null });
    // the provider gets the profile name to match against — never anything the client typed
    expect(seenPayloads.at(-1)).toEqual({ fullName: 'Asha Advisor' });

    // name on the document differs: clear message, step does not advance
    next = { status: 'FAILED', providerRef: 'kbs-session-1', evidenceSummary: { method: 'DIGILOCKER_AADHAAR', verifiedNameMatch: false, ageBand: 'ADULT', reason: 'NAME_MISMATCH' } };
    const failed = await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef: 'kbs-session-1' }).expect(400);
    expect(failed.body.error.message).toMatch(/does not match the name you entered/);
    expect(failed.body.error.details).toMatchObject({ status: 'FAILED', reason: 'NAME_MISMATCH' });
    expect((await api().get('/api/v1/onboarding/me').set(t).expect(200)).body.data.step).toBe('IDENTITY');

    // verified: only outcome, provider reference, method and time are stored; anything identity-like in the summary is dropped
    await api().post('/api/v1/onboarding/me/identity/start').set(t).send({}).expect(201);
    next = { status: 'VERIFIED', providerRef: '987654', evidenceSummary: { method: 'DIGILOCKER_AADHAAR', verifiedNameMatch: true, ageBand: 'ADULT', aadhaarNumber: '123412341234', photoLink: 'https://x', leaked: '1234 1234 1234' } };
    const ok = (await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef: 'kbs-session-1' }).expect(201)).body.data;
    expect(ok.step).toBe('BANK');
    const profile = await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: login.user.id } });
    expect(profile).toMatchObject({ identityStatus: 'VERIFIED', identityProvider: 'standin', identityMethod: 'DIGILOCKER_AADHAAR', identityProviderRef: '987654' });
    expect(profile.identityEvidenceSummary).toEqual({ method: 'DIGILOCKER_AADHAAR', verifiedNameMatch: true, ageBand: 'ADULT' });
    expect(JSON.stringify(profile)).not.toMatch(/1234\s?1234\s?1234/);
  });

  it('the return page is public, carries no data and sets no cookie', async () => {
    const r = await api().get('/api/v1/onboarding/identity/return?verification_id=kbs-session-1').expect(200);
    expect(r.headers['content-type']).toMatch(/text\/html/);
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(r.text).toMatch(/I have completed verification/);
    expect(r.text).not.toMatch(/kbs-session-1/);
  });
});
