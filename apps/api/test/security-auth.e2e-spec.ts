import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { bootTestApp, resetDatabase } from './helpers';

/** F-908 S1 / S4 / S10: OTP races, public health, the WhatsApp delivery webhook. */
describe('F-908 security: OTP races and public surface (SEC-01..SEC-05)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  const api = () => request(app.getHttpServer());
  const maxAttempts = 5; // auth.otp.maxAttempts default

  async function activeAdvisor(mobile: string) {
    return prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: `+91${mobile}`, role: 'ADVISOR', status: 'ACTIVE', fullName: `Advisor ${mobile}` } });
  }
  async function challengeFor(mobile: string) {
    return (await api().post('/api/v1/auth/otp/request').send({ mobile, purpose: 'LOGIN' }).expect(201)).body.data.challengeId as string;
  }
  const verify = (challengeId: string, code: string) => api().post('/api/v1/auth/otp/verify').send({ challengeId, code, platform: 'ANDROID' });

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    // one listening server for the parallel requests below (supertest would otherwise bind a port per request)
    await app.listen(0);
  });
  afterAll(async () => app.close());

  it('SEC-01: parallel wrong codes evaluate at most maxAttempts guesses on one challenge, then the number is locked', async () => {
    await activeAdvisor('9811100001');
    const challengeId = await challengeFor('9811100001');
    const results = await Promise.all(Array.from({ length: 15 }, () => verify(challengeId, '135792')));
    const codes = results.map((r) => r.body.error?.code as string);
    expect(codes.filter((c) => c === 'AUTH_OTP_INVALID').length).toBeLessThanOrEqual(maxAttempts);
    expect(codes.every((c) => c === 'AUTH_OTP_INVALID' || c === 'AUTH_OTP_LOCKED')).toBe(true);
    expect(codes.filter((c) => c === 'AUTH_OTP_LOCKED').length).toBeGreaterThanOrEqual(15 - maxAttempts);
    expect((await prisma.otpChallenge.findUniqueOrThrow({ where: { id: challengeId } })).attempts).toBe(maxAttempts);
    // even the right code is refused now: the number is locked
    const locked = await verify(challengeId, '000000').expect(429);
    expect(locked.body.error.code).toBe('AUTH_OTP_LOCKED');
    expect(await prisma.session.count({ where: { user: { mobile: '+919811100001' } } })).toBe(0);
  });

  it('SEC-01: unknown numbers get the same treatment (phantom challenge, no account revealed)', async () => {
    const challengeId = await challengeFor('9811100099');
    const results = await Promise.all(Array.from({ length: 10 }, () => verify(challengeId, '000000')));
    expect(results.filter((r) => r.body.error?.code === 'AUTH_OTP_INVALID').length).toBeLessThanOrEqual(maxAttempts);
    expect((await prisma.otpChallenge.findUniqueOrThrow({ where: { id: challengeId } })).attempts).toBe(maxAttempts);
  });

  it('SEC-02: one correct code used twice at the same time creates exactly one session', async () => {
    const user = await activeAdvisor('9811100002');
    const challengeId = await challengeFor('9811100002');
    const results = await Promise.all(Array.from({ length: 5 }, () => verify(challengeId, '000000')));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status !== 201).every((r) => r.body.error.code === 'AUTH_OTP_INVALID')).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    // the spent challenge stays spent
    await verify(challengeId, '000000').expect(400);
  });

  it('SEC-02: a sign-in that succeeds on the last allowed try does not leave the number locked', async () => {
    await activeAdvisor('9811100003');
    const first = await challengeFor('9811100003');
    for (let i = 0; i < maxAttempts - 1; i++) await verify(first, '246801').expect(400);
    await verify(first, '000000').expect(201);
    await prisma.otpChallenge.updateMany({ where: { mobile: '+919811100003' }, data: { createdAt: new Date(Date.now() - 120_000) } }); // past the resend cooldown
    const second = await challengeFor('9811100003');
    await verify(second, '000000').expect(201);
  });

  it('SEC-03: a parallel burst of code requests for one number creates one challenge (one SMS); the rest wait out the cooldown', async () => {
    await activeAdvisor('9811100004');
    const results = await Promise.all(Array.from({ length: 8 }, () => api().post('/api/v1/auth/otp/request').send({ mobile: '9811100004', purpose: 'LOGIN' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of results.filter((x) => x.status !== 201)) {
      expect(r.status).toBe(429);
      expect(r.body.error.code).toBe('AUTH_OTP_RESEND_TOO_SOON');
      expect(r.body.error.details).toMatchObject({ retryAfterSec: expect.any(Number), cooldownSec: 60 });
    }
    expect(await prisma.otpChallenge.count({ where: { mobile: '+919811100004' } })).toBe(1);
  });

  it('SEC-04: public /health says only whether it is up and which commit runs — no queue depths or outbox counts', async () => {
    const h = (await api().get('/api/v1/health').expect(200)).body.data;
    expect(Object.keys(h).sort()).toEqual(['commit', 'db', 'redis', 'status']);
    expect(h).toMatchObject({ status: 'ok', db: true });
  });

  it('SEC-05: the WhatsApp delivery webhook does not exist while sharing is hand-off', async () => {
    await api().post('/api/v1/webhooks/whatsapp/delivery').send({ providerMessageId: 'x', status: 'DELIVERED' }).expect(404);
  });
});
