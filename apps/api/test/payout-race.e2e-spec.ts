import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CryptoService } from '../src/common/crypto/crypto.service';
import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const past = (mins = 60) => new Date(Date.now() - mins * 60_000).toISOString();

describe('F-908 S2 payout cancel / approve / pay races (PAY-20..PAY-24)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let managerToken: string;
  let managerId: string;
  let accountsToken: string;
  let advToken: string;
  let advId: string;
  let hdfcId: string;
  let ruleId: string;
  let rateId: string;
  let batchId: string;
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const post = (path: string, token: string, body: object) => api().post(`/api/v1${path}`).set(auth(token)).set('idempotency-key', idem()).send(body);

  async function entitlement(amount = 1500) {
    const appNo = `APP-R${String(++seq).padStart(3, '0')}`;
    const card = await prisma.creditCard.findFirstOrThrow({ where: { bankId: hdfcId } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advId, reportingParentUserIdSnapshot: managerId, bankId: hdfcId, cardId: card.id, customerFullName: `Cust ${appNo}`, customerMobile: `+9195558${String(seq).padStart(5, '0')}`, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    return prisma.payoutEntitlement.create({ data: { leadId: l.id, advisorUserId: advId, reportingParentSnapshot: managerId, bankId: hdfcId, cardId: card.id, eventKey: `${hdfcId}|APPLICATION_NO=${appNo}|cardActivationStatus|V + ACTIVE`, ruleId, ruleVersion: 1, rateId, amountInr: amount, evidenceBatchId: batchId, triggerFieldValue: 'V + ACTIVE', eligibleAt: new Date(Date.now() - 1000), state: 'ELIGIBLE_AVAILABLE' } });
  }

  /** A request approved by both the Manager and the Admin, ready for Accounts. */
  async function approvedRequest(amounts: number[] = [1500]) {
    const ents = [];
    for (const a of amounts) ents.push(await entitlement(a));
    const r = (await post('/payouts/requests', advToken, { entitlementIds: ents.map((e) => e.id) }).expect(201)).body.data;
    await post(`/payouts/requests/${r.id}/approvals`, managerToken, { decision: 'APPROVED' }).expect(201);
    // rate-free payouts: Admin's approval sets the amount (here the sum the old rates gave, so the amounts below hold)
    await post(`/payouts/requests/${r.id}/approvals`, adminToken, { decision: 'APPROVED', amountInr: amounts.reduce((x, y) => x + y, 0) }).expect(201);
    return { id: r.id as string, publicRef: r.publicRef as string, ents };
  }

  async function uploadProof(token = accountsToken) {
    return (await api().post('/api/v1/files/payment_proof').set(auth(token)).attach('file', PNG, { filename: `utr-${++seq}.png`, contentType: 'image/png' }).expect(201)).body.data.id as string;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    // one listening server for the parallel requests below (supertest would otherwise bind a port per request)
    await app.listen(0);
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const mgr = await setupManagerAndTelecaller(app, prisma, '91001');
    managerToken = mgr.manager.accessToken;
    managerId = mgr.managerId;
    await api().post('/api/v1/users').set(auth(adminToken)).set('idempotency-key', idem()).send({ role: 'ACCOUNTS', fullName: 'Acc Pay', mobile: '9666600019' }).expect(201);
    const acc = await loginAs(app, prisma, '9666600019');
    accountsToken = acc.accessToken;
    const a = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999601', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Payee Advisor' } });
    advId = a.id;
    await prisma.reportingAssignment.create({ data: { childUserId: a.id, parentUserId: managerId, source: 'AGENT_CODE', status: 'ACTIVE' } });
    const crypto = app.get(CryptoService);
    await prisma.advisorProfile.create({ data: { userId: a.id, onboardingStep: 'COMPLETE', reviewOutcome: 'APPROVED', bankAccountEncrypted: crypto.encrypt('123456789012'), bankAccountLast4: '9012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', accountHolderName: 'Payee Advisor' } });
    advToken = (await loginAs(app, prisma, '9555999601')).accessToken;
    const rule = (await post('/payouts/rules', adminToken, { bankId: hdfcId, name: 'HDFC activation', triggerValues: ['V + ACTIVE'], effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201)).body.data;
    ruleId = rule.id;
    rateId = (await post(`/payouts/rules/${ruleId}/rates`, adminToken, { amountInr: 1500, effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201)).body.data.rates[0].id;
    await post(`/payouts/rates/${rateId}/approve`, adminToken, { reason: 'test approval' }).expect(201);
    await post(`/payouts/rules/${ruleId}/approve`, adminToken, { reason: 'test approval' }).expect(201);
    const profile = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const file = await prisma.storedFile.create({ data: { bucket: 'b', key: 'k', sha256: 'x', originalName: 'b.xlsx', contentType: 'application/octet-stream', sizeBytes: 1, purpose: 'MIS', uploadedByUserId: admin.id } });
    batchId = (await prisma.misImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.MIS_BATCH), bankId: hdfcId, profileId: profile.id, fileId: file.id, uploaderUserId: admin.id, checksum: 'c-605', stage: 'APPLIED', appliedAt: new Date() } })).id;
  });
  afterAll(async () => app.close());

  const states = async (ids: string[]) => (await prisma.payoutEntitlement.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })).map((e) => e.state);
  const pay = async (id: string, amountInr: number, status: number) => {
    const proofFileId = await uploadProof();
    return post(`/payouts/requests/${id}/payment`, accountsToken, { paidAt: past(), amountInr, transferReference: `UTR-RACE-${++seq}`, method: 'NEFT', proofFileId }).expect(status);
  };

  it('PAY-20: cancel after the payment is recorded is refused and the card events stay PAID', async () => {
    const r = await approvedRequest([1500]);
    await pay(r.id, 1500, 201);
    const res = await post(`/payouts/requests/${r.id}/cancel`, adminToken, { reason: 'too late to cancel' }).expect(409);
    expect(res.body.error.code).toBe('PAYOUT_STATE_INVALID');
    expect(await states(r.ents.map((e) => e.id))).toEqual(['PAID']);
    expect((await prisma.payoutRequest.findUniqueOrThrow({ where: { id: r.id } })).state).toBe('PAID');
    expect(Number((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: r.ents[0].id } })).amountInr)).toBe(1500);
  });

  it('PAY-21: Admin cancel racing Accounts payment — exactly one wins and paid card events never return to the pool', async () => {
    for (let round = 0; round < 4; round++) {
      const r = await approvedRequest([1500, 500]);
      const proof = await uploadProof();
      const [cancel, payment] = await Promise.all([
        post(`/payouts/requests/${r.id}/cancel`, adminToken, { reason: `race round ${round}` }),
        post(`/payouts/requests/${r.id}/payment`, accountsToken, { paidAt: past(), amountInr: 2000, transferReference: `UTR-RACE-R${round}`, method: 'NEFT', proofFileId: proof }),
      ]);
      expect([cancel.status, payment.status].sort()).toEqual([201, 409]);
      const req = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: r.id }, include: { payments: true } });
      const ents = await states(r.ents.map((e) => e.id));
      if (req.state === 'PAID') {
        expect(cancel.status).toBe(409);
        expect(ents).toEqual(['PAID', 'PAID']);
      } else {
        expect(req.state).toBe('CANCELLED');
        expect(payment.status).toBe(409);
        expect(req.payments).toHaveLength(0);
        expect(ents).toEqual(['ELIGIBLE_AVAILABLE', 'ELIGIBLE_AVAILABLE']);
      }
    }
  });

  it('PAY-22: approving a request that was cancelled is refused', async () => {
    const ent = await entitlement(1500);
    const r = (await post('/payouts/requests', advToken, { entitlementIds: [ent.id] }).expect(201)).body.data;
    await post(`/payouts/requests/${r.id}/cancel`, adminToken, { reason: 'cancelled by admin' }).expect(201);
    const res = await post(`/payouts/requests/${r.id}/approvals`, managerToken, { decision: 'APPROVED' }).expect(409);
    expect(res.body.error.code).toBe('PAYOUT_STATE_INVALID');
    expect(await prisma.payoutApproval.count({ where: { requestId: r.id } })).toBe(0);
    expect(await states([ent.id])).toEqual(['ELIGIBLE_AVAILABLE']);
  });

  it('PAY-23: Admin approval racing Admin cancel — never an APPROVED request whose card events were released', async () => {
    for (let round = 0; round < 4; round++) {
      const ent = await entitlement(1500);
      const r = (await post('/payouts/requests', advToken, { entitlementIds: [ent.id] }).expect(201)).body.data;
      await post(`/payouts/requests/${r.id}/approvals`, managerToken, { decision: 'APPROVED' }).expect(201);
      const [approve, cancel] = await Promise.all([
        post(`/payouts/requests/${r.id}/approvals`, adminToken, { decision: 'APPROVED', amountInr: 1500 }),
        post(`/payouts/requests/${r.id}/cancel`, adminToken, { reason: `race round ${round}` }),
      ]);
      const req = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: r.id } });
      const [entState] = await states([ent.id]);
      if (req.state === 'CANCELLED') {
        expect(cancel.status).toBe(201);
        expect(entState).toBe('ELIGIBLE_AVAILABLE');
        // an approval that committed first was then cancelled — fine; one that came after must have been refused
        if (approve.status !== 201) expect(approve.body.error.code).toBe('PAYOUT_STATE_INVALID');
      } else {
        expect(req.state).toBe('APPROVED');
        expect(cancel.status).toBe(409);
        expect(entState).toBe('RESERVED');
      }
    }
  });

  it('PAY-24: a cancelled request cannot be cancelled again or paid', async () => {
    const r = await approvedRequest([1500]);
    await post(`/payouts/requests/${r.id}/cancel`, adminToken, { reason: 'first cancel' }).expect(201);
    await post(`/payouts/requests/${r.id}/cancel`, adminToken, { reason: 'second cancel' }).expect(409);
    await pay(r.id, 1500, 409);
    expect(await states(r.ents.map((e) => e.id))).toEqual(['ELIGIBLE_AVAILABLE']);
  });
});
