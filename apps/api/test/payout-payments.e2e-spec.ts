import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CryptoService } from '../src/common/crypto/crypto.service';
import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const past = (mins = 60) => new Date(Date.now() - mins * 60_000).toISOString();

describe('F-605 Accounts payment recording (PAY-05, PAY-06, PAY-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let managerToken: string;
  let managerId: string;
  let accountsToken: string;
  let accountsId: string;
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
    const appNo = `APP-9${String(++seq).padStart(3, '0')}`;
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
    await post(`/payouts/requests/${r.id}/approvals`, adminToken, { decision: 'APPROVED' }).expect(201);
    return { id: r.id as string, publicRef: r.publicRef as string, ents };
  }

  async function uploadProof(token = accountsToken) {
    return (await api().post('/api/v1/files/payment_proof').set(auth(token)).attach('file', PNG, { filename: `utr-${++seq}.png`, contentType: 'image/png' }).expect(201)).body.data.id as string;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const mgr = await setupManagerAndTelecaller(app, prisma, '91001');
    managerToken = mgr.manager.accessToken;
    managerId = mgr.managerId;
    await api().post('/api/v1/users').set(auth(adminToken)).set('idempotency-key', idem()).send({ role: 'ACCOUNTS', fullName: 'Acc Pay', mobile: '9666600019' }).expect(201);
    const acc = await loginAs(app, prisma, '9666600019');
    accountsToken = acc.accessToken;
    accountsId = (await prisma.user.findUniqueOrThrow({ where: { mobile: '+919666600019' } })).id;
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

  it('PAY-05/PAY-06: payment with proof → PAID; entitlements Paid for this event; ledger + MIS untouched; full trace; Advisor receipt only', async () => {
    // the cancelled request below leaves one event available again — available counts only unreserved, unpaid events
    const pendingOnly = (await post('/payouts/requests', advToken, { entitlementIds: [(await entitlement()).id] }).expect(201)).body.data;
    await api().get(`/api/v1/payouts/requests/${pendingOnly.id}`).set(auth(accountsToken)).expect(404); // PAY-03: not before both approvals
    await api().get(`/api/v1/payouts/requests/${pendingOnly.id}/payee`).set(auth(accountsToken)).expect(404);
    await post(`/payouts/requests/${pendingOnly.id}/cancel`, advToken, { reason: 'test cleanup' }).expect(201);
    const r = await approvedRequest([1500, 1500]);
    const bankRowsBefore = [await prisma.bankStatusSnapshot.count(), await prisma.bankStatusHistory.count()];
    // Accounts queue + masked payee
    const q = (await api().get('/api/v1/payouts/requests?queue=awaiting').set(auth(accountsToken)).expect(200)).body.data;
    expect(q.map((x: { id: string }) => x.id)).toEqual([r.id]);
    const detail = (await api().get(`/api/v1/payouts/requests/${r.id}`).set(auth(accountsToken)).expect(200)).body.data;
    expect(detail).toMatchObject({ state: 'APPROVED', totalAmountInr: 3000, payee: { accountMasked: '••••••9012', ifsc: 'HDFC0001234', verified: true }, payments: { canRecord: true, proofRequired: true } });
    expect(JSON.stringify(detail)).not.toContain('123456789012');
    // reveal is logged
    const rev = (await api().get(`/api/v1/payouts/requests/${r.id}/payee?reveal=bank`).set(auth(accountsToken)).expect(200)).body.data;
    expect(rev.accountNumber).toBe('123456789012');
    expect(await prisma.sensitiveAccessLog.count({ where: { actorUserId: accountsId, field: 'BANK_ACCOUNT', purpose: 'PAYOUT_PAYMENT' } })).toBe(1);
    await api().get(`/api/v1/payouts/requests/${r.id}/payee`).set(auth(managerToken)).expect(403);
    // Manager/Admin/Advisor cannot record
    await post(`/payouts/requests/${r.id}/payment`, adminToken, { paidAt: past(), amountInr: 3000, transferReference: 'UTR-X' }).expect(403);
    await post(`/payouts/requests/${r.id}/payment`, advToken, { paidAt: past(), amountInr: 3000, transferReference: 'UTR-X' }).expect(403);
    // record with proof
    const proof = await uploadProof();
    const paid = (await post(`/payouts/requests/${r.id}/payment`, accountsToken, { paidAt: past(), amountInr: 3000, transferReference: 'hdfc utr 0001', method: 'NEFT', proofFileId: proof }).expect(201)).body.data;
    expect(paid).toMatchObject({ state: 'PAID', payment: { state: 'VERIFIED', amountInr: 3000, transferReference: 'hdfc utr 0001', proofFileId: proof, recordedBy: { id: accountsId } }, payments: { canRecord: false } });
    expect((await prisma.payoutEntitlement.findMany({ where: { id: { in: r.ents.map((e) => e.id) } } })).map((e) => e.state)).toEqual(['PAID', 'PAID']);
    expect(await prisma.payoutEntitlementEvent.count({ where: { requestId: r.id, toState: 'PAID' } })).toBe(2);
    expect(await prisma.outboxEvent.count({ where: { type: 'payouts.request.paid' } })).toBe(1);
    // PAY-06: available excludes paid, paid totals = confirmed transfer, MIS snapshot/history untouched, raw activation unchanged
    const ledger = (await api().get('/api/v1/payouts/me/ledger').set(auth(advToken)).expect(200)).body.data;
    expect(ledger.totals).toMatchObject({ available: { count: 1 }, paid: { count: 2, amountInr: 3000 }, approvedUnpaid: { count: 0 } });
    expect(ledger.rows.filter((x: { entitlementId: string }) => r.ents.some((e) => e.id === x.entitlementId)).map((x: { position: string; rawActivation: string }) => `${x.position}|${x.rawActivation}`)).toEqual(['Paid|V + ACTIVE', 'Paid|V + ACTIVE']);
    expect([await prisma.bankStatusSnapshot.count(), await prisma.bankStatusHistory.count()]).toEqual(bankRowsBefore);
    await post('/payouts/requests', advToken, { entitlementIds: [r.ents[0].id] }).expect(409); // paid event never claimable again
    // Advisor: receipt summary, no proof, no operator, masked reference
    const adv = (await api().get(`/api/v1/payouts/requests/${r.id}`).set(auth(advToken)).expect(200)).body.data;
    expect(adv.receipt).toMatchObject({ state: 'VERIFIED', amountInr: 3000, transferReferenceMasked: '•••••••0001', method: 'NEFT' });
    expect(adv.payment).toBeNull();
    expect(adv.paymentHistory).toEqual([]);
    expect(adv.payee).toBeNull();
    expect(JSON.stringify(adv)).not.toContain(proof);
    expect(await prisma.notification.count({ where: { recipientUserId: advId, kind: 'PAYOUT_PAID' } })).toBe(1);
    // Manager: full trace incl. proof file access; Advisor cannot open the proof
    const mgr = (await api().get(`/api/v1/payouts/requests/${r.id}`).set(auth(managerToken)).expect(200)).body.data;
    expect(mgr).toMatchObject({ approvals: { manager: { decision: 'APPROVED' }, admin: { decision: 'APPROVED' } }, payment: { proofFileId: proof } });
    await api().get(`/api/v1/files/${proof}/url`).set(auth(managerToken)).expect(200);
    await api().get(`/api/v1/files/${proof}/url`).set(auth(advToken)).expect(404);
    // second payment of the same request refused
    const again = await post(`/payouts/requests/${r.id}/payment`, accountsToken, { paidAt: past(), amountInr: 3000, transferReference: 'UTR-OTHER-1' }).expect(409);
    expect(again.body.error.code).toBe('PAYOUT_STATE_INVALID');
    expect(await prisma.auditLog.count({ where: { action: 'payment.record', entityId: r.id } })).toBe(1);
  });

  it('PAY-07: duplicate reference refused (case/space-insensitive); wrong amount → exception + ON_HOLD; missing proof → pending-proof queue', async () => {
    const dup = await approvedRequest();
    const d = await post(`/payouts/requests/${dup.id}/payment`, accountsToken, { paidAt: past(), amountInr: 1500, transferReference: 'HDFCUTR 0001' }).expect(409);
    expect(d.body.error.code).toBe('PAYOUT_DUPLICATE_TRANSFER_REFERENCE');
    expect(await prisma.externalPayment.count({ where: { requestId: dup.id } })).toBe(0);
    // missing proof → PAYMENT_RECORDED_PENDING_PROOF, entitlements still reserved
    const pend = (await post(`/payouts/requests/${dup.id}/payment`, accountsToken, { paidAt: past(), amountInr: 1500, transferReference: 'UTR-0002' }).expect(201)).body.data;
    expect(pend).toMatchObject({ state: 'PAYMENT_RECORDED_PENDING_PROOF', payment: { state: 'PROOF_PENDING' }, payments: { canAttachProof: true } });
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: dup.ents[0].id } })).state).toBe('RESERVED');
    expect((await api().get('/api/v1/payouts/requests?queue=exceptions').set(auth(accountsToken)).expect(200)).body.data.map((x: { id: string }) => x.id)).toContain(dup.id);
    expect((await api().get('/api/v1/payouts/me/ledger').set(auth(advToken)).expect(200)).body.data.rows.find((x: { entitlementId: string }) => x.entitlementId === dup.ents[0].id).position).toBe('Payment recorded / proof pending');
    // proof uploaded by someone other than Accounts/Admin, or reused from another request, is refused
    const reused = (await prisma.externalPayment.findFirstOrThrow({ where: { state: 'VERIFIED' } })).proofFileId as string;
    await post(`/payouts/requests/${dup.id}/payment/proof`, accountsToken, { proofFileId: reused }).expect(400);
    const proof = await uploadProof();
    expect((await post(`/payouts/requests/${dup.id}/payment/proof`, accountsToken, { proofFileId: proof }).expect(201)).body.data).toMatchObject({ state: 'PAID', payment: { state: 'VERIFIED' } });
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: dup.ents[0].id } })).state).toBe('PAID');

    // wrong amount → EXCEPTION + ON_HOLD, Admin notified, entitlements stay reserved
    const wrong = await approvedRequest();
    const w = (await post(`/payouts/requests/${wrong.id}/payment`, accountsToken, { paidAt: past(), amountInr: 1000, transferReference: 'UTR-0003', proofFileId: await uploadProof() }).expect(201)).body.data;
    expect(w).toMatchObject({ state: 'ON_HOLD', payment: { state: 'EXCEPTION' }, hold: { reason: expect.stringContaining('Amount mismatch') } });
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: wrong.ents[0].id } })).state).toBe('RESERVED');
    expect(await prisma.notification.count({ where: { kind: 'PAYOUT_EXCEPTION', title: 'Payout payment exception' } })).toBe(1);
    // Admin cannot "accept" a mismatched amount, nor cancel with a payment on file
    await post(`/payouts/requests/${wrong.id}/payment/resolve`, adminToken, { reason: 'looks fine to me' }).expect(409);
    await post(`/payouts/requests/${wrong.id}/cancel`, adminToken, { reason: 'try cancel' }).expect(409);
    // audited correction: Accounts proposes (same reference allowed within the chain), Admin approves → PAID
    const c = (await post(`/payouts/requests/${wrong.id}/payment/correct`, accountsToken, { paidAt: past(30), amountInr: 1500, transferReference: 'UTR-0003', reason: 'typed 1000 instead of 1500' }).expect(201)).body.data;
    expect(c).toMatchObject({ state: 'ON_HOLD', pendingCorrection: { state: 'CORRECTION_PENDING', amountInr: 1500 }, payments: { canCorrect: false } });
    await post(`/payouts/requests/${wrong.id}/payment/correct`, accountsToken, { paidAt: past(30), amountInr: 1500, transferReference: 'UTR-0003', reason: 'second try' }).expect(409);
    await post(`/payouts/requests/${wrong.id}/payment/correction-decision`, accountsToken, { decision: 'APPROVED', reason: 'self' }).expect(403);
    const done = (await post(`/payouts/requests/${wrong.id}/payment/correction-decision`, adminToken, { decision: 'APPROVED', reason: 'bank statement confirms 1500' }).expect(201)).body.data;
    expect(done).toMatchObject({ state: 'PAID', payment: { state: 'VERIFIED', amountInr: 1500, correctionReason: 'typed 1000 instead of 1500' }, hold: null, pendingCorrection: null });
    expect(done.paymentHistory.map((p: { state: string }) => p.state)).toEqual(['SUPERSEDED', 'VERIFIED']); // prior entry retained
    expect((await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: wrong.ents[0].id } })).state).toBe('PAID');

    // discrepancy flag before payment → ON_HOLD; Admin releases → back to awaiting
    const flagged = await approvedRequest();
    expect((await post(`/payouts/requests/${flagged.id}/payment/flag`, accountsToken, { reason: 'payee IFSC does not match cheque' }).expect(201)).body.data).toMatchObject({ state: 'ON_HOLD', hold: { reason: 'payee IFSC does not match cheque' } });
    await post(`/payouts/requests/${flagged.id}/payment`, accountsToken, { paidAt: past(), amountInr: 1500, transferReference: 'UTR-0004' }).expect(409);
    expect((await post(`/payouts/requests/${flagged.id}/payment/resolve`, adminToken, { reason: 'Advisor re-verified bank details' }).expect(201)).body.data.state).toBe('APPROVED');
    // post-payment exception (e.g. bank reversal) is surfaced, not auto-clawed back
    const paidReq = await prisma.payoutRequest.findFirstOrThrow({ where: { state: 'PAID' }, orderBy: { submittedAt: 'asc' } });
    const ex = (await post(`/payouts/requests/${paidReq.id}/payment/flag`, accountsToken, { reason: 'bank reported a reversal' }).expect(201)).body.data;
    expect(ex).toMatchObject({ state: 'PAID', payment: { state: 'EXCEPTION', exceptionReason: 'bank reported a reversal' } });
    expect((await api().get('/api/v1/payouts/payments/queues').set(auth(accountsToken)).expect(200)).body.data).toMatchObject({ awaiting: { count: 1, amountInr: 1500 }, exceptions: { count: 1 } });
    expect((await post(`/payouts/requests/${paidReq.id}/payment/resolve`, adminToken, { reason: 'reversal was re-credited' }).expect(201)).body.data.payment).toMatchObject({ state: 'VERIFIED', resolutionNote: 'reversal was re-credited' });
    // a paid request can only be corrected to the approved amount
    await post(`/payouts/requests/${paidReq.id}/payment/correct`, accountsToken, { paidAt: past(), amountInr: 10, transferReference: 'UTR-0005', reason: 'partial refund' }).expect(400);
  });

  it('no endpoint or UI moves money (no in-app disbursement)', () => {
    const roots = [join(__dirname, '../src'), join(__dirname, '../../web/src'), join(__dirname, '../../mobile/app'), join(__dirname, '../../mobile/components')];
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(tsx?|jsx?)$/.test(n)) out.push(p);
      }
      return out;
    };
    const offenders = roots.flatMap((r) => walk(r)).filter((f) => /disburs|payout[-_ ]?gateway|razorpay|cashfree|initiateTransfer|transferFunds|sendMoney/i.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
