import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const ADVISOR_MOBILE = '9333300001';

describe('F-401 Advisor onboarding / F-402 Agent Code (FOS-01, FOS-02)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let adv: { accessToken: string; user: { id: string } };

  async function signup(mobile: string) {
    const req = await api().post('/api/v1/auth/otp/request').send({ mobile, purpose: 'ADVISOR_SIGNUP' }).expect(201);
    const v = await api().post('/api/v1/auth/otp/verify').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201);
    return v.body.data as { accessToken: string; user: { id: string; status: string }; gates: { onboarding: { required: boolean; complete: boolean; step: string } } };
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
  });
  afterAll(async () => app.close());

  it('schema guard: no Aadhaar-like column exists and no API body accepts one', async () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'packages', 'db', 'prisma', 'schema.prisma'), 'utf8');
    const cols = schema.split('\n').filter((l) => /^\s+\w*aadha?ar\w*\s/i.test(l));
    expect(cols).toEqual([]);
    const dbCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`select column_name from information_schema.columns where column_name ilike '%aadha%'`);
    expect(dbCols).toEqual([]);
  });

  it('FOS-01: signup → steps in order (resumable) → mock identity → bank/cheque → submit → Admin approves → Advisor active', async () => {
    const s = await signup(ADVISOR_MOBILE);
    adv = s;
    expect(s.user.status).toBe('PENDING_ONBOARDING');
    expect(s.gates.onboarding).toMatchObject({ required: true, complete: false, step: 'PERSONAL' });
    const t = auth(adv.accessToken);
    // order enforced: bank before personal → 409
    await api().put('/api/v1/onboarding/me/bank').set(t).send({ accountHolderName: 'Asha', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC' }).expect(409);
    const p = await api().put('/api/v1/onboarding/me/personal').set(t).send({ fullName: 'Asha Advisor', email: 'asha@example.com' }).expect(200);
    expect(p.body.data.step).toBe('CONSENT');
    // unknown/PII keys rejected by strict schemas
    await api().put('/api/v1/onboarding/me/personal').set(t).send({ fullName: 'Asha Advisor', email: 'asha@example.com', aadhaarNumber: '123412341234' }).expect(400);
    // wrong notice version rejected
    await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: 'old', identityConsent: true, termsAccepted: true }).expect(400);
    const c = await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: p.body.data.privacyNoticeVersion, identityConsent: true, termsAccepted: true }).expect(200);
    expect(c.body.data.consent.privacyNoticeVersion).toBe(p.body.data.privacyNoticeVersion);
    expect(c.body.data.step).toBe('IDENTITY');
    // resume: GET reflects current step
    const me = await api().get('/api/v1/onboarding/me').set(t).expect(200);
    expect(me.body.data).toMatchObject({ step: 'IDENTITY', personal: { fullName: 'Asha Advisor' } });

    const start = await api().post('/api/v1/onboarding/me/identity/start').set(t).expect(201);
    const sessionRef = start.body.data.identity.sessionRef as string;
    expect(sessionRef).toMatch(/^kyc-/);
    expect(start.body.data.identity.status).toBe('PENDING');
    // identity payload carrying an Aadhaar-looking field is refused before it reaches the provider
    await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef, payload: { aadhaar: '123412341234' } }).expect(400);
    await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef, payload: '123412341234' }).expect(400);
    // provider failure keeps the step with retry
    const bad = await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef, payload: 'NOPE' }).expect(400);
    expect(bad.body.error.details.status).toBe('FAILED');
    expect((await api().get('/api/v1/onboarding/me').set(t).expect(200)).body.data).toMatchObject({ step: 'IDENTITY', identity: { status: 'FAILED' } });
    const ok = await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef, payload: 'MOCK_OK' }).expect(201);
    expect(ok.body.data).toMatchObject({ step: 'BANK', identity: { status: 'VERIFIED', provider: 'mock', summary: { verifiedNameMatch: true } } });
    const prof = await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: adv.user.id } });
    expect(JSON.stringify(prof)).not.toContain('123412341234');

    await api().put('/api/v1/onboarding/me/bank').set(t).send({ accountHolderName: 'Asha Advisor', accountNumber: '12ab', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' }).expect(400);
    const bank = await api().put('/api/v1/onboarding/me/bank').set(t).send({ accountHolderName: 'Asha Advisor', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' }).expect(200);
    expect(bank.body.data.bank).toEqual({ accountHolderName: 'Asha Advisor', accountLast4: '9012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' });
    expect(JSON.stringify(bank.body)).not.toContain('123456789012');
    const stored = await prisma.advisorProfile.findUniqueOrThrow({ where: { userId: adv.user.id } });
    expect(stored.bankAccountEncrypted).not.toContain('123456789012');

    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const up = await api().post('/api/v1/files/cheque').set(t).attach('file', png, { filename: 'cheque.png', contentType: 'image/png' }).expect(201);
    const ch = await api().put('/api/v1/onboarding/me/cheque').set(t).send({ fileId: up.body.data.id }).expect(200);
    expect(ch.body.data.step).toBe('AGENT_CODE');

    // FOS-02: blank code → Admin stays the reporting person
    const ac = await api().put('/api/v1/onboarding/me/agent-code').set(t).send({}).expect(200);
    expect(ac.body.data.step).toBe('REVIEW');
    expect(ac.body.data.reportingParent.role).toBe('ADMIN');

    // submit → awaiting review; gates still closed; steps locked
    const sub = await api().post('/api/v1/onboarding/me/submit').set(t).set('idempotency-key', idem()).expect(201);
    expect(sub.body.data.step).toBe('AWAITING_REVIEW');
    await api().put('/api/v1/onboarding/me/bank').set(t).send({ accountHolderName: 'Xy', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'Xy' }).expect(409);
    const meAfter = await api().get('/api/v1/auth/me').set(t).expect(200);
    expect(meAfter.body.data.gates.onboarding).toMatchObject({ complete: false, step: 'AWAITING_REVIEW' });
    // gated Advisor route (catalogue availability requires onboarding) → 403
    await api().post('/api/v1/share').set(t).set('idempotency-key', idem()).send({ targetType: 'LEAD', targetId: adv.user.id, kind: 'OFFICE_ID' }).expect(403);

    // Admin review queue + detail (masked; reveal logged)
    const q = await api().get('/api/v1/onboarding/review').set(auth(adminToken)).expect(200);
    expect(q.body.data.map((r: { userId: string }) => r.userId)).toEqual([adv.user.id]);
    const d = await api().get(`/api/v1/onboarding/review/${adv.user.id}`).set(auth(adminToken)).expect(200);
    expect(d.body.data.bank.accountLast4).toBe('9012');
    expect(d.body.data.bankAccountNumber).toBeNull();
    const rev = await api().get(`/api/v1/onboarding/review/${adv.user.id}?reveal=bank`).set(auth(adminToken)).expect(200);
    expect(rev.body.data.bankAccountNumber).toBe('123456789012');
    expect(await prisma.sensitiveAccessLog.count({ where: { field: 'BANK_ACCOUNT' } })).toBe(1);
    // Manager cannot review
    const mgr = await setupManagerAndTelecaller(app, prisma, '60001');
    await api().get('/api/v1/onboarding/review').set(auth(mgr.manager.accessToken)).expect(403);

    // reject → back to REVIEW with reason, can fix + resubmit; approve → ACTIVE + gate open
    await api().post(`/api/v1/onboarding/review/${adv.user.id}`).set(auth(adminToken)).set('idempotency-key', idem()).send({ decision: 'REJECT' }).expect(400);
    const rej = await api().post(`/api/v1/onboarding/review/${adv.user.id}`).set(auth(adminToken)).set('idempotency-key', idem()).send({ decision: 'REJECT', reason: 'cheque image unreadable' }).expect(201);
    expect(rej.body.data).toMatchObject({ step: 'REVIEW', review: { outcome: 'REJECTED', reason: 'cheque image unreadable' } });
    const up2 = await api().post('/api/v1/files/cheque').set(t).attach('file', png, { filename: 'cheque2.png', contentType: 'image/png' }).expect(201);
    await api().put('/api/v1/onboarding/me/cheque').set(t).send({ fileId: up2.body.data.id }).expect(200);
    await api().post('/api/v1/onboarding/me/submit').set(t).set('idempotency-key', idem()).expect(201);
    const appr = await api().post(`/api/v1/onboarding/review/${adv.user.id}`).set(auth(adminToken)).set('idempotency-key', idem()).send({ decision: 'APPROVE' }).expect(201);
    expect(appr.body.data.step).toBe('COMPLETE');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: adv.user.id } });
    expect(user.status).toBe('ACTIVE');
    const final = await api().get('/api/v1/auth/me').set(t).expect(200);
    expect(final.body.data.gates.onboarding).toMatchObject({ complete: true, step: 'COMPLETE' });
    expect(await prisma.notification.count({ where: { recipientUserId: adv.user.id, kind: 'ONBOARDING_APPROVED' } })).toBe(1);
    // re-submit after completion is a no-op; edits locked
    await api().put('/api/v1/onboarding/me/personal').set(t).send({ fullName: 'New Name', email: 'x@y.com' }).expect(409);
  });

  it('FOS-02: valid Agent Code during signup switches reporting to the Manager; invalid code leaves it unchanged', async () => {
    const mgr = await setupManagerAndTelecaller(app, prisma, '60002');
    const code = await api().post('/api/v1/agent-codes').set(auth(adminToken)).set('idempotency-key', idem()).send({ ownerUserId: mgr.managerId }).expect(201);
    const s = await signup('9333300002');
    const t = auth(s.accessToken);
    await api().put('/api/v1/onboarding/me/personal').set(t).send({ fullName: 'Bala Advisor', email: 'bala@example.com' }).expect(200);
    const v = (await api().get('/api/v1/onboarding/me').set(t).expect(200)).body.data;
    await api().put('/api/v1/onboarding/me/consent').set(t).send({ privacyNoticeVersion: v.privacyNoticeVersion, identityConsent: true, termsAccepted: true }).expect(200);
    const start = await api().post('/api/v1/onboarding/me/identity/start').set(t).expect(201);
    await api().post('/api/v1/onboarding/me/identity/complete').set(t).send({ sessionRef: start.body.data.identity.sessionRef, payload: 'MOCK_OK' }).expect(201);
    await api().put('/api/v1/onboarding/me/bank').set(t).send({ accountHolderName: 'Bala', accountNumber: '9876543210', ifsc: 'ICIC0000001', bankName: 'ICICI' }).expect(200);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const up = await api().post('/api/v1/files/cheque').set(t).attach('file', png, { filename: 'c.png', contentType: 'image/png' }).expect(201);
    await api().put('/api/v1/onboarding/me/cheque').set(t).send({ fileId: up.body.data.id }).expect(200);
    // invalid → 400-family error, reporting unchanged
    const bad = await api().put('/api/v1/onboarding/me/agent-code').set(t).send({ code: 'NOPE1234' });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect((await api().get('/api/v1/onboarding/me').set(t).expect(200)).body.data).toMatchObject({ step: 'AGENT_CODE', reportingParent: { role: 'ADMIN' } });
    // live validation endpoint does not expose the owner name
    const val = await api().get(`/api/v1/agent-codes/validate?code=${code.body.data.code}`).set(t).expect(200);
    expect(val.body.data.valid).toBe(true);
    expect(JSON.stringify(val.body)).not.toContain(`Manager 60002`);
    const good = await api().put('/api/v1/onboarding/me/agent-code').set(t).send({ code: code.body.data.code }).expect(200);
    expect(good.body.data.reportingParent).toMatchObject({ id: mgr.managerId, role: 'MANAGER' });
    expect(good.body.data.step).toBe('REVIEW');
  });
});
