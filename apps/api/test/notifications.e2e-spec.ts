import { containsSensitive, makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import type { MockPushAdapter } from '../src/providers/adapters/mock-push.adapter';
import { PUSH_PROVIDER } from '../src/providers/ports';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const TOKEN = 'ExponentPushToken[abcdefghijklmnop1234]';

describe('F-701 notifications: scrubbing, push, dedupe, read state, deep-link re-check (NOTIF-01/02)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let svc: NotificationsService;
  let push: MockPushAdapter;
  let adminId: string;
  let managerToken: string;
  let managerId: string;
  let telecallerId: string;
  let advToken: string;
  let advId: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    svc = app.get(NotificationsService);
    push = app.get(PUSH_PROVIDER);
    await loginAs(app, prisma, ADMIN_MOBILE);
    adminId = (await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).id;
    const m = await setupManagerAndTelecaller(app, prisma, '93001');
    managerToken = m.manager.accessToken;
    managerId = m.managerId;
    telecallerId = m.telecallerId;
    const a = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999801', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Notif Advisor' } });
    advId = a.id;
    await prisma.reportingAssignment.create({ data: { childUserId: a.id, parentUserId: managerId, source: 'AGENT_CODE', status: 'ACTIVE' } });
    advToken = (await loginAs(app, prisma, '9555999801')).accessToken;
  });
  afterAll(async () => app.close());

  it('NOTIF-02: PAN, account-like numbers and mobiles never reach stored or pushed text', async () => {
    await api().post('/api/v1/notifications/push-devices').set(auth(advToken)).send({ token: TOKEN }).expect(201);
    await api().post('/api/v1/notifications/push-devices').set(auth(advToken)).send({ token: 'not-a-token' }).expect(400);
    push.sent.length = 0;
    await svc.notify({ recipientUserId: advId, kind: 'PAYOUT_PAID', title: 'Paid to 123456789012', body: 'PAN ABCDE1234F, mobile 9876543210, account 1234 5678 9012 3456 — ₹1,500 for KBS-PR-AB12CD34', deepLink: { entityType: 'PayoutRequest', entityId: '00000000-0000-7000-8000-000000000000' }, dedupeKey: 'test:scrub:1' });
    const n = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: 'test:scrub:1' } });
    expect(containsSensitive(`${n.title} ${n.body}`)).toBe(false);
    expect(n.body).toContain('₹1,500');
    expect(n.body).toContain('KBS-PR-AB12CD34');
    // pushed once, with the scrubbed text only, and pushedAt recorded
    expect(push.sent).toEqual([{ token: TOKEN, title: n.title }]);
    expect(n.pushedAt).not.toBeNull();
    // dedupe: the same event again → no second row, no second push
    await svc.notify({ recipientUserId: advId, kind: 'PAYOUT_PAID', title: 'x', body: 'y', dedupeKey: 'test:scrub:1' });
    expect(await prisma.notification.count({ where: { dedupeKey: 'test:scrub:1' } })).toBe(1);
    expect(push.sent).toHaveLength(1);
    // every notification produced so far by real flows is clean too
    for (const x of await prisma.notification.findMany()) expect(containsSensitive(`${x.title} ${x.body}`)).toBe(false);
  });

  it('read state: unread count, mark one, mark all; other users cannot touch mine', async () => {
    await svc.notify({ recipientUserId: advId, kind: 'ANNOUNCEMENT', title: 'Two', body: 'b', dedupeKey: 'test:read:2' });
    const list = (await api().get('/api/v1/notifications?unreadOnly=true').set(auth(advToken)).expect(200)).body;
    expect(list.meta.unread).toBe(2);
    expect(list.data).toHaveLength(2);
    expect((await api().get('/api/v1/notifications/unread-count').set(auth(advToken)).expect(200)).body.data.unread).toBe(2);
    await api().post(`/api/v1/notifications/${list.data[0].id}/read`).set(auth(managerToken)).expect(404);
    await api().post(`/api/v1/notifications/${list.data[0].id}/read`).set(auth(advToken)).expect(201);
    expect((await api().get('/api/v1/notifications/unread-count').set(auth(advToken)).expect(200)).body.data.unread).toBe(1);
    expect((await api().post('/api/v1/notifications/read-all').set(auth(advToken)).expect(201)).body.data.updated).toBe(1);
    expect((await api().get('/api/v1/notifications/unread-count').set(auth(advToken)).expect(200)).body.data.unread).toBe(0);
  });

  it('deep link re-checks scope at open time: after reassignment the old Manager gets NOT_FOUND', async () => {
    const hdfc = await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } });
    const card = await prisma.creditCard.create({ data: { bankId: hdfc.id, name: 'HDFC N', status: 'PUBLISHED' } });
    const lead = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advId, reportingParentUserIdSnapshot: managerId, bankId: hdfc.id, cardId: card.id, customerFullName: 'Cust N', customerMobile: '+919555800001', pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    const who = await svc.leadAudience(lead.id);
    expect(who).toEqual({ advisorUserId: advId, managerUserId: managerId, adminUserId: adminId });
    await svc.notifyMany([who.advisorUserId, who.managerUserId, who.adminUserId, adminId], { kind: 'MIS_CHANGED', title: 'Bank MIS updated', body: 'b', deepLink: { entityType: 'Lead', entityId: lead.id }, dedupeKey: `mis.lead.changed:${lead.id}:test` });
    expect(await prisma.notification.count({ where: { dedupeKey: { startsWith: `mis.lead.changed:${lead.id}:test` } } })).toBe(3); // Admin listed twice → one row
    const mn = await prisma.notification.findFirstOrThrow({ where: { recipientUserId: managerId, kind: 'MIS_CHANGED' } });
    expect((await api().get(`/api/v1/notifications/${mn.id}/target`).set(auth(managerToken)).expect(200)).body.data).toEqual({ entityType: 'Lead', entityId: lead.id });
    // Advisor moves away from this Manager → the old Manager's notification no longer opens the lead
    await prisma.reportingAssignment.updateMany({ where: { childUserId: advId, effectiveTo: null }, data: { effectiveTo: new Date(), status: 'CLOSED' } });
    const fresh = (await loginAs(app, prisma, (await prisma.user.findUniqueOrThrow({ where: { id: managerId } })).mobile.slice(3))).accessToken;
    await api().get(`/api/v1/notifications/${mn.id}/target`).set(auth(fresh)).expect(404);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: mn.id } })).readAt).not.toBeNull();
    await prisma.reportingAssignment.create({ data: { childUserId: advId, parentUserId: managerId, source: 'AGENT_CODE', status: 'ACTIVE' } });
  });

  it('WFH grant/revoke notify the Telecaller and their Manager; OTP lock raises an Admin security event without the full mobile', async () => {
    const wfh = await api().post('/api/v1/access-policy/wfh').set(auth(managerToken)).send({ telecallerUserId: telecallerId, reason: 'field visit' }).expect(201);
    expect((await prisma.notification.findMany({ where: { kind: 'WFH_GRANTED' } })).map((n) => n.recipientUserId).sort()).toEqual([telecallerId, managerId].sort());
    await api().post(`/api/v1/access-policy/wfh/${wfh.body.data.id}/revoke`).set(auth(managerToken)).send({ reason: 'back in office' }).expect(201);
    expect(await prisma.notification.count({ where: { kind: 'WFH_REVOKED' } })).toBe(2);
    // five wrong codes → lock → SECURITY_EVENT for Admin
    await prisma.otpChallenge.deleteMany({ where: { mobile: '+919555999801' } });
    const ch = (await api().post('/api/v1/auth/otp/request').send({ mobile: '9555999801', purpose: 'LOGIN' }).expect(201)).body.data.challengeId;
    for (let i = 0; i < 5; i++) await api().post('/api/v1/auth/otp/verify').send({ challengeId: ch, code: '123456', platform: 'ANDROID' });
    const sec = await prisma.notification.findFirstOrThrow({ where: { kind: 'SECURITY_EVENT', recipientUserId: adminId } });
    expect(sec.body).not.toContain('9555999801');
    expect(sec.body).toContain('9801');
    await prisma.otpChallenge.deleteMany({ where: { mobile: '+919555999801' } });
  });

  it('logout revokes the device: no further pushes to a signed-out phone', async () => {
    push.sent.length = 0;
    const s = await loginAs(app, prisma, '9555999801');
    await api().post('/api/v1/notifications/push-devices').set(auth(s.accessToken)).send({ token: TOKEN }).expect(201); // re-binds the token to this session
    await api().post('/api/v1/auth/logout').set(auth(s.accessToken)).send({}).expect(201);
    await svc.notify({ recipientUserId: advId, kind: 'ANNOUNCEMENT', title: 'after logout', body: 'b', dedupeKey: 'test:after-logout' });
    expect(push.sent).toEqual([]);
    expect(await prisma.notification.count({ where: { dedupeKey: 'test:after-logout' } })).toBe(1); // in-app row still kept
  });
});
