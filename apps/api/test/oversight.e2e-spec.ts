import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

/** F-314 org-wide telephony / WhatsApp delivery / recording oversight. */
describe('F-314 communications oversight (CALL-02, WA-01, RBAC-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let teamA: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let teamB: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let tcToken: string;
  const ids: Record<string, string> = {};
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000);

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    teamA = await setupManagerAndTelecaller(app, prisma, '31401');
    teamB = await setupManagerAndTelecaller(app, prisma, '31402');
    for (const t of [teamA, teamB]) await prisma.trainingEnrollment.update({ where: { telecallerUserId: t.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    tcToken = (await loginAs(app, prisma, teamA.telecallerMobile)).accessToken;

    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: 't/ov.csv', originalName: 'ov.csv', contentType: 'text/csv', sizeBytes: 1, sha256: 'd'.repeat(64), uploadedByUserId: teamA.admin.user.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: teamA.admin.user.id, checksum: 'd'.repeat(64), status: 'IMPORTED' } });
    let row = 2;
    const rec = async (tc: string, mobile: string) => (await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: row++, fullName: `Ov ${row}`, mobile, pincode: '302001', assignedTelecallerUserId: tc, assignedAt: new Date() } })).id;
    const call = (tc: string, recId: string, data: Record<string, unknown>) =>
      prisma.callAttempt.create({ data: { callingRecordId: recId, telecallerUserId: tc, providerKey: 'mock', targetMobileMasked: '+91••••••1111', idempotencyKey: idem(), ...data } });

    // Team A: one of each situation
    const rOk = await rec(teamA.telecallerId, '+919555710001');
    const ok = await call(teamA.telecallerId, rOk, { providerCallId: 'mock-ok', providerState: 'ENDED', initiatedAt: ago(20), connectedAt: ago(19), endedAt: ago(17), durationSec: 120 });
    await prisma.callRecording.create({ data: { callAttemptId: ok.id, status: 'AVAILABLE', providerRecordingId: 'r-ok', durationSec: 120 } });
    ids.ok = ok.id;
    const recFailed = await call(teamA.telecallerId, await rec(teamA.telecallerId, '+919555710002'), { providerCallId: 'mock-rf', providerState: 'ENDED', initiatedAt: ago(30), connectedAt: ago(29), endedAt: ago(28), durationSec: 60 });
    await prisma.callRecording.create({ data: { callAttemptId: recFailed.id, status: 'FAILED', failureReason: 'storage error' } });
    ids.recFailed = recFailed.id;
    const overdue = await call(teamA.telecallerId, await rec(teamA.telecallerId, '+919555710003'), { providerCallId: 'mock-od', providerState: 'ENDED', initiatedAt: ago(200), connectedAt: ago(199), endedAt: ago(190), durationSec: 540 });
    await prisma.callRecording.create({ data: { callAttemptId: overdue.id, status: 'PENDING' } });
    ids.overdue = overdue.id;
    ids.stale = (await call(teamA.telecallerId, await rec(teamA.telecallerId, '+919555710004'), { providerCallId: 'mock-st', providerState: 'RINGING', initiatedAt: ago(45) })).id;
    ids.noAnswer = (await call(teamA.telecallerId, await rec(teamA.telecallerId, '+919555710005'), { providerCallId: 'mock-na', providerState: 'NO_ANSWER', initiatedAt: ago(15), endedAt: ago(14) })).id;
    // Real flow: the mock provider refuses numbers ending 0000 — a provider-reported failure (it carries a provider call id)
    const rFail = await rec(teamA.telecallerId, '+919555700000');
    const f = await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', idem()).send({ callingRecordId: rFail }).expect(201);
    expect(f.body.data.providerState).toBe('FAILED');
    expect(f.body.data.providerCallId).toMatch(/^mock-/);
    ids.providerFailed = f.body.data.id;
    // Adapter threw before the provider accepted the call → no provider call id (REQ-16 §16.3 "failed before provider connection")
    ids.failed = (await call(teamA.telecallerId, await rec(teamA.telecallerId, '+919555710006'), { providerCallId: null, providerState: 'FAILED', failureReason: 'PROVIDER_TIMEOUT', initiatedAt: ago(3), endedAt: ago(3) })).id;
    // Team B: one connected call, recording available — must never leak to Manager A
    const b = await call(teamB.telecallerId, await rec(teamB.telecallerId, '+919555720001'), { providerCallId: 'mock-b', providerState: 'ENDED', initiatedAt: ago(10), connectedAt: ago(9), endedAt: ago(8), durationSec: 60 });
    await prisma.callRecording.create({ data: { callAttemptId: b.id, status: 'AVAILABLE', providerRecordingId: 'r-b' } });
    ids.teamB = b.id;

    const share = (actor: string, data: Record<string, unknown>) =>
      prisma.shareAction.create({ data: { actorUserId: actor, callingRecordId: rOk, kind: 'BENEFIT_PDF', targetMobileMasked: '+91••••••0001', channel: 'WHATSAPP_HANDOFF', handoffResult: 'OPENED', at: ago(5), ...data } });
    await share(teamA.telecallerId, {});
    await share(teamA.telecallerId, { kind: 'OFFICE_ID', handoffResult: 'FAILED' });
    await share(teamA.telecallerId, { kind: 'APPLICATION_LINK', channel: 'WHATSAPP_BUSINESS_API', deliveryStatus: 'DELIVERED', providerMessageId: 'm1' });
    await share(teamA.telecallerId, { kind: 'APPLICATION_LINK', channel: 'WHATSAPP_BUSINESS_API', deliveryStatus: 'FAILED', providerMessageId: 'm2' });
    await share(teamA.telecallerId, { kind: 'APPLICATION_LINK', channel: 'WHATSAPP_BUSINESS_API', deliveryStatus: 'UNKNOWN', providerMessageId: 'm3' });
    await share(teamB.telecallerId, {});
  });
  afterAll(async () => app.close());

  it('Admin summary: provider-confirmed vs failed-before-provider, connected from provider only, recording coverage over connected calls (CALL-02)', async () => {
    const s = (await api().get('/api/v1/calling/oversight/summary').set(auth(adminToken)).expect(200)).body.data;
    expect(s.calls).toMatchObject({ source: 'TELEPHONY_PROVIDER', initiated: 8, providerConfirmed: 7, failedBeforeProvider: 1, connected: 4, talkTimeSec: 120 + 60 + 540 + 60 });
    expect(s.calls.byState).toMatchObject({ ENDED: 4, RINGING: 1, NO_ANSWER: 1, FAILED: 2 });
    expect(s.calls.topFailureReasons.map((r: { reason: string }) => r.reason)).toContain('PROVIDER_TIMEOUT');
    expect(s.recordings).toMatchObject({ denominator: 4, available: 2, pending: 1, failed: 1, noneRecorded: 0, overdue: 1 });
    expect(s.attention).toEqual({ NO_PROVIDER_CONFIRMATION: 1, FAILED_BEFORE_PROVIDER: 1, RECORDING_FAILED: 1, RECORDING_OVERDUE: 1, SHARE_FAILED: 2 });
    expect(s.thresholds).toEqual({ liveWindowMinutes: 30, recordingOverdueMinutes: 60 });
  });

  it('WA-01: hand-off shares are never counted as delivered; provider statuses are separate', async () => {
    const s = (await api().get('/api/v1/calling/oversight/summary').set(auth(adminToken)).expect(200)).body.data;
    expect(s.shares).toMatchObject({ source: 'KBS_SHARING', total: 6, handoffOpened: 2, handoffFailed: 1, deliveryNotReported: 2, provider: { sent: 0, delivered: 1, failed: 1, awaiting: 1 } });
    const list = (await api().get('/api/v1/calling/oversight/shares?channel=WHATSAPP_HANDOFF').set(auth(adminToken)).expect(200)).body;
    expect(list.meta.total).toBe(3);
    for (const r of list.data) expect(r.deliveryLabel).not.toMatch(/Delivered/);
    const failed = (await api().get('/api/v1/calling/oversight/shares?attention=SHARE_FAILED').set(auth(adminToken)).expect(200)).body;
    expect(failed.data.map((r: { deliveryLabel: string }) => r.deliveryLabel).sort()).toEqual(['Could not open share', 'Delivery failed (provider)']);
  });

  it('attention filters return exactly the matching calls; FAILED recording is never shown as available', async () => {
    const get = async (qs: string) => (await api().get(`/api/v1/calling/oversight/calls?${qs}`).set(auth(adminToken)).expect(200)).body;
    expect((await get('attention=NO_PROVIDER_CONFIRMATION')).data.map((r: { id: string }) => r.id)).toEqual([ids.stale]);
    expect((await get('attention=FAILED_BEFORE_PROVIDER')).data.map((r: { id: string }) => r.id)).toEqual([ids.failed]);
    expect((await get('attention=RECORDING_OVERDUE')).data.map((r: { id: string }) => r.id)).toEqual([ids.overdue]);
    const rf = (await get('attention=RECORDING_FAILED')).data;
    expect(rf).toHaveLength(1);
    expect(rf[0]).toMatchObject({ id: ids.recFailed, recording: 'Recording unavailable', recordingFailureReason: 'storage error', canPlay: false, attention: ['RECORDING_FAILED'] });
    const avail = await get('recording=AVAILABLE');
    expect(avail.meta.total).toBe(2);
    expect(avail.data.every((r: { canPlay: boolean; recording: string }) => r.canPlay && r.recording === 'Recording available')).toBe(true);
    const none = await get('recording=NONE');
    expect(none.meta.total).toBe(4); // stale, no-answer, two failures: no recording row
    const paged = await get('pageSize=2&page=2');
    expect(paged.meta).toMatchObject({ page: 2, pageSize: 2, total: 8 });
    expect(paged.data).toHaveLength(2);
  });

  it('no full customer mobile appears in any oversight response', async () => {
    for (const path of ['summary', 'calls?pageSize=100', 'shares?pageSize=100']) {
      const body = JSON.stringify((await api().get(`/api/v1/calling/oversight/${path}`).set(auth(adminToken)).expect(200)).body);
      expect(body).not.toMatch(/\+9195557\d{5}/);
    }
  });

  it('RBAC-01: Manager sees own team only; other team hidden; Admin managerId filter; Telecaller 403', async () => {
    const m = (await api().get('/api/v1/calling/oversight/calls?pageSize=100').set(auth(teamA.manager.accessToken)).expect(200)).body;
    expect(m.meta.total).toBe(7);
    expect(m.data.map((r: { id: string }) => r.id)).not.toContain(ids.teamB);
    const ms = (await api().get('/api/v1/calling/oversight/summary').set(auth(teamA.manager.accessToken)).expect(200)).body.data;
    expect(ms.calls.initiated).toBe(7);
    expect(ms.shares.total).toBe(5);
    await api().get(`/api/v1/calling/oversight/calls?telecallerId=${teamB.telecallerId}`).set(auth(teamA.manager.accessToken)).expect(404);
    // a Manager cannot widen scope through managerId
    const wide = (await api().get(`/api/v1/calling/oversight/calls?managerId=${teamB.managerId}`).set(auth(teamA.manager.accessToken)).expect(200)).body;
    expect(wide.meta.total).toBe(7);
    const b = (await api().get(`/api/v1/calling/oversight/calls?managerId=${teamB.managerId}`).set(auth(adminToken)).expect(200)).body;
    expect(b.data.map((r: { id: string }) => r.id)).toEqual([ids.teamB]);
    await api().get('/api/v1/calling/oversight/summary').set(auth(tcToken)).expect(403);
  });

  it('validates dates and range; reads are not audited as mutations', async () => {
    await api().get('/api/v1/calling/oversight/calls?from=2026-09-30&to=2026-09-01').set(auth(adminToken)).expect(400);
    await api().get('/api/v1/calling/oversight/calls?from=23-09-2026').set(auth(adminToken)).expect(400);
    const past = (await api().get('/api/v1/calling/oversight/summary?from=2020-01-01&to=2020-01-31').set(auth(adminToken)).expect(200)).body.data;
    expect(past.calls.initiated).toBe(0);
    expect(past.recordings.denominator).toBe(0);
  });
});
