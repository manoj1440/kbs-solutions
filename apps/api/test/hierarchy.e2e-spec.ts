import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { auth, bootTestApp, idem, resetDatabase, setupManagerAndTelecaller } from './helpers';

/** Advisor self-registration through the real OTP flow. */
async function registerAdvisor(app: INestApplication, prisma: PrismaService['client'], mobile: string) {
  await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${mobile}` } });
  const req = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile, purpose: 'ADVISOR_SIGNUP' }).expect(201);
  const verify = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201);
  return verify.body.data as { accessToken: string; user: { id: string; reportingParent: { id: string; role: string } | null } };
}

describe('F-106 Agent Codes and reporting hierarchy (FOS-02)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('blank code → Advisor reports to the Admin; valid code → code owner; invalid/revoked → unchanged', async () => {
    const { admin, manager } = await setupManagerAndTelecaller(app, prisma, '21');
    const adv = await registerAdvisor(app, prisma, '9555500001');
    expect(adv.user.reportingParent?.role).toBe('ADMIN');

    const code = await request(app.getHttpServer()).post('/api/v1/agent-codes').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ ownerUserId: manager.user.id }).expect(201);
    expect(code.body.data.code).toMatch(/^[A-Z0-9]{8}$/);

    const v1 = await request(app.getHttpServer()).get('/api/v1/agent-codes/validate?code=NOPE1234').set(auth(adv.accessToken)).expect(200);
    expect(v1.body.data.valid).toBe(false);
    const bad = await request(app.getHttpServer()).post('/api/v1/me/agent-code').set(auth(adv.accessToken)).send({ code: 'NOPE1234' }).expect(400);
    expect(bad.body.error.code).toBe('HIERARCHY_CODE_INVALID');

    const applied = await request(app.getHttpServer()).post('/api/v1/me/agent-code').set(auth(adv.accessToken)).send({ code: code.body.data.code.toLowerCase() }).expect(201);
    expect(applied.body.data).toMatchObject({ status: 'APPLIED', reportingParent: { id: manager.user.id } });
    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(adv.accessToken)).expect(200);
    expect(me.body.data.user.reportingParent.id).toBe(manager.user.id);

    // the Manager now sees the Advisor in the team
    const team = await request(app.getHttpServer()).get('/api/v1/users?role=ADVISOR').set(auth(manager.accessToken)).expect(200);
    expect(team.body.data.map((u: { id: string }) => u.id)).toContain(adv.user.id);

    await request(app.getHttpServer()).post(`/api/v1/agent-codes/${code.body.data.id}/revoke`).set(auth(admin.accessToken)).send({ reason: 'manager left' }).expect(201);
    const adv2 = await registerAdvisor(app, prisma, '9555500002');
    const revoked = await request(app.getHttpServer()).post('/api/v1/me/agent-code').set(auth(adv2.accessToken)).send({ code: code.body.data.code }).expect(400);
    expect(revoked.body.error.code).toBe('HIERARCHY_CODE_INVALID');
    const me2 = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(adv2.accessToken)).expect(200);
    expect(me2.body.data.user.reportingParent.role).toBe('ADMIN');
  });

  it('code change after leads exist is PENDING until Admin approves; historical lead snapshot keeps the old parent', async () => {
    const { admin, manager } = await setupManagerAndTelecaller(app, prisma, '22');
    const adv = await registerAdvisor(app, prisma, '9555500003');
    const adminId = admin.user.id;
    // simulate an existing lead attributed to the Admin parent (F-406 will create these through the API)
    const bank = await prisma.bank.findFirstOrThrow({ where: { code: 'HDFC' } });
    const card = await prisma.creditCard.create({ data: { bankId: bank.id, name: 'Test card', status: 'PUBLISHED' } });
    const lead = await prisma.lead.create({
      data: {
        publicRef: 'KBS-L-TESTLEAD',
        advisorUserId: adv.user.id,
        reportingParentUserIdSnapshot: adminId,
        cardId: card.id,
        bankId: bank.id,
        customerFullName: 'C',
        customerMobile: '+919000000001',
        pincode: '302001',
        employmentType: 'SALARIED',
        annualIncomeItr: '500000',
        declarations: [],
        bureauAckAt: new Date(),
        idempotencyKey: 'lead-1',
      },
    });
    const code = await request(app.getHttpServer()).post('/api/v1/agent-codes').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ ownerUserId: manager.user.id, code: 'TEAM22' }).expect(201);
    const pending = await request(app.getHttpServer()).post('/api/v1/me/agent-code').set(auth(adv.accessToken)).send({ code: 'team22' }).expect(201);
    expect(pending.body.data.status).toBe('PENDING_APPROVAL');
    let me = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(adv.accessToken)).expect(200);
    expect(me.body.data.user.reportingParent.id).toBe(adminId);

    const list = await request(app.getHttpServer()).get('/api/v1/hierarchy/pending').set(auth(admin.accessToken)).expect(200);
    const row = list.body.data.find((r: { child: { id: string } }) => r.child.id === adv.user.id);
    expect(row.agentCode.code).toBe('TEAM22');
    await request(app.getHttpServer()).post(`/api/v1/hierarchy/pending/${row.id}/approve`).set(auth(admin.accessToken)).send({ reason: 'approved by admin' }).expect(201);
    me = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(adv.accessToken)).expect(200);
    expect(me.body.data.user.reportingParent.id).toBe(manager.user.id);

    const leadAfter = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(leadAfter.reportingParentUserIdSnapshot).toBe(adminId);
    const hist = await request(app.getHttpServer()).get(`/api/v1/users/${adv.user.id}/reporting-history`).set(auth(adv.accessToken)).expect(200);
    expect(hist.body.data.map((h: { status: string }) => h.status)).toEqual(expect.arrayContaining(['ACTIVE', 'CLOSED']));
    expect(code.body.data.ownerUserId).toBe(manager.user.id);
  });

  it('Admin reassigns a Telecaller to another Manager with a logged reason; Manager cannot', async () => {
    const a = await setupManagerAndTelecaller(app, prisma, '23');
    const b = await setupManagerAndTelecaller(app, prisma, '24');
    await request(app.getHttpServer()).post(`/api/v1/users/${a.telecallerId}/reporting`).set(auth(a.manager.accessToken)).send({ parentUserId: b.managerId, reason: 'x' }).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/users/${a.telecallerId}/reporting`).set(auth(a.admin.accessToken)).send({ parentUserId: b.managerId, reason: 'team merge' }).expect(201);
    const bTeam = await request(app.getHttpServer()).get('/api/v1/users').set(auth(b.manager.accessToken)).expect(200);
    expect(bTeam.body.data.map((u: { id: string }) => u.id)).toContain(a.telecallerId);
    await request(app.getHttpServer()).get(`/api/v1/users/${a.telecallerId}`).set(auth(a.manager.accessToken)).expect(404);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'hierarchy.reassign', entityId: a.telecallerId } });
    expect(audit?.reason).toBe('team merge');
  });
});
