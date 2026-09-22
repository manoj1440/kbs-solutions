import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-309 calls / F-310 outcomes (CALL-01/02/04, CUST-04)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let team: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let tcToken: string;
  let rec1: string;
  let rec2: string;
  let recFail: string;
  let cardId: string;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    await api().put('/api/v1/config/compliance.recordingDisclosureText').set(auth(adminToken)).send({ value: 'This call may be recorded for quality.', reason: 'test' }).expect(200);
    team = await setupManagerAndTelecaller(app, prisma, '40001');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: team.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    tcToken = (await loginAs(app, prisma, team.telecallerMobile)).accessToken;
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: 't/calls.csv', originalName: 'calls.csv', contentType: 'text/csv', sizeBytes: 1, sha256: 'c'.repeat(64), uploadedByUserId: team.admin.user.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: team.admin.user.id, checksum: 'c'.repeat(64), status: 'IMPORTED' } });
    const mk = (n: number, mobile: string) => prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: n, fullName: `Cust ${n}`, mobile, pincode: '302001', assignedTelecallerUserId: team.telecallerId, assignedAt: new Date() } });
    rec1 = (await mk(2, '+919555800001')).id;
    rec2 = (await mk(3, '+919555800002')).id;
    recFail = (await mk(4, '+919555800000')).id; // mock provider fails numbers ending 0000
    const bank = await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } });
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: bank.id, name: 'HDFC Test Card' }).expect(201);
    cardId = c.body.data.id;
    await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
  });
  afterAll(async () => app.close());

  it('CALL-01: initiate → provider events → attempt carries providerCallId, connected/ended times, duration; double-tap = one attempt', async () => {
    const key = idem();
    const a = await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', key).send({ callingRecordId: rec1 }).expect(201);
    const call = a.body.data;
    expect(call).toMatchObject({ providerState: 'REQUESTED', targetMobileMasked: '+91••••••0001', recording: null, disclosureText: 'This call may be recorded for quality.' });
    expect(call.providerCallId).toMatch(/^mock-/);
    expect(JSON.stringify(a.body)).not.toContain('+919555800001');
    // double-tap with same key → replay, still one attempt
    const again = await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', key).send({ callingRecordId: rec1 }).expect(201);
    expect(again.body.data.id).toBe(call.id);
    expect(await prisma.callAttempt.count({ where: { callingRecordId: rec1 } })).toBe(1);
    // a second tap with a NEW key while the call is live → 409
    await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', idem()).send({ callingRecordId: rec1 }).expect(409);
    expect(await prisma.sensitiveAccessLog.count({ where: { entityId: rec1, field: 'MOBILE' } })).toBe(1);

    const t0 = new Date('2026-09-22T10:00:00Z');
    const events = (list: object[]) => api().post('/api/v1/webhooks/telephony/mock').send({ events: list }).expect(200);
    await events([{ providerCallId: call.providerCallId, type: 'RINGING', at: t0.toISOString() }]);
    await events([{ providerCallId: call.providerCallId, type: 'CONNECTED', at: new Date(t0.getTime() + 5000).toISOString() }]);
    const mid = await api().get(`/api/v1/calls/${call.id}`).set(auth(tcToken)).expect(200);
    expect(mid.body.data).toMatchObject({ providerState: 'CONNECTED', connectedAt: '2026-09-22T10:00:05.000Z' });
    // duplicate CONNECTED is ignored; ENDED computes duration
    const dup = await events([{ providerCallId: call.providerCallId, type: 'CONNECTED', at: new Date(t0.getTime() + 9000).toISOString() }, { providerCallId: call.providerCallId, type: 'ENDED', at: new Date(t0.getTime() + 65000).toISOString() }]);
    expect(dup.body.data).toEqual({ received: 2, applied: 1 });
    const done = await api().get(`/api/v1/calls/${call.id}`).set(auth(tcToken)).expect(200);
    expect(done.body.data).toMatchObject({ providerState: 'ENDED', durationSec: 60, recording: { status: 'PENDING' } });
    // unknown call id ignored
    const unk = await events([{ providerCallId: 'mock-nope', type: 'ENDED' }]);
    expect(unk.body.data).toEqual({ received: 1, applied: 0 });
  });

  it('CALL-02: recording FAILED → "Recording unavailable"; AVAILABLE → playable by Manager/Admin only, logged', async () => {
    const attempt = await prisma.callAttempt.findFirstOrThrow({ where: { callingRecordId: rec1 } });
    await api().post('/api/v1/webhooks/telephony/mock').send({ events: [{ providerCallId: attempt.providerCallId, type: 'RECORDING_FAILED', reason: 'storage error' }] }).expect(200);
    const failed = await api().get(`/api/v1/calls/${attempt.id}`).set(auth(tcToken)).expect(200);
    expect(failed.body.data.recording).toMatchObject({ status: 'FAILED', failureReason: 'storage error' });
    await api().get(`/api/v1/calls/${attempt.id}/recording-url`).set(auth(team.manager.accessToken)).expect(409);
    await api().post('/api/v1/webhooks/telephony/mock').send({ events: [{ providerCallId: attempt.providerCallId, type: 'RECORDING_AVAILABLE', recordingRef: 'rec-123', durationSec: 60 }] }).expect(200);
    const avail = await api().get(`/api/v1/calls/${attempt.id}`).set(auth(tcToken)).expect(200);
    expect(avail.body.data.recording).toMatchObject({ status: 'AVAILABLE', durationSec: 60 });
    // Telecaller cannot play; Manager (team) and Admin can; every play is a sensitive access
    await api().get(`/api/v1/calls/${attempt.id}/recording-url`).set(auth(tcToken)).expect(403);
    const m = await api().get(`/api/v1/calls/${attempt.id}/recording-url`).set(auth(team.manager.accessToken)).expect(200);
    expect(m.body.data.url).toContain('rec-123');
    await api().get(`/api/v1/calls/${attempt.id}/recording-url`).set(auth(adminToken)).expect(200);
    expect(await prisma.sensitiveAccessLog.count({ where: { entityId: attempt.id, field: 'RECORDING' } })).toBe(2);
    // another Manager cannot even see the call
    const other = await setupManagerAndTelecaller(app, prisma, '40002');
    await api().get(`/api/v1/calls/${attempt.id}`).set(auth(other.manager.accessToken)).expect(404);
  });

  it('provider failure → FAILED with reason, safe retry after 5 s; suppressed record refused', async () => {
    const f = await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', idem()).send({ callingRecordId: recFail }).expect(201);
    expect(f.body.data).toMatchObject({ providerState: 'FAILED', failureReason: 'MOCK_FAILURE' });
    expect(f.body.data.retryAfter).toBeTruthy();
    const tooSoon = await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', idem()).send({ callingRecordId: recFail }).expect(429);
    expect(tooSoon.body.error.code).toBe('RATE_LIMITED');
    await api().post('/api/v1/suppressions').set(auth(adminToken)).set('idempotency-key', idem()).send({ mobile: '9555800002', reason: 'CUSTOMER_REQUEST' }).expect(201);
    const sup = await api().post('/api/v1/calls').set(auth(tcToken)).set('idempotency-key', idem()).send({ callingRecordId: rec2 }).expect(403);
    expect(sup.body.error.code).toBe('CALLING_SUPPRESSED');
    await prisma.contactSuppression.deleteMany({ where: { mobile: '+919555800002' } });
    await prisma.callingRecord.update({ where: { id: rec2 }, data: { suppressed: false, hiddenAt: null, hiddenReason: null } });
  });

  it('CUST-04 / CALL-04: outcomes drive status + hide; follow-up needs date+note; interest created for card; no entitlement or bank snapshot', async () => {
    const attempt = await prisma.callAttempt.findFirstOrThrow({ where: { callingRecordId: rec1 } });
    // follow-up without date → 400; without note (config requires) → 400
    await api().post(`/api/v1/calling/records/${rec1}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'FOLLOW_UP' }).expect(400);
    const due = new Date(Date.now() + 3600_000).toISOString();
    await api().post(`/api/v1/calling/records/${rec1}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'FOLLOW_UP', followUpAt: due }).expect(400);
    const fu = await api().post(`/api/v1/calling/records/${rec1}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ callAttemptId: attempt.id, outcome: 'FOLLOW_UP', followUpAt: due, remarks: 'busy, call after lunch' }).expect(201);
    expect(fu.body.data).toMatchObject({ interactionStatus: 'FOLLOW_UP', hidden: false, nextFollowUpAt: due });
    const q = await api().get('/api/v1/calling/queue?tab=followups').set(auth(tcToken)).expect(200);
    expect(q.body.data.map((r: { id: string }) => r.id)).toEqual([rec1]);
    expect(q.body.data[0].lastOutcome).toMatchObject({ outcome: 'FOLLOW_UP', remarks: 'busy, call after lunch' });

    // interested with a card → CallingInterest; INV-05: nothing else
    const before = { ent: await prisma.payoutEntitlement.count(), snap: await prisma.bankStatusSnapshot.count(), leads: await prisma.lead.count() };
    const int = await api().post(`/api/v1/calling/records/${rec1}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'CONNECTED_INTERESTED', selectedCardId: cardId, remarks: 'wants the travel card' }).expect(201);
    expect(int.body.data.interestId).toBeTruthy();
    expect(await prisma.callingInterest.count({ where: { callingRecordId: rec1, cardId } })).toBe(1);
    expect({ ent: await prisma.payoutEntitlement.count(), snap: await prisma.bankStatusSnapshot.count(), leads: await prisma.lead.count() }).toEqual(before);
    const r1 = await prisma.callingRecord.findUniqueOrThrow({ where: { id: rec1 } });
    expect(r1).toMatchObject({ interactionStatus: 'INTERESTED', nextFollowUpAt: null, hiddenAt: null, possibleCollision: false });

    // declined requires a note; then hides but stays retrievable with the trail
    await api().post(`/api/v1/calling/records/${rec2}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'DECLINED' }).expect(400);
    const dec = await api().post(`/api/v1/calling/records/${rec2}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'DECLINED', remarks: 'not interested at all' }).expect(201);
    expect(dec.body.data).toMatchObject({ interactionStatus: 'DECLINED', hidden: true });
    const hidden = await api().get('/api/v1/calling/queue?tab=hidden').set(auth(tcToken)).expect(200);
    expect(hidden.body.data.map((r: { id: string }) => r.id)).toEqual([rec2]);
    const detail = await api().get(`/api/v1/calling/records/${rec2}`).set(auth(tcToken)).expect(200);
    expect(detail.body.data.outcomes[0]).toMatchObject({ outcome: 'DECLINED', remarks: 'not interested at all' });
    // hidden record refuses further outcomes (except do-not-contact)
    await api().post(`/api/v1/calling/records/${rec2}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'FOLLOW_UP', followUpAt: due, remarks: 'x' }).expect(409);
    // do-not-contact → suppression + hidden
    await api().post(`/api/v1/calling/records/${recFail}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'DECLINED', remarks: 'asked never to call', doNotContact: true }).expect(201);
    expect(await prisma.contactSuppression.count({ where: { mobile: '+919555800000', liftedAt: null, reason: 'CUSTOMER_REQUEST' } })).toBe(1);
    expect((await prisma.callingRecord.findUniqueOrThrow({ where: { id: recFail } })).suppressed).toBe(true);
    // unassigned Telecaller cannot record
    const other = await setupManagerAndTelecaller(app, prisma, '40003');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: other.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    const ot = await loginAs(app, prisma, other.telecallerMobile);
    await api().post(`/api/v1/calling/records/${rec1}/outcomes`).set(auth(ot.accessToken)).set('idempotency-key', idem()).send({ outcome: 'COMPLETED_NO_FURTHER' }).expect(403);
  });

  it('collision flag: interest on a mobile that also has an Advisor lead flags both, changes nothing else', async () => {
    const advisor = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555899999', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv' } });
    const bank = await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } });
    const lead = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advisor.id, reportingParentUserIdSnapshot: team.managerId, bankId: bank.id, cardId, customerFullName: 'Cust 1', customerMobile: '+919555800001', pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 600000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    await api().post(`/api/v1/calling/records/${rec1}/outcomes`).set(auth(tcToken)).set('idempotency-key', idem()).send({ outcome: 'CONNECTED_LINK_OR_PDF_SHARED', selectedCardId: cardId }).expect(201);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).possibleCollision).toBe(true);
    expect((await prisma.callingRecord.findUniqueOrThrow({ where: { id: rec1 } })).possibleCollision).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).advisorUserId).toBe(advisor.id);
  });

  it('remarks: append + edit keeps prior text in editHistory; Manager can read team remarks', async () => {
    const add = await api().post(`/api/v1/calling/records/${rec1}/remarks`).set(auth(tcToken)).set('idempotency-key', idem()).send({ text: 'prefers evening calls' }).expect(201);
    const edited = await api().put(`/api/v1/remarks/${add.body.data.id}`).set(auth(tcToken)).send({ text: 'prefers evening calls after 7pm' }).expect(200);
    expect(edited.body.data.text).toBe('prefers evening calls after 7pm');
    expect(edited.body.data.editHistory).toHaveLength(1);
    expect(edited.body.data.editHistory[0].text).toBe('prefers evening calls');
    await api().put(`/api/v1/remarks/${add.body.data.id}`).set(auth(team.manager.accessToken)).send({ text: 'hijack' }).expect(403);
    const list = await api().get(`/api/v1/calling/records/${rec1}/remarks`).set(auth(team.manager.accessToken)).expect(200);
    expect(list.body.data).toHaveLength(1);
    const detail = await api().get(`/api/v1/calling/records/${rec1}`).set(auth(team.manager.accessToken)).expect(200);
    expect(detail.body.data.remarks[0].text).toBe('prefers evening calls after 7pm');
    expect(detail.body.data.callAttempts).toHaveLength(1);
  });
});
