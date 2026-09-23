import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';
import { hdfcWorkbook, type MisRowInput, XLSX_TYPE } from './mis-fixture';

describe('F-503 preview / F-504 matching + resolution / F-505 apply (MIS-02…MIS-10, INV-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let hdfcId: string;
  let profileId: string;
  let advisorId: string;
  const api = () => request(app.getHttpServer());
  const leads: Record<string, string> = {};

  async function batch(rows: MisRowInput[], name: string) {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', await hdfcWorkbook(rows), { filename: name, contentType: XLSX_TYPE }).expect(201);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId: up.body.data.id }).expect(201);
    expect(b.body.data.stage).toBe('MAPPED');
    return b.body.data.id as string;
  }
  async function lead(ref: string, appNo: string | null, mobile: string) {
    const bank = await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } });
    const card = await prisma.creditCard.findFirstOrThrow({ where: { bankId: bank.id } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advisorId, reportingParentUserIdSnapshot: advisorId, bankId: bank.id, cardId: card.id, customerFullName: `Customer ${ref}`, customerMobile: mobile, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    if (appNo) await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: bank.id, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: advisorId } });
    leads[ref] = l.id;
    return l.id;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    const p = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    profileId = p.id;
    await api().post(`/api/v1/mis/profiles/${profileId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test' }).expect(201);
    const adv = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999001', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv One' } });
    advisorId = adv.id;
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    await lead('A', 'APP-001', '+919555700001');
    await lead('B', 'APP-002', '+919555700002');
    await lead('C', 'APP-003', '+919555700003');
    await lead('D', null, '+919555700004'); // no reference yet
  });
  afterAll(async () => app.close());

  it('MIS-07 / INV-01: no module outside the apply context can write bank status', async () => {
    await expect(prisma.bankStatusSnapshot.create({ data: { leadId: leads.A as string, bankId: hdfcId, rawLatest: {}, lastMatchedBatchId: 'x', lastMatchedAt: new Date(), firstMatchedAt: new Date() } })).rejects.toThrow(/INV-01/);
    await expect(prisma.bankStatusHistory.deleteMany({})).rejects.toThrow(/INV-01/);
  });

  it('MIS-09: exact-reference matching only; same name never matches; disagreement/duplicates quarantined; preview masks PII', async () => {
    const id = await batch(
      [
        { 'Application No': 'APP-001', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', 'Card Activation Staus': '#N/A', CUSTOMER_NAME: 'Customer A', FINAL_DECISION_DATE: '10-09-2026 09:00:00' },
        { 'Application No': 'APP-002', APPLICATION_REFERENCE_NUMBER: 'REF-003', CURRENT_STAGE: 'Document Curing', CUSTOMER_NAME: 'Customer B' }, // APP-002 → B but REF-003 → C after we link it → disagreement
        { 'Application No': 'APP-999', CURRENT_STAGE: 'In-Complete Application', CUSTOMER_NAME: 'Customer D' }, // same customer name as D → still UNMATCHED
        { 'Application No': 'APP-003', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Declined', CUSTOMER_NAME: 'Customer C' },
        { 'Application No': 'APP-003', CURRENT_STAGE: 'Document Curing', FINAL_DECISION: '', CUSTOMER_NAME: 'Customer C' }, // divergent duplicate
        { CUSTOMER_NAME: 'nobody', CURRENT_STAGE: 'x' },
      ],
      'b1.xlsx',
    );
    await prisma.bankApplicationLinkage.create({ data: { leadId: leads.C as string, bankId: hdfcId, referenceKind: 'APPLICATION_REFERENCE_NUMBER', referenceValue: 'REF-003', source: 'ADVISOR_ENTERED', enteredByUserId: advisorId } });
    const pv = await api().post(`/api/v1/mis/batches/${id}/preview`).set(auth(adminToken)).expect(201);
    const r = pv.body.data;
    expect(r.totals).toMatchObject({ rows: 6, MATCHED: 1, UNMATCHED: 1, CONFLICT: 3, INVALID: 1 });
    expect(r.referenceCoverage).toBe(83);
    expect(r.newValues.currentStage).toEqual(['x']);
    expect(r.duplicateReferences).toEqual([{ reference: 'APPLICATION_NO=APP-003', rows: 2 }]);
    expect(JSON.stringify(r)).not.toContain('Customer A');
    expect(r.samples.matched[0].customer).toBe('C••••••');
    const rows = (await api().get(`/api/v1/mis/batches/${id}/rows`).set(auth(adminToken)).expect(200)).body.data as Array<{ sourceRowNumber: number; matchState: string; matchExplanation: string; id: string }>;
    const byRow = Object.fromEntries(rows.map((x) => [x.sourceRowNumber, x]));
    expect(byRow[2].matchState).toBe('MATCHED');
    expect(byRow[3]).toMatchObject({ matchState: 'CONFLICT', matchExplanation: expect.stringContaining('REFERENCE_DISAGREEMENT') });
    expect(byRow[4].matchState).toBe('UNMATCHED');
    expect(byRow[5]).toMatchObject({ matchState: 'CONFLICT', matchExplanation: expect.stringContaining('DUPLICATE_IN_BATCH_DIVERGENT') });
    expect(byRow[6].matchState).toBe('CONFLICT');
    expect(byRow[7].matchState).toBe('INVALID');
    expect((await api().get(`/api/v1/mis/batches/${id}`).set(auth(adminToken)).expect(200)).body.data.stage).toBe('PREVIEWED');

    // resolution: prefer row 5 over row 6; link row 4 (APP-999) to lead D by Admin
    await api().post(`/api/v1/mis/rows/${byRow[6].id}/resolve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ action: 'PREFER_ROW', rowId: byRow[5].id, reason: 'later status wins' }).expect(201);
    const link = await api().post(`/api/v1/mis/rows/${byRow[4].id}/resolve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ action: 'LINK_TO_LEAD', leadId: leads.D, referenceKind: 'APPLICATION_NO', reason: 'confirmed with bank' }).expect(201);
    expect(link.body.data).toMatchObject({ matchState: 'MATCHED', matchedLeadId: leads.D });
    const linkage = await prisma.bankApplicationLinkage.findFirstOrThrow({ where: { leadId: leads.D as string } });
    expect(linkage).toMatchObject({ referenceValue: 'APP-999', source: 'MIS_RESOLVED_BY_ADMIN', verificationStatus: 'VERIFIED_BY_MIS_MATCH' });
    expect(await prisma.auditLog.count({ where: { action: 'misRow.resolve' } })).toBe(2);
    // ignore the disagreement row with reason
    await api().post(`/api/v1/mis/rows/${byRow[3].id}/resolve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ action: 'IGNORE', reason: 'bank to clarify' }).expect(201);

    // apply
    const ap = await api().post(`/api/v1/mis/batches/${id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    expect(ap.body.data).toMatchObject({ updatedChanged: 3, updatedNoChange: 0, conflicts: 0, ignored: 2, invalid: 1, needsReview: 0 });
    // MIS-02/03: three fields independent + verbatim; #N/A → null + REPORTED_BLANK; display rules
    const A = await api().get(`/api/v1/leads/${leads.A}`).set(auth(adminToken)).expect(200);
    expect(A.body.data.bankStatus).toMatchObject({ matched: true, provenance: 'BANK_MIS', stage: 'Decisioned Cases', decision: 'Approved', activation: 'Not reported' });
    const snapA = await prisma.bankStatusSnapshot.findUniqueOrThrow({ where: { leadId: leads.A as string } });
    expect(snapA).toMatchObject({ currentStage: 'Decisioned Cases', finalDecision: 'Approved', cardActivationStatus: null });
    expect(snapA.finalDecisionDate?.toISOString()).toBe('2026-09-10T03:30:00.000Z');
    expect(snapA.lastMatchedBatchId).toBe(id);
    const histA = await prisma.bankStatusHistory.findMany({ where: { leadId: leads.A as string } });
    expect(histA.find((h) => h.field === 'cardActivationStatus')?.changeKind).toBe('REPORTED_BLANK');
    expect(histA.find((h) => h.field === 'finalDecision')).toMatchObject({ changeKind: 'SET', newValue: 'Approved' });
    expect(histA.find((h) => h.field === 'finalDecision')?.reportedEventDate?.toISOString()).toBe('2026-09-10T03:30:00.000Z');
    // lead A's advisor linkage got verified by the match (F-407 §3)
    expect((await prisma.bankApplicationLinkage.findFirstOrThrow({ where: { leadId: leads.A as string } })).verificationStatus).toBe('VERIFIED_BY_MIS_MATCH');
    expect(A.body.data.bankReference.status).toBe('VERIFIED_BY_MIS_MATCH');
    // the preferred duplicate row (row 5) applied to C
    const C = await api().get(`/api/v1/leads/${leads.C}`).set(auth(adminToken)).expect(200);
    expect(C.body.data.bankStatus).toMatchObject({ stage: 'Decisioned Cases', decision: 'Declined' });
    // events + notifications only for changed leads
    expect(await prisma.outboxEvent.count({ where: { type: 'mis.lead.changed' } })).toBe(3);
    // NOTIF-01 (F-701): first match → MIS_MATCHED naming raw field = value and the batch; only owning Advisor, their Manager, Admin
    const matched = await prisma.notification.findMany({ where: { kind: 'MIS_MATCHED' } });
    const batchRef = (await prisma.misImportBatch.findUniqueOrThrow({ where: { id } })).publicRef;
    expect(new Set(matched.map((n) => (n.deepLink as { entityId: string }).entityId))).toEqual(new Set([leads.A, leads.C, leads.D]));
    const nA = matched.filter((n) => (n.deepLink as { entityId: string }).entityId === leads.A);
    const leadA = await prisma.lead.findUniqueOrThrow({ where: { id: leads.A as string } });
    const parentA = await prisma.reportingAssignment.findFirst({ where: { childUserId: leadA.advisorUserId, effectiveTo: null }, include: { parent: { select: { id: true, role: true } } } });
    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const allowed = new Set([leadA.advisorUserId, adminUser.id, ...(parentA?.parent.role === 'MANAGER' ? [parentA.parent.id] : [])]);
    expect(new Set(nA.map((n) => n.recipientUserId))).toEqual(allowed);
    expect(nA[0].body).toContain(`batch ${batchRef}`);
    expect(nA[0].body).toContain('Final decision = "Approved"');
    expect(nA[0].body).not.toContain('Card activation'); // a blank (#N/A) activation is not a change and is not claimed
    expect(nA[0].body).not.toMatch(/\bactivated\b/i);
    expect(await prisma.notification.count({ where: { kind: 'MIS_CHANGED' } })).toBe(0);
    expect(await prisma.notification.count({ where: { kind: 'MIS_IMPORT_RESULT' } })).toBe(1);
    const notifBefore = await prisma.notification.count();

    // MIS-08: applying again → no new history/events
    const before = { h: await prisma.bankStatusHistory.count(), e: await prisma.outboxEvent.count() };
    const b2 = await batch(
      [
        { 'Application No': 'APP-001', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', 'Card Activation Staus': '#N/A', CUSTOMER_NAME: 'Customer A', FINAL_DECISION_DATE: '10-09-2026 09:00:00', 'Creation Date': '01-09-2026' },
      ],
      'b1-again.xlsx',
    );
    const ap2 = await api().post(`/api/v1/mis/batches/${b2}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    expect(ap2.body.data).toMatchObject({ updatedChanged: 0, updatedNoChange: 1 });
    expect(await prisma.outboxEvent.count()).toBe(before.e); // no fake transition
    expect(await prisma.bankStatusHistory.count({ where: { batchId: b2, changeKind: 'CONFIRMED_SAME' } })).toBeGreaterThan(0);
    expect(await prisma.bankStatusHistory.count({ where: { batchId: b2, changeKind: { in: ['SET', 'CHANGED'] } } })).toBe(0);
    expect(await prisma.notification.count({ where: { kind: { in: ['MIS_CHANGED', 'MIS_MATCHED'] } } })).toBe(matched.length); // identical re-apply → zero new MIS notifications
    expect(await prisma.notification.count()).toBe(notifBefore + 1); // only the batch result for the uploader
  });

  it('MIS-10 / MIS-05: later correction → CHANGED with reported date ≠ upload time; FULL_SNAPSHOT absence recorded without touching values', async () => {
    await prisma.misImportProfile.update({ where: { id: profileId }, data: { snapshotMode: 'FULL_SNAPSHOT' } });
    const b3 = await batch([{ 'Application No': 'APP-001', CURRENT_STAGE: 'Decisioned Cases and Card setup completed', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'V + ACTIVE', FINAL_DECISION_DATE: '10-09-2026 09:00:00' }], 'b3.xlsx');
    const ap = await api().post(`/api/v1/mis/batches/${b3}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    expect(ap.body.data.updatedChanged).toBe(1);
    const A = await api().get(`/api/v1/leads/${leads.A}`).set(auth(adminToken)).expect(200);
    expect(A.body.data.bankStatus).toMatchObject({ stage: 'Decisioned Cases and Card setup completed', decision: 'Approved', activation: 'V + ACTIVE' });
    const h = await prisma.bankStatusHistory.findFirstOrThrow({ where: { leadId: leads.A as string, batchId: b3, field: 'cardActivationStatus' } });
    expect(h).toMatchObject({ changeKind: 'SET', oldValue: null, newValue: 'V + ACTIVE' });
    const stage = await prisma.bankStatusHistory.findFirstOrThrow({ where: { leadId: leads.A as string, batchId: b3, field: 'currentStage' } });
    expect(stage).toMatchObject({ changeKind: 'CHANGED', oldValue: 'Decisioned Cases' });
    expect(stage.reportedEventDate?.getTime()).not.toBe(stage.importedAt.getTime());
    // leads C and D were matched earlier but absent from this FULL_SNAPSHOT → ABSENT_FROM_BATCH; values + lastMatchedAt untouched
    const absent = await prisma.bankStatusHistory.findMany({ where: { batchId: b3, changeKind: 'ABSENT_FROM_BATCH' } });
    expect(absent.map((a) => a.leadId).sort()).toEqual([leads.C, leads.D].sort());
    const snapC = await prisma.bankStatusSnapshot.findUniqueOrThrow({ where: { leadId: leads.C as string } });
    expect(snapC.finalDecision).toBe('Declined');
    expect(snapC.lastMatchedBatchId).not.toBe(b3);
    const C = await api().get(`/api/v1/leads/${leads.C}`).set(auth(adminToken)).expect(200);
    expect(C.body.data.bankStatus.decision).toBe('Declined');
    // F-701: a later change cites only the changed raw fields with the bank's own words
    const changedN = await prisma.notification.findFirstOrThrow({ where: { kind: 'MIS_CHANGED', recipientUserId: (await prisma.lead.findUniqueOrThrow({ where: { id: leads.A as string } })).advisorUserId } });
    expect(changedN.body).toContain('Card activation reported as "V + ACTIVE"');
    expect(changedN.body).toContain('Current stage = "Decisioned Cases and Card setup completed"');
    expect(changedN.body).not.toContain('Final decision');
    // history endpoint groups by batch, newest first
    const hist = await api().get(`/api/v1/leads/${leads.A}/mis-history`).set(auth(adminToken)).expect(200);
    expect(hist.body.data).toHaveLength(3);
    expect(hist.body.data[0].changes.find((c: { field: string }) => c.field === 'cardActivationStatus')).toMatchObject({ changeKind: 'SET', newValue: 'V + ACTIVE' });
  });

  it('F-507: integrity dashboard figures reconcile with batch totals and row states; quarantine lists UNMATCHED/CONFLICT across batches', async () => {
    const d = (await api().get(`/api/v1/dashboards/mis-integrity?bankId=${hdfcId}`).set(auth(adminToken)).expect(200)).body.data;
    expect(d.banks).toHaveLength(1);
    const b = d.banks[0];
    const batches = await prisma.misImportBatch.findMany({ where: { bankId: hdfcId } });
    const rows = await prisma.misRow.groupBy({ by: ['matchState'], where: { batch: { bankId: hdfcId } }, _count: { _all: true } });
    const n = (st: string) => rows.find((r) => r.matchState === st)?._count._all ?? 0;
    expect(b.rows).toEqual({ imported: rows.reduce((a, r) => a + r._count._all, 0), matched: n('MATCHED'), unmatched: n('UNMATCHED'), invalid: n('INVALID'), conflicted: n('CONFLICT'), duplicate: n('DUPLICATE_IN_BATCH'), ignored: n('IGNORED'), pending: n('PENDING') });
    expect(b.batches.APPLIED).toBe(batches.filter((x) => x.stage === 'APPLIED').length);
    // per-batch totals sum to the same unmatched/conflict/invalid figures
    const sum = (k: string) => batches.reduce((a, x) => a + Number(((x.totals as Record<string, number> | null) ?? {})[k] ?? 0), 0);
    expect(b.rows.invalid).toBe(sum('invalid'));
    expect(b.rows.unmatched + b.rows.conflicted).toBe(sum('needsReview'));
    expect(b.quarantine).toBe(b.rows.unmatched + b.rows.conflicted);
    expect(b.lastUploadAt).toBe(batches.map((x) => x.uploadedAt.toISOString()).sort().at(-1));
    expect(b.leads.total).toBe(await prisma.lead.count({ where: { bankId: hdfcId } }));
    expect(b.leads.neverMatched).toBe(await prisma.lead.count({ where: { bankId: hdfcId, statusSnapshot: null } }));
    expect(b.advisorReferencesNeverMatched).toBe(await prisma.bankApplicationLinkage.count({ where: { bankId: hdfcId, supersededAt: null, source: 'ADVISOR_ENTERED', verificationStatus: { not: 'VERIFIED_BY_MIS_MATCH' } } }));
    expect(b.newValuesPending.length).toBeGreaterThan(0); // verbatim values not yet acknowledged on the profile
    expect(b.correctionsUnderReview).toBe(0);
    const q = (await api().get(`/api/v1/dashboards/mis-integrity/quarantine?bankId=${hdfcId}`).set(auth(adminToken)).expect(200)).body;
    expect(q.meta.total).toBe(b.quarantine);
    expect(q.data.every((r: { matchState: string }) => r.matchState === 'UNMATCHED' || r.matchState === 'CONFLICT')).toBe(true);
    expect(JSON.stringify(q.data)).not.toContain('Customer A'); // masked
    // out of range → nothing counted, but lead freshness figures are not range-bound
    const empty = (await api().get(`/api/v1/dashboards/mis-integrity?bankId=${hdfcId}&from=2000-01-01&to=2000-01-02`).set(auth(adminToken)).expect(200)).body.data.banks[0];
    expect(empty.rows.imported).toBe(0);
    expect(empty.leads.total).toBe(b.leads.total);
  });
});
