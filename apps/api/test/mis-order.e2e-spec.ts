import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';
import { hdfcWorkbook, type MisRowInput, XLSX_TYPE } from './mis-fixture';

/** IST calendar day `offset` days from today (negative = past), as the upload dialog sends it. */
const day = (offset: number) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10);

describe('MIS-ORDER (REQ-23 §23.4): an older bank report never overwrites a newer one — leads', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let hdfcId: string;
  let advId: string;
  let leadA: string;
  let leadB: string;
  const api = () => request(app.getHttpServer());

  async function upload(rows: MisRowInput[], reportDate?: string) {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', await hdfcWorkbook(rows), { filename: `order-${idem()}.xlsx`, contentType: XLSX_TYPE }).expect(201);
    return api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, fileId: up.body.data.id, ...(reportDate ? { reportDate } : {}) });
  }
  async function apply(rows: MisRowInput[], reportDate?: string) {
    const b = await upload(rows, reportDate);
    expect(b.status).toBe(201);
    const id = b.body.data.id as string;
    const totals = (await api().post(`/api/v1/mis/batches/${id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201)).body.data;
    return { id, totals };
  }
  const snap = (leadId: string) => prisma.bankStatusSnapshot.findUniqueOrThrow({ where: { leadId } });
  const leadNotes = (leadId: string) => prisma.notification.count({ where: { kind: { in: ['MIS_MATCHED', 'MIS_CHANGED'] }, deepLink: { path: ['entityId'], equals: leadId } } });

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    const profileId = (await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } })).id;
    await api().post(`/api/v1/mis/profiles/${profileId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test' }).expect(201);
    advId = (await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999801', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Order' } })).id;
    const card = await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const mk = async (name: string, mobile: string, appNo: string) => {
      const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advId, reportingParentUserIdSnapshot: advId, bankId: hdfcId, cardId: card.id, customerFullName: name, customerMobile: mobile, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
      await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: advId } });
      return l.id;
    };
    leadA = await mk('Order A', '+919555700801', 'APP-801');
    leadB = await mk('Order B', '+919555700802', 'APP-802');
  });
  afterAll(async () => app.close());

  it('reportDate is validated: YYYY-MM-DD, a real day, not in the future', async () => {
    const rows = [{ 'Application No': 'APP-899', CURRENT_STAGE: 'x' }];
    expect((await upload(rows, '05-11-2026')).status).toBeGreaterThanOrEqual(400);
    expect((await upload(rows, '2026-02-31')).status).toBeGreaterThanOrEqual(400);
    const future = await upload(rows, day(2));
    expect(future.status).toBeGreaterThanOrEqual(400);
    expect(future.status).toBeLessThan(500);
    expect(await prisma.misImportBatch.count()).toBe(0);
  });

  it('newer report applied, then an older report with different values: snapshot, freshness, notifications and payouts untouched; stale count 1', async () => {
    const newer = await apply([{ 'Application No': 'APP-801', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE' }], day(-6));
    expect(newer.totals).toMatchObject({ updatedChanged: 1, updatedNoChange: 0, staleSkipped: 0 });
    const got = (await api().get(`/api/v1/mis/batches/${newer.id}`).set(auth(adminToken)).expect(200)).body.data;
    expect(got).toMatchObject({ reportDay: day(-6), reportDate: `${day(-6)}T00:00:00.000Z` });
    const before = await snap(leadA);
    const notesBefore = await leadNotes(leadA);
    const outboxBefore = await prisma.outboxEvent.count();
    expect(await prisma.payoutEntitlement.count()).toBe(0);

    // the older sheet would activate the card (→ a payout entitlement) and move the stage back if it were applied
    const older = await apply(
      [
        { 'Application No': 'APP-801', CURRENT_STAGE: 'Document Curing', FINAL_DECISION: 'Declined', 'Card Activation Staus': 'V + ACTIVE' },
        { 'Application No': 'APP-802', CURRENT_STAGE: 'Login', FINAL_DECISION: '' }, // first report for B: nothing newer on file → applies
      ],
      day(-10),
    );
    expect(older.totals).toMatchObject({ staleSkipped: 1, updatedChanged: 1, updatedNoChange: 0, appliedRows: 2 });

    const after = await snap(leadA);
    expect(after).toMatchObject({ currentStage: 'Decisioned Cases', finalDecision: 'Approve', cardActivationStatus: 'INACTIVE', lastMatchedBatchId: newer.id });
    expect(after.lastMatchedAt.toISOString()).toBe(before.lastMatchedAt.toISOString());
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
    expect(after.rawLatest).toEqual(before.rawLatest);
    // no history entry that could read as a current value; the trace is on the batch row
    expect(await prisma.bankStatusHistory.count({ where: { leadId: leadA, batchId: older.id } })).toBe(0);
    const rows = (await api().get(`/api/v1/mis/batches/${older.id}/rows`).set(auth(adminToken)).expect(200)).body.data as Array<{ sourceRowNumber: number; staleReport: boolean; applyNote: string | null; appliedAt: string | null; matchState: string }>;
    expect(rows.find((r) => r.sourceRowNumber === 2)).toMatchObject({ matchState: 'MATCHED', staleReport: true, applyNote: expect.stringContaining('STALE_REPORT') });
    expect(rows.find((r) => r.sourceRowNumber === 2)?.appliedAt).not.toBeNull();
    expect(rows.find((r) => r.sourceRowNumber === 3)).toMatchObject({ staleReport: false, applyNote: null });
    // no notification, no outbox event, no entitlement from the stale row
    expect(await leadNotes(leadA)).toBe(notesBefore);
    expect(await prisma.outboxEvent.count({ where: { type: 'mis.lead.changed', payload: { path: ['leadId'], equals: leadA } } })).toBe(1);
    expect(await prisma.outboxEvent.count()).toBe(outboxBefore + 1); // lead B only
    expect(await prisma.payoutEntitlement.count()).toBe(0);
    // lead B was set by the older batch (nothing newer existed)
    expect(await snap(leadB)).toMatchObject({ currentStage: 'Login', lastMatchedBatchId: older.id });
    // Admin sees the count on the batch and in the result notification
    const batch = (await api().get(`/api/v1/mis/batches/${older.id}`).set(auth(adminToken)).expect(200)).body.data;
    expect(batch).toMatchObject({ stage: 'APPLIED', reportDay: day(-10), totals: { staleSkipped: 1 } });
    const done = await prisma.notification.findFirstOrThrow({ where: { kind: 'MIS_IMPORT_RESULT', deepLink: { path: ['entityId'], equals: older.id } } });
    expect(done.body).toContain('1 row(s) were older than the status already on file');
    // the lead still shows the newer batch as its source
    const lead = (await api().get(`/api/v1/leads/${leadA}`).set(auth(adminToken)).expect(200)).body.data;
    expect(lead.bankStatus).toMatchObject({ matched: true, stage: 'Decisioned Cases', decision: 'Approve' });
  });

  it('a still-newer report applies normally (and creates the entitlement the stale one could not)', async () => {
    const newest = await apply([{ 'Application No': 'APP-801', CURRENT_STAGE: 'Decisioned Cases and Card setup completed', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'V + ACTIVE' }], day(-3));
    expect(newest.totals).toMatchObject({ updatedChanged: 1, staleSkipped: 0 });
    expect(await snap(leadA)).toMatchObject({ currentStage: 'Decisioned Cases and Card setup completed', cardActivationStatus: 'V + ACTIVE', lastMatchedBatchId: newest.id });
    expect(await prisma.payoutEntitlement.count({ where: { leadId: leadA } })).toBe(1);
    expect(await prisma.bankStatusHistory.count({ where: { leadId: leadA, batchId: newest.id, changeKind: 'CHANGED' } })).toBeGreaterThan(0);
  });

  it('a stale report that contradicts a payout trigger starts no entitlement review', async () => {
    const ent = await prisma.payoutEntitlement.findFirstOrThrow({ where: { leadId: leadA } });
    const reviewsBefore = await prisma.outboxEvent.count({ where: { type: 'payouts.review' } });
    const stale = await apply([{ 'Application No': 'APP-801', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE', CUSTOMER_NAME: 'again' }], day(-8));
    expect(stale.totals).toMatchObject({ staleSkipped: 1, updatedChanged: 0, updatedNoChange: 0 });
    expect(await snap(leadA)).toMatchObject({ cardActivationStatus: 'V + ACTIVE' });
    expect(await prisma.outboxEvent.count({ where: { type: 'payouts.review' } })).toBe(reviewsBefore);
    expect(await prisma.payoutEntitlement.findFirstOrThrow({ where: { leadId: leadA } })).toMatchObject({ id: ent.id, state: ent.state });
    expect(await prisma.payoutEntitlement.count()).toBe(1);
  });

  it('equal report dates and uploads without a report date keep the old behaviour: the later upload wins', async () => {
    const same = await apply([{ 'Application No': 'APP-801', CURRENT_STAGE: 'Card Dispatched', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'V + ACTIVE' }], day(-3));
    expect(same.totals).toMatchObject({ updatedChanged: 1, staleSkipped: 0 });
    expect(await snap(leadA)).toMatchObject({ currentStage: 'Card Dispatched', lastMatchedBatchId: same.id });
    // no reportDate → the upload day; two in a row both apply
    for (const stage of ['Card Delivered', 'Card In Use']) {
      const r = await apply([{ 'Application No': 'APP-801', CURRENT_STAGE: stage, FINAL_DECISION: 'Approve', 'Card Activation Staus': 'V + ACTIVE' }]);
      expect(r.totals).toMatchObject({ updatedChanged: 1, staleSkipped: 0 });
      const b = (await api().get(`/api/v1/mis/batches/${r.id}`).set(auth(adminToken)).expect(200)).body.data;
      expect(b).toMatchObject({ reportDate: null, reportDay: day(0) });
      expect(await snap(leadA)).toMatchObject({ currentStage: stage, lastMatchedBatchId: r.id });
    }
    // and a dated older report after those is stale again
    const late = await apply([{ 'Application No': 'APP-801', CURRENT_STAGE: 'Login', FINAL_DECISION: '' }], day(-1));
    expect(late.totals).toMatchObject({ staleSkipped: 1, updatedChanged: 0 });
    expect(await snap(leadA)).toMatchObject({ currentStage: 'Card In Use' });
  });
});

describe('MIS-ORDER (REQ-23 §23.4): Telecaller calling-interest bank status (A21)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let tc: { accessToken: string; id: string };
  let bankId: string;
  let interestId: string;
  const api = () => request(app.getHttpServer());

  async function mis(rows: MisRowInput[], reportDate?: string) {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', await hdfcWorkbook(rows), { filename: `mis-${idem()}.xlsx`, contentType: XLSX_TYPE }).expect(201);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, fileId: up.body.data.id, ...(reportDate ? { reportDate } : {}) }).expect(201);
    return { id: b.body.data.id as string, totals: (await api().post(`/api/v1/mis/batches/${b.body.data.id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201)).body.data };
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    bankId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'AU' } })).id;
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, name: 'AU LIT' }).expect(201);
    const cardId = c.body.data.id as string;
    await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', url: 'https://apply.au.example/lit?utm_source=KBS' }).expect(201);
    await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
    const team = await setupManagerAndTelecaller(app, prisma, '63001');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: team.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    tc = { accessToken: (await loginAs(app, prisma, team.telecallerMobile)).accessToken, id: team.telecallerId };
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const mobile = '+919555630001';
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: `t/${mobile}`, originalName: 'r.csv', contentType: 'text/csv', sizeBytes: 1, sha256: mobile.padEnd(64, '0'), uploadedByUserId: admin.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: admin.id, checksum: mobile.padEnd(64, '0'), status: 'IMPORTED' } });
    const rec = await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 2, fullName: `Customer ${mobile}`, mobile, pincode: '302001', assignedTelecallerUserId: tc.id, assignedAt: new Date() } });
    const share = await api().post('/api/v1/share').set(auth(tc.accessToken)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: rec.id, kind: 'APPLICATION_LINK', cardId }).expect(201);
    interestId = share.body.data.callingInterestId as string;
    await api().post(`/api/v1/calling/interests/${interestId}/bank-reference`).set(auth(tc.accessToken)).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: 'AU-0630' }).expect(201);
  });
  afterAll(async () => app.close());

  it('older report after a newer one: status and its as-of unchanged, Telecaller not notified, stale count 1; a newer one applies', async () => {
    const newer = await mis([{ 'Application No': 'AU-0630', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'V + ACTIVE' }], day(-4));
    expect(newer.totals).toMatchObject({ callingInterestsApplied: 1, updatedChanged: 1, staleSkipped: 0 });
    const before = await prisma.callingBankStatus.findUniqueOrThrow({ where: { callingInterestId: interestId } });
    const notes = await prisma.notification.count({ where: { recipientUserId: tc.id, kind: 'MIS_CHANGED' } });
    expect(notes).toBe(1);

    const older = await mis([{ 'Application No': 'AU-0630', CURRENT_STAGE: 'Login', FINAL_DECISION: 'Declined', 'Card Activation Staus': 'INACTIVE' }], day(-9));
    expect(older.totals).toMatchObject({ staleSkipped: 1, updatedChanged: 0, updatedNoChange: 0 });
    expect(await prisma.callingBankStatus.findUniqueOrThrow({ where: { callingInterestId: interestId } })).toEqual(before);
    expect(await prisma.notification.count({ where: { recipientUserId: tc.id, kind: 'MIS_CHANGED' } })).toBe(notes);
    expect(await prisma.misRow.findFirstOrThrow({ where: { batchId: older.id } })).toMatchObject({ staleReport: true, applyNote: expect.stringContaining('STALE_REPORT') });
    const list = await api().get('/api/v1/calling/interests').set(auth(tc.accessToken)).expect(200);
    expect(list.body.data.find((i: { id: string }) => i.id === interestId)).toMatchObject({ stage: 'APPROVED', bankStatus: { finalDecision: 'Approved', asOf: before.lastMatchedAt.toISOString() } });
    expect(await prisma.payoutEntitlement.count()).toBe(0);

    const newest = await mis([{ 'Application No': 'AU-0630', CURRENT_STAGE: 'Card Dispatched', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'V + ACTIVE' }], day(-1));
    expect(newest.totals).toMatchObject({ staleSkipped: 0, updatedChanged: 1 });
    expect(await prisma.callingBankStatus.findUniqueOrThrow({ where: { callingInterestId: interestId } })).toMatchObject({ currentStage: 'Card Dispatched', lastMatchedBatchId: newest.id });
    expect(await prisma.notification.count({ where: { recipientUserId: tc.id, kind: 'MIS_CHANGED' } })).toBe(notes + 1);
  });
});
