import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-603 payout requests + reservation / F-604 dual approval (PAY-02, PAY-03, PAY-04, PAY-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let managerToken: string;
  let managerId: string;
  let accountsToken: string;
  let adv1Token: string;
  let adv1Id: string;
  let adv2Token: string;
  let adv2Id: string;
  let hdfcId: string;
  let ruleId: string;
  let rateId: string;
  let batchId: string;
  const api = () => request(app.getHttpServer());

  async function entitlement(advisorUserId: string, appNo: string, amount = 1500, state: 'ELIGIBLE_AVAILABLE' | 'PENDING_HOLD' = 'ELIGIBLE_AVAILABLE') {
    const card = await prisma.creditCard.findFirstOrThrow({ where: { bankId: hdfcId } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId, reportingParentUserIdSnapshot: advisorUserId, bankId: hdfcId, cardId: card.id, customerFullName: `Cust ${appNo}`, customerMobile: `+9195557${appNo.replace(/\D/g, '').padStart(5, '0')}`, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: advisorUserId, verificationStatus: 'VERIFIED_BY_MIS_MATCH' } });
    return prisma.payoutEntitlement.create({ data: { leadId: l.id, advisorUserId, reportingParentSnapshot: advisorUserId, bankId: hdfcId, cardId: card.id, eventKey: `${hdfcId}|APPLICATION_NO=${appNo}|cardActivationStatus|V + ACTIVE`, ruleId, ruleVersion: 1, rateId, amountInr: amount, evidenceBatchId: batchId, triggerFieldValue: 'V + ACTIVE', eligibleAt: new Date(Date.now() - 1000), state } });
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const mgr = await setupManagerAndTelecaller(app, prisma, '90001');
    managerToken = mgr.manager.accessToken;
    managerId = mgr.managerId;
    await api().post('/api/v1/users').set(auth(adminToken)).set('idempotency-key', idem()).send({ role: 'ACCOUNTS', fullName: 'Acc Pay', mobile: '9666600009' }).expect(201);
    accountsToken = (await loginAs(app, prisma, '9666600009')).accessToken;
    const a1 = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999501', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Under Manager' } });
    adv1Id = a1.id;
    await prisma.reportingAssignment.create({ data: { childUserId: a1.id, parentUserId: managerId, source: 'AGENT_CODE', status: 'ACTIVE' } });
    adv1Token = (await loginAs(app, prisma, '9555999501')).accessToken;
    const a2 = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999502', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Under Admin' } });
    adv2Id = a2.id;
    adv2Token = (await loginAs(app, prisma, '9555999502')).accessToken;
    // rule + rate + a stub applied batch for evidence
    const rule = (await api().post('/api/v1/payouts/rules').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'HDFC activation', triggerValues: ['V + ACTIVE'], effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201)).body.data;
    ruleId = rule.id;
    const rate = (await api().post(`/api/v1/payouts/rules/${ruleId}/rates`).set(auth(adminToken)).set('idempotency-key', idem()).send({ amountInr: 1500, effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201)).body.data.rates[0];
    rateId = rate.id;
    await api().post(`/api/v1/payouts/rates/${rateId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test approval' }).expect(201);
    await api().post(`/api/v1/payouts/rules/${ruleId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test approval' }).expect(201);
    const profile = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const file = await prisma.storedFile.create({ data: { bucket: 'b', key: 'k', sha256: 'x', originalName: 'b.xlsx', contentType: 'application/octet-stream', sizeBytes: 1, purpose: 'MIS', uploadedByUserId: admin.id } });
    batchId = (await prisma.misImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.MIS_BATCH), bankId: hdfcId, profileId: profile.id, fileId: file.id, uploaderUserId: admin.id, checksum: 'c1', stage: 'APPLIED', appliedAt: new Date() } })).id;
  });
  afterAll(async () => app.close());

  it('PAY-02: two concurrent requests for the same entitlement → exactly one succeeds; ledger positions; snapshot keeps amount after a rate change', async () => {
    const e1 = await entitlement(adv1Id, 'APP-601');
    const e2 = await entitlement(adv1Id, 'APP-602');
    const held = await entitlement(adv1Id, 'APP-603', 1500, 'PENDING_HOLD');
    await prisma.payoutEntitlement.update({ where: { id: held.id }, data: { eligibleAt: new Date(Date.now() + 86_400_000) } });
    const ledger = (await api().get('/api/v1/payouts/me/ledger').set(auth(adv1Token)).expect(200)).body.data;
    expect(ledger.totals).toMatchObject({ eligible: { count: 3, amountInr: 4500 }, available: { count: 2, amountInr: 3000 }, pendingHold: { count: 1 } });
    expect(ledger.rows.find((r: { entitlementId: string }) => r.entitlementId === e1.id)).toMatchObject({ position: 'Available for claim', rawActivation: 'V + ACTIVE', payableUnderRule: { name: 'HDFC activation', version: 1 }, bankReference: { value: 'APP-601' } });
    // held entitlement not selectable
    const bad = await api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', idem()).send({ entitlementIds: [e1.id, held.id] }).expect(409);
    expect(bad.body.error.code).toBe('PAYOUT_ENTITLEMENT_NOT_AVAILABLE');
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: e1.id } })).state).toBe('ELIGIBLE_AVAILABLE'); // nothing reserved
    // concurrency: same entitlement, two sessions
    const [r1, r2] = await Promise.all([api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', idem()).send({ entitlementIds: [e1.id] }), api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', idem()).send({ entitlementIds: [e1.id] })]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    expect(await prisma.payoutRequest.count()).toBe(1);
    const req = (r1.status === 201 ? r1 : r2).body.data;
    expect(req).toMatchObject({ state: 'PENDING_APPROVALS', itemCount: 1, totalAmountInr: 1500, managerApprover: { id: managerId }, approvals: { outstanding: ['MANAGER', 'ADMIN'] } });
    expect(req.publicRef).toMatch(/^KBS-PR-/);
    // double-tap with the same key replays
    const key = idem();
    const a = await api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', key).send({ all: true }).expect(201);
    const b = await api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', key).send({ all: true }).expect(201);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(a.body.data.items.map((i: { entitlementId: string }) => i.entitlementId)).toEqual([e2.id]); // `all` picks only available
    expect(await prisma.payoutRequest.count()).toBe(2);
    // DB-level guard: a second active item for a reserved entitlement is impossible
    await expect(prisma.payoutRequestItem.create({ data: { requestId: a.body.data.id, entitlementId: e1.id, amountSnapshotInr: 1 } })).rejects.toThrow();
    // scope: adv2 sees nothing of adv1
    expect((await api().get('/api/v1/payouts/me/ledger').set(auth(adv2Token)).expect(200)).body.data.rows).toEqual([]);
    await api().get(`/api/v1/payouts/requests/${req.id}`).set(auth(adv2Token)).expect(404);
    // snapshot immutability: new rate approved → request amount unchanged
    const nr = (await api().post(`/api/v1/payouts/rules/${ruleId}/rates`).set(auth(adminToken)).set('idempotency-key', idem()).send({ amountInr: 100, effectiveFrom: '2026-01-02T00:00:00.000Z' }).expect(201)).body.data.rates.find((x: { amountInr: number }) => x.amountInr === 100);
    await api().post(`/api/v1/payouts/rates/${nr.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'cut' }).expect(201);
    const again = (await api().get(`/api/v1/payouts/requests/${req.id}`).set(auth(adv1Token)).expect(200)).body.data;
    expect(again.totalAmountInr).toBe(1500);
    expect(again.snapshot.items[0].amountInr).toBe(1500);
    expect((await api().get('/api/v1/payouts/me/ledger').set(auth(adv1Token)).expect(200)).body.data.rows.find((r: { entitlementId: string }) => r.entitlementId === e1.id).position).toBe('Manager approval pending');
  });

  it('PAY-03/PAY-07: Accounts queue empty until BOTH approvals; Admin ≠ both; MANAGER_FIRST order; audit rows', async () => {
    const req = (await api().get('/api/v1/payouts/requests').set(auth(adv1Token)).expect(200)).body.data.find((r: { itemCount: number }) => r.itemCount === 1);
    // Accounts sees nothing yet
    expect((await api().get('/api/v1/payouts/requests').set(auth(accountsToken)).expect(200)).body.data).toEqual([]);
    // Manager-first ordering blocks Admin
    await api().put('/api/v1/config/payouts.approvalOrder').set(auth(adminToken)).send({ value: 'MANAGER_FIRST', reason: 'policy' }).expect(200);
    await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(adminToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(409);
    // advisor cannot approve; another manager cannot
    await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(adv1Token)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(403);
    const other = await setupManagerAndTelecaller(app, prisma, '90002');
    await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(other.manager.accessToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(404);
    // manager approves
    const m = await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(managerToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(201);
    expect(m.body.data).toMatchObject({ state: 'PENDING_APPROVALS', approvals: { manager: { decision: 'APPROVED', by: { id: managerId } }, admin: null, outstanding: ['ADMIN'] } });
    await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(managerToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(409); // duplicate
    expect((await api().get('/api/v1/payouts/requests').set(auth(accountsToken)).expect(200)).body.data).toEqual([]); // still not in Accounts queue
    expect((await api().get('/api/v1/payouts/requests?awaitingMe=true').set(auth(adminToken)).expect(200)).body.data.map((r: { id: string }) => r.id)).toContain(req.id);
    // admin approves → APPROVED → Accounts queue
    const ad = await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(adminToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(201);
    expect(ad.body.data).toMatchObject({ state: 'APPROVED', approvals: { outstanding: [] } });
    expect(await prisma.payoutApproval.count({ where: { requestId: req.id } })).toBe(2); // Admin action never counted as both
    const acct = await api().get('/api/v1/payouts/requests').set(auth(accountsToken)).expect(200);
    expect(acct.body.data.map((r: { id: string }) => r.id)).toEqual([req.id]);
    expect(await prisma.auditLog.count({ where: { action: 'payoutRequest.decide', entityId: req.id } })).toBe(2);
    expect(await prisma.notification.count({ where: { kind: 'PAYOUT_READY_FOR_PAYMENT' } })).toBe(1);
    expect((await api().get('/api/v1/payouts/me/ledger').set(auth(adv1Token)).expect(200)).body.data.totals.approvedUnpaid).toMatchObject({ count: 1, amountInr: 1500 });
    await api().put('/api/v1/config/payouts.approvalOrder').set(auth(adminToken)).send({ value: 'ANY', reason: 'reset' }).expect(200);
  });

  it('rejection releases items with reason; Advisor cancel before approval; Admin cancel later', async () => {
    const req2 = (await api().get('/api/v1/payouts/requests?state=PENDING_APPROVALS').set(auth(adv1Token)).expect(200)).body.data[0];
    await api().post(`/api/v1/payouts/requests/${req2.id}/approvals`).set(auth(managerToken)).set('idempotency-key', idem()).send({ decision: 'REJECTED' }).expect(400); // reason required
    const rej = await api().post(`/api/v1/payouts/requests/${req2.id}/approvals`).set(auth(managerToken)).set('idempotency-key', idem()).send({ decision: 'REJECTED', reason: 'card reissued, verify with bank' }).expect(201);
    expect(rej.body.data.state).toBe('REJECTED');
    const ent = await prisma.payoutEntitlement.findFirstOrThrow({ where: { requestItems: { some: { requestId: req2.id } } } });
    expect(ent.state).toBe('ELIGIBLE_AVAILABLE');
    expect(await prisma.payoutRequestItem.count({ where: { requestId: req2.id, active: true } })).toBe(0);
    expect((await prisma.notification.findFirstOrThrow({ where: { recipientUserId: adv1Id, kind: 'PAYOUT_DECISION', title: 'Payout request rejected' } })).body).toContain('card reissued');
    // resubmit allowed; advisor cancels before any approval
    const r3 = (await api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', idem()).send({ entitlementIds: [ent.id] }).expect(201)).body.data;
    expect(r3.me.canCancel).toBe(true);
    await api().post(`/api/v1/payouts/requests/${r3.id}/cancel`).set(auth(adv1Token)).set('idempotency-key', idem()).send({ reason: 'wrong selection' }).expect(201);
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).state).toBe('ELIGIBLE_AVAILABLE');
    // after a manager approval the advisor can no longer cancel, Admin can
    const r4 = (await api().post('/api/v1/payouts/requests').set(auth(adv1Token)).set('idempotency-key', idem()).send({ entitlementIds: [ent.id] }).expect(201)).body.data;
    await api().post(`/api/v1/payouts/requests/${r4.id}/approvals`).set(auth(managerToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(201);
    await api().post(`/api/v1/payouts/requests/${r4.id}/cancel`).set(auth(adv1Token)).set('idempotency-key', idem()).send({ reason: 'changed my mind' }).expect(409);
    await api().post(`/api/v1/payouts/requests/${r4.id}/cancel`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'duplicate card event under investigation' }).expect(201);
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).state).toBe('ELIGIBLE_AVAILABLE');
  });

  it('PAY-04: Advisor under Admin → refused without designated approver; with one, that Manager must approve', async () => {
    const e = await entitlement(adv2Id, 'APP-604');
    const refused = await api().post('/api/v1/payouts/requests').set(auth(adv2Token)).set('idempotency-key', idem()).send({ entitlementIds: [e.id] }).expect(409);
    expect(refused.body.error.code).toBe('CONFIG_MISSING');
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: e.id } })).state).toBe('ELIGIBLE_AVAILABLE');
    await api().put('/api/v1/config/payouts.designatedApproverManagerUserId').set(auth(adminToken)).send({ value: managerId, reason: 'KBS designated approver' }).expect(200);
    const req = (await api().post('/api/v1/payouts/requests').set(auth(adv2Token)).set('idempotency-key', idem()).send({ entitlementIds: [e.id] }).expect(201)).body.data;
    expect(req.managerApprover.id).toBe(managerId);
    // Admin alone cannot complete it
    await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(adminToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(201);
    expect((await api().get(`/api/v1/payouts/requests/${req.id}`).set(auth(adv2Token)).expect(200)).body.data).toMatchObject({ state: 'PENDING_APPROVALS', approvals: { outstanding: ['MANAGER'] } });
    expect((await api().get('/api/v1/payouts/requests?awaitingMe=true').set(auth(managerToken)).expect(200)).body.data.map((r: { id: string }) => r.id)).toContain(req.id);
    await api().post(`/api/v1/payouts/requests/${req.id}/approvals`).set(auth(managerToken)).set('idempotency-key', idem()).send({ decision: 'APPROVED' }).expect(201);
    expect((await api().get(`/api/v1/payouts/requests/${req.id}`).set(auth(adv2Token)).expect(200)).body.data.state).toBe('APPROVED');
  });
});
