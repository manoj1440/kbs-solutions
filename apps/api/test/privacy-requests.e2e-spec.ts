import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const ADVISOR_MOBILE = '9333300077';
const ACCOUNT_NUMBER = '123456789012';

describe('F-908 data-principal requests and data download (DPDP-01…06)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let advisor: { accessToken: string; user: { id: string } };
  let telecaller: string;
  let erasureId: string;
  const api = () => request(app.getHttpServer());
  const file = (token: string, body: object) => api().post('/api/v1/privacy/requests').set(auth(token)).set('idempotency-key', idem()).send(body);

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    const m = await setupManagerAndTelecaller(app, prisma, '90801');
    telecaller = (await loginAs(app, prisma, m.telecallerMobile)).accessToken;
    // a brand-new Advisor: onboarding not finished, every gate still closed
    const req = await api().post('/api/v1/auth/otp/request').send({ mobile: ADVISOR_MOBILE, purpose: 'ADVISOR_SIGNUP' }).expect(201);
    const v = await api().post('/api/v1/auth/otp/verify').set('user-agent', 'KBSApp/1.0 (Android 15)').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201);
    advisor = v.body.data;
    expect(v.body.data.user.status).toBe('PENDING_ONBOARDING');
  });
  afterAll(async () => app.close());

  it('DPDP-01 a pending Advisor files an erasure request (no gate blocks it) and sees it with its status', async () => {
    const r = await file(advisor.accessToken, { type: 'ERASURE', details: 'Please delete my account.' }).expect(201);
    erasureId = r.body.data.id;
    expect(r.body.data).toMatchObject({ type: 'ERASURE', status: 'OPEN', provenance: 'KBS_OPERATIONAL', resolutionNote: null });
    expect(r.body.data.publicRef).toMatch(/^KBS-DR-[0-9A-HJKMNP-TV-Z]{8}$/);
    const due = new Date(r.body.data.dueAt).getTime() - new Date(r.body.data.createdAt).getTime();
    expect(Math.round(due / 86_400_000)).toBe(30);
    const mine = await api().get('/api/v1/privacy/requests/mine').set(auth(advisor.accessToken)).expect(200);
    expect(mine.body.data.map((x: { id: string }) => x.id)).toEqual([erasureId]);
    expect(mine.body.data[0]).not.toHaveProperty('staffNote');
    // the Admin is told, by reference only
    const n = await prisma.notification.findFirstOrThrow({ where: { kind: 'DATA_REQUEST' } });
    expect(n.body).toContain(r.body.data.publicRef);
    expect(n.body).not.toContain(ADVISOR_MOBILE);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'privacy.request.create', entityId: erasureId } });
    expect(audit.actorUserId).toBe(advisor.user.id);
  });

  it('DPDP-02 a second active request of the same type is refused; other types and validation', async () => {
    const dup = await file(advisor.accessToken, { type: 'ERASURE' }).expect(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    await file(advisor.accessToken, { type: 'ACCESS' }).expect(201);
    // correction and grievance need the user's words
    await file(advisor.accessToken, { type: 'CORRECTION', details: 'short' }).expect(400);
    await file(advisor.accessToken, { type: 'CORRECTION', details: 'x'.repeat(2001) }).expect(400);
    await file(advisor.accessToken, { type: 'NOMINATION' }).expect(400);
    await file(advisor.accessToken, { type: 'GRIEVANCE', details: 'My payout was late by a month.', extra: 1 }).expect(400);
    // parallel duplicates: the partial unique index lets exactly one through
    const burst = await Promise.all([1, 2, 3].map(() => file(telecaller, { type: 'GRIEVANCE', details: 'The calling list repeats numbers.' })));
    expect(burst.map((b) => b.status).sort()).toEqual([201, 409, 409]);
  });

  it('DPDP-03 another user cannot read or change the request; non-Admins have no queue', async () => {
    const mine = await api().get('/api/v1/privacy/requests/mine').set(auth(telecaller)).expect(200);
    expect(mine.body.data.map((x: { id: string }) => x.id)).not.toContain(erasureId);
    await api().get(`/api/v1/privacy/requests/${erasureId}`).set(auth(telecaller)).expect(403);
    await api().get(`/api/v1/privacy/requests/${erasureId}`).set(auth(advisor.accessToken)).expect(403);
    await api().get('/api/v1/privacy/requests').set(auth(advisor.accessToken)).expect(403);
    await api().patch(`/api/v1/privacy/requests/${erasureId}`).set(auth(telecaller)).send({ status: 'REJECTED', resolutionNote: 'not allowed to do this' }).expect(403);
    await api().get('/api/v1/privacy/requests/mine').expect(401);
  });

  it('DPDP-04 the Admin lists, takes, notes and closes a request; closed is final', async () => {
    const list = await api().get('/api/v1/privacy/requests?type=ERASURE&queue=open').set(auth(admin)).expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ id: erasureId, status: 'OPEN', overdue: false, requester: { id: advisor.user.id, role: 'ADVISOR' }, handledBy: null });
    expect(list.body.data[0].requester.mobileMasked).not.toContain(ADVISOR_MOBILE);
    expect(list.body.meta.counts.OPEN).toBeGreaterThanOrEqual(3);
    await api().get('/api/v1/privacy/requests?status=DONE').set(auth(admin)).expect(400);
    await api().get('/api/v1/privacy/requests/00000000-0000-7000-8000-000000000000').set(auth(admin)).expect(404);

    const taken = await api().patch(`/api/v1/privacy/requests/${erasureId}`).set(auth(admin)).send({ status: 'IN_PROGRESS', staffNote: 'Checking payout records first.' }).expect(200);
    expect(taken.body.data).toMatchObject({ status: 'IN_PROGRESS', staffNote: 'Checking payout records first.', handledBy: { fullName: 'Test Admin' } });
    // a note is required to close
    await api().patch(`/api/v1/privacy/requests/${erasureId}`).set(auth(admin)).send({ status: 'COMPLETED' }).expect(400);
    await api().patch(`/api/v1/privacy/requests/${erasureId}`).set(auth(admin)).send({ status: 'OPEN' }).expect(409);
    const done = await api()
      .patch(`/api/v1/privacy/requests/${erasureId}`)
      .set(auth(admin))
      .send({ status: 'COMPLETED', resolutionNote: 'Account closed. Payout records kept for 8 years as tax law requires.' })
      .expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.closedAt).toBeTruthy();
    await api().patch(`/api/v1/privacy/requests/${erasureId}`).set(auth(admin)).send({ status: 'REJECTED', resolutionNote: 'changed my mind on this one' }).expect(409);
    // nothing was deleted: the user row and the request stay
    expect(await prisma.user.count({ where: { id: advisor.user.id } })).toBe(1);

    const mine = await api().get('/api/v1/privacy/requests/mine').set(auth(advisor.accessToken)).expect(200);
    expect(mine.body.data.find((x: { id: string }) => x.id === erasureId)).toMatchObject({ status: 'COMPLETED', resolutionNote: expect.stringContaining('Account closed') });
    expect(mine.body.data.find((x: { id: string }) => x.id === erasureId)).not.toHaveProperty('staffNote');
    // a new erasure request is allowed once the old one is closed
    await file(advisor.accessToken, { type: 'ERASURE' }).expect(201);
    const audits = await prisma.auditLog.findMany({ where: { action: 'privacy.request.update', entityId: erasureId }, orderBy: { at: 'asc' } });
    expect(audits.map((a) => (a.after as { status: string }).status)).toEqual(['IN_PROGRESS', 'COMPLETED']);
    expect(await prisma.notification.count({ where: { recipientUserId: advisor.user.id, kind: 'DATA_REQUEST' } })).toBe(1);
  });

  it('DPDP-05 consent is unbundled: both scopes recorded, the IP stored as a hash with the user agent; old app bodies still work', async () => {
    const t = auth(advisor.accessToken);
    const p = await api().put('/api/v1/onboarding/me/personal').set(t).send({ fullName: 'Priya Privacy', email: 'priya@example.com' }).expect(200);
    const version = p.body.data.privacyNoticeVersion as string;
    // only one scope ticked → refused
    await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: version, identityConsent: true, termsAccepted: true, scopes: ['IDENTITY_VERIFICATION'] }).expect(400);
    await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: version, identityConsent: true, termsAccepted: true, scopes: ['IDENTITY_VERIFICATION', 'PRIVACY_NOTICE_AND_TERMS'] }).expect(200);
    let prof = await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: advisor.user.id } });
    const recs = prof.consentRecords as Array<Record<string, unknown>>;
    expect(recs[0]).toMatchObject({ scopes: ['IDENTITY_VERIFICATION', 'PRIVACY_NOTICE_AND_TERMS'], userAgent: 'KBSApp/1.0 (Android 15)' });
    expect(recs[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(recs[0]).not.toHaveProperty('ip');
    // an app version already in the field sends only the two booleans
    await prisma.advisorProfile.update({ where: { userId: advisor.user.id }, data: { onboardingStep: 'CONSENT' } });
    await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: version, identityConsent: true, termsAccepted: true }).expect(200);
    prof = await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: advisor.user.id } });
    expect((prof.consentRecords as Array<{ scopes: string[] }>)[1].scopes).toEqual(['IDENTITY_VERIFICATION', 'PRIVACY_NOTICE_AND_TERMS']);
  });

  it('DPDP-06 the data download holds the caller’s own data, masked, and is audited', async () => {
    const t = auth(advisor.accessToken);
    const start = await api().post('/api/v1/onboarding/me/identity/start').set(t).expect(201);
    await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef: start.body.data.identity.sessionRef, payload: 'MOCK_OK' }).expect(201);
    await api().put('/api/v1/onboarding/me/bank').set(t).send({ accountHolderName: 'Priya Privacy', accountNumber: ACCOUNT_NUMBER, ifsc: 'HDFC0001234', bankName: 'HDFC Bank' }).expect(200);
    const prof = await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: advisor.user.id } });
    expect(prof.bankAccountEncrypted).toBeTruthy();

    const r = await api().get('/api/v1/privacy/me/export').set(t).expect(200);
    const x = r.body.data;
    const text = JSON.stringify(x);
    expect(x.format).toBe('kbs-personal-data/v1');
    expect(x.profile).toMatchObject({ fullName: 'Priya Privacy', email: 'priya@example.com', role: 'ADVISOR', status: 'PENDING_ONBOARDING' });
    expect(x.payeeProfile.bank).toEqual({ bankName: 'HDFC Bank', ifsc: 'HDFC0001234', accountLast4: '9012', accountHolderName: 'Priya Privacy' });
    expect(x.payeeProfile.consents).toHaveLength(2);
    expect(x.payeeProfile.consents[0].scopes).toEqual(['IDENTITY_VERIFICATION', 'PRIVACY_NOTICE_AND_TERMS']);
    expect(x.sessions[0]).toMatchObject({ platform: 'ANDROID', active: true });
    expect(x.dataRequests.length).toBe(3);
    expect(Array.isArray(x.leads)).toBe(true);
    expect(Array.isArray(x.payoutRequests)).toBe(true);
    // never plaintext numbers, ciphertext, the full mobile or consent hashes
    expect(text).not.toContain(ACCOUNT_NUMBER);
    expect(text).not.toContain(prof.bankAccountEncrypted as string);
    expect(text).not.toContain(ADVISOR_MOBILE);
    expect(text).not.toContain('ipHash');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'privacy.export', actorUserId: advisor.user.id } });
    expect(audit.entityId).toBe(advisor.user.id);
    // every role can download its own data; the Telecaller sees only theirs
    const tx = await api().get('/api/v1/privacy/me/export').set(auth(telecaller)).expect(200);
    expect(tx.body.data.profile.role).toBe('TELECALLER');
    expect(tx.body.data.payeeProfile).toBeNull();
    expect(JSON.stringify(tx.body.data)).not.toContain('Priya');
  });
});
