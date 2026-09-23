import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

type Tot = { count: number; amountInr: number };
const BUCKETS = ['eligible', 'available', 'requested', 'approvedUnpaid', 'onHold', 'paid', 'underReview', 'pendingHold'] as const;
const pick = (t: Record<string, Tot>) => Object.fromEntries(BUCKETS.map((b) => [b, t[b]]));
const add = (a: Record<string, Tot>, b: Record<string, Tot>) => Object.fromEntries(BUCKETS.map((k) => [k, { count: a[k].count + b[k].count, amountInr: a[k].amountInr + b[k].amountInr }]));

describe('F-606 payout reconciliation + exceptions (DASH-02 payout population, PAY-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let accounts: string;
  const mgr: { token: string; id: string }[] = [];
  const adv: { token: string; id: string }[] = [];
  let hdfcId: string;
  let ruleId: string;
  let rateId: string;
  let batchId: string;
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const post = (path: string, token: string, body: object) => api().post(`/api/v1${path}`).set(auth(token)).set('idempotency-key', idem()).send(body);
  const get = async (path: string, token: string, status = 200) => (await api().get(`/api/v1${path}`).set(auth(token)).expect(status)).body.data;

  async function ent(advIdx: number, amount: number) {
    const a = adv[advIdx];
    const appNo = `APP-8${String(++seq).padStart(3, '0')}`;
    const card = await prisma.creditCard.findFirstOrThrow({ where: { bankId: hdfcId } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: a.id, reportingParentUserIdSnapshot: a.id, bankId: hdfcId, cardId: card.id, customerFullName: `Cust ${appNo}`, customerMobile: `+9195559${String(seq).padStart(5, '0')}`, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    return prisma.payoutEntitlement.create({ data: { leadId: l.id, advisorUserId: a.id, reportingParentSnapshot: a.id, bankId: hdfcId, cardId: card.id, eventKey: `${hdfcId}|APPLICATION_NO=${appNo}|cardActivationStatus|V + ACTIVE`, ruleId, ruleVersion: 1, rateId, amountInr: amount, evidenceBatchId: batchId, triggerFieldValue: 'V + ACTIVE', eligibleAt: new Date(Date.now() - 1000), state: 'ELIGIBLE_AVAILABLE' } });
  }
  async function reqFor(advIdx: number, ids: string[], approve: 0 | 1 | 2) {
    const r = (await post('/payouts/requests', adv[advIdx].token, { entitlementIds: ids }).expect(201)).body.data;
    const m = mgr[advIdx < 2 ? 0 : 1];
    if (approve >= 1) await post(`/payouts/requests/${r.id}/approvals`, m.token, { decision: 'APPROVED' }).expect(201);
    if (approve >= 2) await post(`/payouts/requests/${r.id}/approvals`, admin, { decision: 'APPROVED' }).expect(201);
    return r.id as string;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    for (const sfx of ['92001', '92002']) {
      const m = await setupManagerAndTelecaller(app, prisma, sfx);
      mgr.push({ token: m.manager.accessToken, id: m.managerId });
    }
    await api().post('/api/v1/users').set(auth(admin)).set('idempotency-key', idem()).send({ role: 'ACCOUNTS', fullName: 'Acc Rec', mobile: '9666600029' }).expect(201);
    accounts = (await loginAs(app, prisma, '9666600029')).accessToken;
    for (const [i, parent] of [0, 0, 1].entries()) {
      const u = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: `+91955599970${i}`, role: 'ADVISOR', status: 'ACTIVE', fullName: `Rec Advisor ${i}` } });
      await prisma.reportingAssignment.create({ data: { childUserId: u.id, parentUserId: mgr[parent].id, source: 'AGENT_CODE', status: 'ACTIVE' } });
      adv.push({ id: u.id, token: (await loginAs(app, prisma, `955599970${i}`)).accessToken });
    }
    ruleId = (await post('/payouts/rules', admin, { bankId: hdfcId, name: 'HDFC activation', triggerValues: ['V + ACTIVE'], effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201)).body.data.id;
    rateId = (await post(`/payouts/rules/${ruleId}/rates`, admin, { amountInr: 1500, effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201)).body.data.rates[0].id;
    await post(`/payouts/rates/${rateId}/approve`, admin, { reason: 'test approval' }).expect(201);
    await post(`/payouts/rules/${ruleId}/approve`, admin, { reason: 'test approval' }).expect(201);
    const profile = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    const adm = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const file = await prisma.storedFile.create({ data: { bucket: 'b', key: 'k', sha256: 'x', originalName: 'b.xlsx', contentType: 'application/octet-stream', sizeBytes: 1, purpose: 'MIS', uploadedByUserId: adm.id } });
    batchId = (await prisma.misImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.MIS_BATCH), bankId: hdfcId, profileId: profile.id, fileId: file.id, uploaderUserId: adm.id, checksum: 'c-606', stage: 'APPLIED', appliedAt: new Date() } })).id;

    // fixture: every bucket populated across three advisors and two teams
    await ent(0, 1500); // available
    const a0req = await ent(0, 1000);
    await reqFor(0, [a0req.id], 0); // requested
    const a0appr = await ent(0, 700);
    await reqFor(0, [a0appr.id], 2); // approved unpaid
    const a1paid = await ent(1, 1500);
    const paidReq = await reqFor(1, [a1paid.id], 2);
    const proof = (await api().post('/api/v1/files/payment_proof').set(auth(accounts)).attach('file', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(201)).body.data.id;
    await post(`/payouts/requests/${paidReq}/payment`, accounts, { paidAt: new Date(Date.now() - 60_000).toISOString(), amountInr: 1500, transferReference: 'UTR-REC-1', proofFileId: proof }).expect(201); // paid
    const a1hold = await ent(1, 400);
    const holdReq = await reqFor(1, [a1hold.id], 2);
    await post(`/payouts/requests/${holdReq}/payment/flag`, accounts, { reason: 'IFSC mismatch with cheque' }).expect(201); // onHold
    const a2 = await ent(2, 2500);
    await reqFor(2, [a2.id], 1); // requested (manager approved, admin pending)
    const held = await ent(2, 300);
    await prisma.payoutEntitlement.update({ where: { id: held.id }, data: { state: 'PENDING_HOLD', eligibleAt: new Date(Date.now() + 86_400_000) } });
  });
  afterAll(async () => app.close());

  it('Advisor ledger == Manager dashboard == Admin == Accounts for the same population; team sums reconcile', async () => {
    const ledgers = [];
    for (const a of adv) ledgers.push(pick((await get('/payouts/me/ledger', a.token)).totals));
    for (const [i, a] of adv.entries()) {
      const team = i < 2 ? mgr[0] : mgr[1];
      expect(pick((await get(`/dashboards/payouts?advisorId=${a.id}`, team.token)).totals)).toEqual(ledgers[i]);
      expect(pick((await get(`/dashboards/payouts?advisorId=${a.id}`, admin)).totals)).toEqual(ledgers[i]);
      expect(pick((await get(`/dashboards/payouts?advisorId=${a.id}`, accounts)).totals)).toEqual(ledgers[i]);
    }
    const team0 = pick((await get('/dashboards/payouts', mgr[0].token)).totals);
    expect(team0).toEqual(add(ledgers[0], ledgers[1]));
    expect(pick((await get(`/dashboards/payouts?managerId=${mgr[0].id}`, admin)).totals)).toEqual(team0);
    const all = await get('/dashboards/payouts', admin);
    expect(pick(all.totals)).toEqual(add(add(ledgers[0], ledgers[1]), ledgers[2]));
    expect(pick((await get('/dashboards/payouts', accounts)).totals)).toEqual(pick(all.totals));
    // every bucket is populated and eligible is the union of the MIS-eligible ones
    expect(all.totals).toMatchObject({ available: { count: 1, amountInr: 1500 }, requested: { count: 2, amountInr: 3500 }, approvedUnpaid: { count: 1, amountInr: 700 }, onHold: { count: 1, amountInr: 400 }, paid: { count: 1, amountInr: 1500 }, pendingHold: { count: 1, amountInr: 300 }, eligible: { count: 7, amountInr: 7900 } });
    // paid = confirmed transfers, not approved totals; backlog + meta
    expect(all.confirmedTransfers).toEqual({ count: 1, amountInr: 1500 });
    expect(all.approvals).toMatchObject({ pendingCount: 2, awaitingManager: 1, awaitingAdmin: 2, aging: { d0_7: 2 } });
    expect(all.meta).toMatchObject({ dateBasis: 'eligibleAt', staleDays: 30, scope: 'ALL' });
    const paidBasis = await get('/dashboards/payouts?dateBasis=paidAt&from=2026-01-01&to=2099-12-31', admin);
    expect(paidBasis.meta.dateBasis).toBe('paidAt');
    expect(paidBasis.totals.eligible).toEqual({ count: 1, amountInr: 1500 }); // only the paid request's event has a paidAt
    // scoping: a Manager cannot look at another team; Advisors have no dashboard
    await get(`/dashboards/payouts?advisorId=${adv[2].id}`, mgr[0].token, 404);
    await get(`/dashboards/payouts?managerId=${mgr[1].id}`, mgr[0].token, 404);
    await get('/dashboards/payouts', adv[0].token, 403);
  });

  it('derived exceptions: hold listed with its resolution path; stale request + MIS correction after payment acknowledged with an audited reason', async () => {
    const before = await get('/payouts/exceptions', admin);
    expect(before.map((e: { kind: string }) => e.kind)).toEqual(['DISCREPANCY_HOLD']);
    expect(before[0]).toMatchObject({ acknowledgeable: false, resolvedVia: expect.stringContaining('Admin releases') });
    // stale: a request older than payouts.requestStaleDays
    const stale = await prisma.payoutRequest.findFirstOrThrow({ where: { state: 'PENDING_APPROVALS', advisorUserId: adv[0].id } });
    await prisma.payoutRequest.update({ where: { id: stale.id }, data: { submittedAt: new Date(Date.now() - 40 * 86_400_000) } });
    // MIS correction after payment (as F-602 records it)
    const paidEnt = await prisma.payoutEntitlement.findFirstOrThrow({ where: { state: 'PAID' } });
    const ev = await prisma.payoutEntitlementEvent.create({ data: { entitlementId: paidEnt.id, fromState: 'PAID', toState: 'PAID', batchId, reason: 'Correction after payment — exception raised: MIS now reports cardActivationStatus = "INACTIVE" (was "V + ACTIVE")' } });
    const dash = await get('/dashboards/payouts', admin);
    expect(dash.exceptions.byKind).toEqual({ DISCREPANCY_HOLD: 1, STALE_REQUEST: 1, MIS_CORRECTION_AFTER_PAYMENT: 1 });
    expect(dash.approvals.aging).toMatchObject({ d31plus: 1 });
    // team scoping of exceptions
    expect((await get('/payouts/exceptions', mgr[1].token)).map((e: { kind: string }) => e.kind)).toEqual([]);
    expect((await get('/payouts/exceptions', mgr[0].token)).map((e: { kind: string }) => e.kind).sort()).toEqual(['DISCREPANCY_HOLD', 'MIS_CORRECTION_AFTER_PAYMENT', 'STALE_REQUEST']);
    // payment-side kinds cannot be acknowledged here; Manager cannot resolve
    expect((await post('/payouts/exceptions/resolve', admin, { kind: 'DISCREPANCY_HOLD', subjectId: stale.id, reason: 'try it' }).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    await post('/payouts/exceptions/resolve', mgr[0].token, { kind: 'STALE_REQUEST', subjectId: stale.id, reason: 'chasing approvers' }).expect(403);
    await post('/payouts/exceptions/resolve', admin, { kind: 'STALE_REQUEST', subjectId: stale.id, reason: 'Manager on leave; approvals chased' }).expect(201);
    await post('/payouts/exceptions/resolve', admin, { kind: 'STALE_REQUEST', subjectId: stale.id, reason: 'again please' }).expect(409);
    await post('/payouts/exceptions/resolve', accounts, { kind: 'MIS_CORRECTION_AFTER_PAYMENT', subjectId: ev.id, reason: 'Bank confirmed reissue; no clawback in MVP' }).expect(201);
    const after = await get('/payouts/exceptions', admin);
    expect(after.map((e: { kind: string }) => e.kind)).toEqual(['DISCREPANCY_HOLD']);
    expect(await prisma.auditLog.count({ where: { action: 'payoutException.resolve' } })).toBe(2);
    // acknowledging never changes money state
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: paidEnt.id } })).state).toBe('PAID');
    expect((await prisma.payoutRequest.findUniqueOrThrow({ where: { id: stale.id } })).state).toBe('PENDING_APPROVALS');
    expect((await get('/payouts/exceptions/resolutions', admin)).length).toBe(2);
  });
});
