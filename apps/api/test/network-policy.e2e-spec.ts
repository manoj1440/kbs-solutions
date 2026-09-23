import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { auth, bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-301 office network policy over HTTP (SEC-01, REQ-09 §9.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let manager: string;
  let tc: string;
  let tcId: string;
  let otherManager: string;
  const api = () => request(app.getHttpServer());
  const queue = (headers: Record<string, string> = {}) => api().get('/api/v1/calling/queue').set(auth(tc)).set(headers);
  const events = (outcome?: string) => prisma.networkAccessEvent.count({ where: { userId: tcId, ...(outcome ? { outcome: outcome as never } : {}) } });
  const addNet = async (cidr: string) => (await api().post('/api/v1/access-policy/networks').set(auth(admin)).send({ label: cidr, cidr, reason: 'office egress' }).expect(201)).body.data.id as string;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const s = await setupManagerAndTelecaller(app, prisma, '301');
    admin = s.admin.accessToken;
    manager = s.manager.accessToken;
    tcId = s.telecallerId;
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: tcId }, data: { status: 'PASSED', passedAt: new Date() } }); // isolate the network gate
    tc = (await loginAs(app, prisma, s.telecallerMobile)).accessToken;
    otherManager = (await setupManagerAndTelecaller(app, prisma, '302')).manager.accessToken;
  });
  afterAll(async () => app.close());

  it('SEC-01: no allowlist → fail closed (ALLOWLIST_EMPTY); outside the allowlist → denied; every denial is recorded', async () => {
    expect((await queue().expect(403)).body.error).toMatchObject({ code: 'GATE_NETWORK_BLOCKED', recovery: 'CONTACT_ADMIN' });
    await addNet('203.0.113.0/24');
    expect((await queue().expect(403)).body.error).toMatchObject({ code: 'GATE_NETWORK_BLOCKED', recovery: 'USE_OFFICE_WIFI' });
    // X-Forwarded-For is not trusted without TRUST_PROXY_HOPS: a spoofed office IP is still denied
    await queue({ 'x-forwarded-for': '203.0.113.9', 'x-network-ssid-hint': 'KBS-Office' }).expect(403);
    expect(await events('DENIED')).toBe(3);
    const last = await prisma.networkAccessEvent.findFirstOrThrow({ where: { userId: tcId }, orderBy: { at: 'desc' } });
    expect(last).toMatchObject({ outcome: 'DENIED', ssidHint: 'KBS-Office', route: 'GET /api/v1/calling/queue' });
    expect(last.ip).not.toBe('203.0.113.9');
  });

  it('SEC-01: an active WFH exception allows; revoking it blocks the very next request (no cache)', async () => {
    const wfh = (await api().post('/api/v1/access-policy/wfh').set(auth(manager)).send({ telecallerUserId: tcId, reason: 'field visit' }).expect(201)).body.data;
    await api().post('/api/v1/access-policy/wfh').set(auth(otherManager)).send({ telecallerUserId: tcId, reason: 'not my team' }).expect(404);
    await queue().expect(200);
    await queue().expect(200);
    expect(await events('ALLOWED_WFH')).toBe(1); // allowed outcomes sampled to one per 5 min
    await api().post(`/api/v1/access-policy/wfh/${wfh.id}/revoke`).set(auth(manager)).send({ reason: 'back in office' }).expect(201);
    await queue().expect(403);
  });

  it('SEC-01: inside an active office CIDR → allowed (ALLOWED_OFFICE); Advisors and Managers are never evaluated', async () => {
    const loop = await addNet('127.0.0.1/32');
    await queue().expect(200);
    expect(await events('ALLOWED_OFFICE')).toBe(1);
    await api().post(`/api/v1/access-policy/networks/${loop}/active`).set(auth(admin)).send({ active: false, reason: 'test cleanup' }).expect(201);
    await queue().expect(403);
    const before = await prisma.networkAccessEvent.count();
    await api().get('/api/v1/calling/records').set(auth(manager)).expect(200);
    expect(await prisma.networkAccessEvent.count()).toBe(before);
  });

  it('F-301: access events show actor / IP / outcome; Manager sees own team only; Telecaller cannot read them', async () => {
    const all = (await api().get('/api/v1/access-policy/events?outcome=DENIED').set(auth(admin)).expect(200)).body;
    expect(all.meta.total).toBeGreaterThanOrEqual(4);
    expect(all.data[0]).toMatchObject({ outcome: 'DENIED', user: { id: tcId }, ip: expect.any(String) });
    expect((await api().get('/api/v1/access-policy/events').set(auth(manager)).expect(200)).body.meta.total).toBeGreaterThan(0);
    expect((await api().get('/api/v1/access-policy/events').set(auth(otherManager)).expect(200)).body.meta.total).toBe(0);
    expect((await api().get(`/api/v1/access-policy/events?userId=${tcId}`).set(auth(otherManager)).expect(200)).body.meta.total).toBe(0);
    await api().get('/api/v1/access-policy/events').set(auth(tc)).expect(403);
    const wfh = (await api().get('/api/v1/access-policy/wfh').set(auth(manager)).expect(200)).body.data;
    expect(wfh[0]).toMatchObject({ telecaller: { id: tcId }, grantedBy: { role: 'MANAGER' } });
    expect(wfh[0].revokedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: { in: ['wfh.grant', 'wfh.revoke', 'network.add', 'network.setActive'] } } })).toBe(5);
  });
});
