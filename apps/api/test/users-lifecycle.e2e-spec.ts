import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-105 user administration & lifecycle (REQ-04 §4.3, AUDIT-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let manager: string;
  let managerId: string;
  let telecallerId: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const s = await setupManagerAndTelecaller(app, prisma, '105');
    admin = s.admin.accessToken;
    manager = s.manager.accessToken;
    managerId = s.managerId;
    telecallerId = s.telecallerId;
  });
  afterAll(async () => app.close());

  it('F-105: a second ADMIN cannot be created via API (400) or directly in the DB (unique violation)', async () => {
    const r = await api().post('/api/v1/users').set(auth(admin)).set('idempotency-key', idem()).send({ role: 'ADMIN', fullName: 'Second Admin', mobile: '9999900105' });
    expect(r.status).toBe(400);
    await expect(prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919999900105', role: 'ADMIN', status: 'ACTIVE', fullName: 'Rogue Admin' } })).rejects.toThrow(/Unique constraint|User_single_admin_idx/);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('F-105: deactivating a Telecaller keeps assigned customers visible to the Manager, flagged inactive / needs reassignment', async () => {
    const file = await prisma.storedFile.create({ data: { bucket: 'b', key: `k-${idem()}`, originalName: 'list.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sizeBytes: 1, sha256: 'x'.repeat(64), uploadedByUserId: managerId, purpose: 'CUSTOMER_LIST' } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: managerId, checksum: 'u'.repeat(64), status: 'IMPORTED' } });
    await prisma.callingRecord.createMany({ data: [1, 2].map((n) => ({ batchId: batch.id, sourceRowNumber: n, fullName: `Cust ${n}`, mobile: `+91955510500${n}`, pincode: '302001', assignedTelecallerUserId: telecallerId, assignedAt: new Date() })) });

    await api().post(`/api/v1/users/${telecallerId}/deactivate`).set(auth(manager)).send({}).expect(400); // reason mandatory
    await api().post(`/api/v1/users/${telecallerId}/deactivate`).set(auth(manager)).send({ reason: 'left the company' }).expect(201);

    const recs = (await api().get(`/api/v1/calling/records?telecallerId=${telecallerId}`).set(auth(manager)).expect(200)).body;
    expect(recs.meta.total).toBe(2);
    const dist = (await api().get('/api/v1/calling/distribution').set(auth(manager)).expect(200)).body.data;
    expect(dist.telecallers.find((t: { id: string }) => t.id === telecallerId)).toMatchObject({ status: 'DEACTIVATED', active: 2, needsReassignment: true, eligible: false });
    const team = (await api().get('/api/v1/users?role=TELECALLER').set(auth(manager)).expect(200)).body.data;
    expect(team.find((u: { id: string }) => u.id === telecallerId)).toMatchObject({ status: 'DEACTIVATED' });
    expect(await prisma.session.count({ where: { userId: telecallerId, revokedAt: null } })).toBe(0);
  });

  it('AUDIT-01 / F-105: every lifecycle transition has an audit row and a lifecycle event with actor and reason', async () => {
    await api().post(`/api/v1/users/${telecallerId}/reactivate`).set(auth(manager)).send({ reason: 'not allowed' }).expect(403);
    await api().post(`/api/v1/users/${telecallerId}/reactivate`).set(auth(admin)).send({ reason: 'rehired after review' }).expect(201);
    // idempotent: reactivating an ACTIVE user adds nothing
    await api().post(`/api/v1/users/${telecallerId}/reactivate`).set(auth(admin)).send({ reason: 'double click' }).expect(201);
    await api().post(`/api/v1/users/${telecallerId}/sessions/revoke`).set(auth(admin)).send({ reason: 'lost phone' }).expect(201);

    const events = await prisma.userLifecycleEvent.findMany({ where: { userId: telecallerId }, orderBy: { at: 'asc' } });
    expect(events.map((e) => e.eventType)).toEqual(['CREATED', 'DEACTIVATED', 'REACTIVATED']);
    for (const e of events) {
      expect(e.reason.length).toBeGreaterThan(2);
      expect(e.actorUserId).toBeTruthy();
    }
    for (const action of ['telecallers.create', 'users.deactivate', 'users.reactivate', 'users.sessions.revoke']) expect(await prisma.auditLog.count({ where: { action, entityId: telecallerId } })).toBeGreaterThanOrEqual(1);
    const deact = await prisma.auditLog.findFirstOrThrow({ where: { action: 'users.deactivate', entityId: telecallerId } });
    expect(deact).toMatchObject({ reason: 'left the company', before: { status: 'ACTIVE' }, after: { status: 'DEACTIVATED' } });

    const detail = (await api().get(`/api/v1/users/${telecallerId}`).set(auth(admin)).expect(200)).body.data;
    expect(detail.lifecycle[0]).toMatchObject({ eventType: 'REACTIVATED', actor: { role: 'ADMIN' } });
  });

  it('F-105 §5: mobile change fails closed while auth.recoveryEnabled is off; when on it records MOBILE_CHANGED and revokes sessions', async () => {
    const body = { mobile: '9776500999', reason: 'customer lost the SIM, verified in person' };
    expect((await api().post(`/api/v1/users/${telecallerId}/change-mobile`).set(auth(admin)).send(body).expect(409)).body.error).toMatchObject({ code: 'CONFIG_MISSING', details: { key: 'auth.recoveryEnabled' } });
    await api().post(`/api/v1/users/${telecallerId}/change-mobile`).set(auth(manager)).send(body).expect(403);
    await api().put('/api/v1/config/auth.recoveryEnabled').set(auth(admin)).send({ value: true, reason: 'F-105 test' }).expect(200);
    try {
      await loginAs(app, prisma, '9776500105');
      const r = (await api().post(`/api/v1/users/${telecallerId}/change-mobile`).set(auth(admin)).send(body).expect(201)).body.data;
      expect(r.mobileMasked).toMatch(/0999$/);
      expect(await prisma.session.count({ where: { userId: telecallerId, revokedAt: null } })).toBe(0);
      expect(await prisma.userLifecycleEvent.count({ where: { userId: telecallerId, eventType: 'MOBILE_CHANGED' } })).toBe(1);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'users.changeMobile', entityId: telecallerId } });
      expect(JSON.stringify(audit.after)).not.toMatch(/9776500999/); // masked only
      // a mobile already in use is refused without revealing the owner
      expect((await api().post(`/api/v1/users/${telecallerId}/change-mobile`).set(auth(admin)).send({ mobile: '9876500105', reason: 'try an existing number' }).expect(409)).body.error.code).toBe('USER_MOBILE_TAKEN');
    } finally {
      await api().put('/api/v1/config/auth.recoveryEnabled').set(auth(admin)).send({ value: false, reason: 'reset' }).expect(200);
    }
  });
});
