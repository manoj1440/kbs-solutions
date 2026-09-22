import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-307 calling queue / F-305 reassignment (RBAC-01, CUST-04)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let batchId: string;
  let teamA: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let teamA2: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let teamB: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;

  async function trained(suffix: string, managerToken?: string) {
    const s = await setupManagerAndTelecaller(app, prisma, suffix);
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: s.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    await prisma.user.update({ where: { id: s.telecallerId }, data: { employeeCode: `TC${suffix}` } });
    void managerToken;
    return s;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    // network gate off for this suite (F-301 is covered in core); training gate stays on
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    await api().put('/api/v1/config/compliance.callingListConsentConfirmedByCompliance').set(auth(adminToken)).send({ value: true, reason: 'test' }).expect(200);

    teamA = await trained('10001');
    // second Telecaller under the same Manager A
    const t2 = await api().post('/api/v1/telecallers').set(auth(teamA.manager.accessToken)).set('idempotency-key', idem()).send({ fullName: 'Telecaller A2', mobile: '9776510002' }).expect(201);
    teamA2 = { ...teamA, telecallerId: t2.body.data.id, telecallerMobile: '9776510002' };
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: teamA2.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    await prisma.user.update({ where: { id: teamA2.telecallerId }, data: { employeeCode: 'TC10002' } });
    teamB = await trained('10003');

    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 'test', key: 'test/q.csv', originalName: 'q.csv', contentType: 'text/csv', sizeBytes: 10, sha256: 'q'.repeat(64), uploadedByUserId: teamA.admin.user.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: teamA.admin.user.id, checksum: 'q'.repeat(64), status: 'IMPORTED', totals: {} } });
    batchId = batch.id;
    await prisma.callingRecord.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({ batchId, sourceRowNumber: i + 2, fullName: `Queue Customer ${i + 1}`, mobile: `+91955560000${i + 1}`, pincode: '302001', resolvedCity: 'Jaipur', resolvedState: 'Rajasthan', locationResolved: true })),
    });
    const run = await api().post(`/api/v1/calling-list/batches/${batchId}/allocate`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    expect(run.body.data.assigned).toBe(6); // 2/2/2 over TC10001, TC10002, TC10003
  });
  afterAll(async () => app.close());

  it('RBAC-01: Telecaller sees only own rows (masked), Manager sees team, Admin sees all', async () => {
    const t = await loginAs(app, prisma, teamA.telecallerMobile);
    const mine = await api().get('/api/v1/calling/queue').set(auth(t.accessToken)).expect(200);
    expect(mine.body.meta.total).toBe(2);
    expect(mine.body.data.every((r: { assignedTelecaller: { id: string } }) => r.assignedTelecaller.id === teamA.telecallerId)).toBe(true);
    expect(mine.body.data[0].mobileMasked).toMatch(/^\+91••••••\d{4}$/);
    expect(JSON.stringify(mine.body)).not.toContain("+9195556");
    expect(mine.body.data[0]).toMatchObject({ location: 'Jaipur, Rajasthan', canCall: true, interactionStatus: 'UNTOUCHED' });
    expect(mine.body.meta.counts).toMatchObject({ active: 2, followups: 0, dueNow: 0, hidden: 0 });
    // Telecaller cannot use the team/all listing
    await api().get('/api/v1/calling/records').set(auth(t.accessToken)).expect(403);

    const teamList = await api().get('/api/v1/calling/records').set(auth(teamA.manager.accessToken)).expect(200);
    expect(teamList.body.meta.total).toBe(4);
    await api().get(`/api/v1/calling/records?telecallerId=${teamB.telecallerId}`).set(auth(teamA.manager.accessToken)).expect(403);
    const all = await api().get('/api/v1/calling/records').set(auth(adminToken)).expect(200);
    expect(all.body.meta.total).toBe(6);

    // detail: own ok, other's → 404 (no existence leak)
    const otherId = all.body.data.find((r: { assignedTelecaller: { id: string } }) => r.assignedTelecaller.id === teamB.telecallerId).id;
    await api().get(`/api/v1/calling/records/${otherId}`).set(auth(t.accessToken)).expect(404);
    const own = await api().get(`/api/v1/calling/records/${mine.body.data[0].id}`).set(auth(t.accessToken)).expect(200);
    expect(own.body.data.allocationEvents).toHaveLength(1);
    expect(own.body.data.allocationEvents[0].reason).toBe('AUTO_ALLOCATION');
  });

  it('untrained Telecaller is blocked from the queue by the training gate', async () => {
    const s = await setupManagerAndTelecaller(app, prisma, '10009');
    const t = await loginAs(app, prisma, s.telecallerMobile);
    const res = await api().get('/api/v1/calling/queue').set(auth(t.accessToken)).expect(403);
    expect(res.body.error.code).toBe('GATE_TRAINING_BLOCKED');
  });

  it('CUST-04: follow-up stays active and appears under follow-ups; declined is hidden but retrievable with its trail', async () => {
    const t = await loginAs(app, prisma, teamA.telecallerMobile);
    const mine = await api().get('/api/v1/calling/queue').set(auth(t.accessToken)).expect(200);
    const [r1, r2] = mine.body.data as Array<{ id: string }>;
    const due = new Date(Date.now() - 60_000);
    await prisma.callingRecord.update({ where: { id: r1.id }, data: { interactionStatus: 'FOLLOW_UP', nextFollowUpAt: due } });
    await prisma.callOutcome.create({ data: { callingRecordId: r1.id, telecallerUserId: teamA.telecallerId, outcome: 'FOLLOW_UP', remarks: 'call back tomorrow', followUpAt: due } });
    await prisma.callingRecord.update({ where: { id: r2.id }, data: { interactionStatus: 'DECLINED', hiddenAt: new Date(), hiddenReason: 'DECLINED' } });
    await prisma.callOutcome.create({ data: { callingRecordId: r2.id, telecallerUserId: teamA.telecallerId, outcome: 'DECLINED', remarks: 'not interested' } });

    const active = await api().get('/api/v1/calling/queue?tab=active').set(auth(t.accessToken)).expect(200);
    expect(active.body.data.map((r: { id: string }) => r.id)).toEqual([r1.id]);
    expect(active.body.data[0].lastOutcome).toMatchObject({ outcome: 'FOLLOW_UP', remarks: 'call back tomorrow' });
    expect(active.body.meta.counts).toMatchObject({ active: 1, followups: 1, dueNow: 1, hidden: 1 });
    const followups = await api().get('/api/v1/calling/queue?tab=followups').set(auth(t.accessToken)).expect(200);
    expect(followups.body.data.map((r: { id: string }) => r.id)).toEqual([r1.id]);
    const hidden = await api().get('/api/v1/calling/queue?tab=hidden').set(auth(t.accessToken)).expect(200);
    expect(hidden.body.data.map((r: { id: string }) => r.id)).toEqual([r2.id]);
    expect(hidden.body.data[0]).toMatchObject({ canCall: false, hiddenReason: 'DECLINED' });
    const detail = await api().get(`/api/v1/calling/records/${r2.id}`).set(auth(t.accessToken)).expect(200);
    expect(detail.body.data.outcomes[0]).toMatchObject({ outcome: 'DECLINED', remarks: 'not interested' });
    // search
    const search = await api().get('/api/v1/calling/queue?search=customer 1').set(auth(t.accessToken)).expect(200);
    expect(search.body.meta.total).toBe(1);
  });

  it('reassignment: Manager within team only (reason mandatory, event recorded); Admin cross-team; history kept', async () => {
    const t = await loginAs(app, prisma, teamA.telecallerMobile);
    const mine = await api().get('/api/v1/calling/queue?tab=followups').set(auth(t.accessToken)).expect(200);
    const rec = mine.body.data[0].id as string;
    // Manager A: to a Telecaller outside the team → forbidden
    await api().post(`/api/v1/calling/records/${rec}/reassign`).set(auth(teamA.manager.accessToken)).set('idempotency-key', idem()).send({ toTelecallerUserId: teamB.telecallerId, reason: 'load balance' }).expect(403);
    // missing reason → 400
    await api().post(`/api/v1/calling/records/${rec}/reassign`).set(auth(teamA.manager.accessToken)).set('idempotency-key', idem()).send({ toTelecallerUserId: teamA2.telecallerId }).expect(400);
    // within team → ok
    const moved = await api().post(`/api/v1/calling/records/${rec}/reassign`).set(auth(teamA.manager.accessToken)).set('idempotency-key', idem()).send({ toTelecallerUserId: teamA2.telecallerId, reason: 'A1 on leave' }).expect(201);
    expect(moved.body.data.assignedTelecallerUserId).toBe(teamA2.telecallerId);
    // Manager B cannot touch a record now owned by team A
    await api().post(`/api/v1/calling/records/${rec}/reassign`).set(auth(teamB.manager.accessToken)).set('idempotency-key', idem()).send({ toTelecallerUserId: teamB.telecallerId, reason: 'grab' }).expect(403);
    // Admin cross-team → ok; trail preserved
    await api().post(`/api/v1/calling/records/${rec}/reassign`).set(auth(adminToken)).set('idempotency-key', idem()).send({ toTelecallerUserId: teamB.telecallerId, reason: 'team restructure' }).expect(201);
    const tb = await loginAs(app, prisma, teamB.telecallerMobile);
    const detail = await api().get(`/api/v1/calling/records/${rec}`).set(auth(tb.accessToken)).expect(200);
    expect(detail.body.data.allocationEvents.map((e: { reason: string }) => e.reason)).toEqual(['AUTO_ALLOCATION', 'MANUAL_REASSIGNMENT: A1 on leave', 'MANUAL_REASSIGNMENT: team restructure']);
    expect(detail.body.data.outcomes).toHaveLength(1);
    expect(detail.body.data.nextFollowUpAt).toBeTruthy();
    // original Telecaller no longer sees it
    await api().get(`/api/v1/calling/records/${rec}`).set(auth(t.accessToken)).expect(404);
    // untrained target refused
    const s = await setupManagerAndTelecaller(app, prisma, '10010');
    await api().post(`/api/v1/calling/records/${rec}/reassign`).set(auth(adminToken)).set('idempotency-key', idem()).send({ toTelecallerUserId: s.telecallerId, reason: 'nope' }).expect(400);
  });

  it('distribution: Manager sees own team, Admin sees everyone + unassigned count', async () => {
    const m = await api().get('/api/v1/calling/distribution').set(auth(teamA.manager.accessToken)).expect(200);
    expect(m.body.data.telecallers.map((t: { id: string }) => t.id).sort()).toEqual([teamA.telecallerId, teamA2.telecallerId].sort());
    expect(m.body.data.unassigned).toBeNull();
    const a = await api().get('/api/v1/calling/distribution').set(auth(adminToken)).expect(200);
    expect(a.body.data.telecallers.length).toBeGreaterThanOrEqual(5);
    expect(a.body.data.unassigned).toBe(0);
    const b = a.body.data.telecallers.find((t: { id: string }) => t.id === teamB.telecallerId);
    expect(b).toMatchObject({ eligible: true, active: 3 });
  });
});
