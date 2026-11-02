import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';
import { hdfcWorkbook, type MisRowInput, XLSX_TYPE } from './mis-fixture';

describe('F-602 entitlement evaluation, rate-free (PAY-01, PAY-06, INV-05/06)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let advToken: string;
  let advId: string;
  let hdfcId: string;
  let profileId: string;
  let leadA: string;
  let leadB: string;
  const api = () => request(app.getHttpServer());

  async function applyBatch(rows: MisRowInput[], name: string) {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', await hdfcWorkbook(rows), { filename: name, contentType: XLSX_TYPE }).expect(201);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId: up.body.data.id }).expect(201);
    const id = b.body.data.id as string;
    if (b.body.data.stage === 'MAPPED') {
      await api().post(`/api/v1/mis/batches/${id}/preview`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
      await api().post(`/api/v1/mis/batches/${id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    }
    return id;
  }
  const ents = (token = advToken) => api().get('/api/v1/payouts/entitlements').set(auth(token)).expect(200);

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    profileId = (await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } })).id;
    await api().post(`/api/v1/mis/profiles/${profileId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test' }).expect(201);
    const adv = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999401', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Payout' } });
    advId = adv.id;
    advToken = (await loginAs(app, prisma, '9555999401')).accessToken;
    const card = await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const mk = async (name: string, mobile: string, appNo: string) => {
      const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advId, reportingParentUserIdSnapshot: advId, bankId: hdfcId, cardId: card.id, customerFullName: name, customerMobile: mobile, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
      await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: advId } });
      return l.id;
    };
    leadA = await mk('Pay A', '+919555700501', 'APP-501');
    leadB = await mk('Pay B', '+919555700502', 'APP-502');
    // a CallingInterest-style event must never create an entitlement (INV-05) — there is simply no code path; assert the table stays empty below
  });
  afterAll(async () => app.close());

  it('PAY-01 (rate-free): the bank reporting the card activated makes the lead claimable once — no rule, no amount; blank/inactive do not', async () => {
    await applyBatch(
      [
        { 'Application No': 'APP-501', CURRENT_STAGE: 'Decisioned Cases and Card setup completed', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'V + ACTIVE', CUSTOMER_NAME: 'Pay A' },
        { 'Application No': 'APP-502', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': '', CUSTOMER_NAME: 'Pay B' },
      ],
      'b1.xlsx',
    );
    const list = await ents();
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ state: 'ELIGIBLE_AVAILABLE', amountInr: 0, rule: null, triggerField: 'cardActivationStatus', triggerFieldValue: 'V + ACTIVE', lead: { id: leadA } });
    expect(list.body.meta.counts).toMatchObject({ available: 1, eligible: 1, availableToClaim: 1 });
    expect(await prisma.notification.count({ where: { recipientUserId: advId, kind: 'PAYOUT_ELIGIBLE' } })).toBe(1);
    // the same activation again → still one; an INACTIVE card never becomes claimable
    await applyBatch([{ 'Application No': 'APP-501', CURRENT_STAGE: 'Decisioned Cases and Card setup completed', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'V + ACTIVE', CUSTOMER_NAME: 'Pay A', 'Creation Date': '01-09-2026' }, { 'Application No': 'APP-502', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE', CUSTOMER_NAME: 'Pay B' }], 'b2.xlsx');
    expect(await prisma.payoutEntitlement.count()).toBe(1);
    // INV-06: activation levels are one card event — B activates, then moves between active levels → one entitlement
    for (const [i, value] of ['TXN ACTIVE - Rs 100', 'V + ACTIVE'].entries()) {
      await applyBatch([{ 'Application No': 'APP-502', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': value, CUSTOMER_NAME: 'Pay B' }], `lv${i}.xlsx`);
      const rows = await prisma.payoutEntitlement.findMany({ where: { leadId: leadB } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ state: 'ELIGIBLE_AVAILABLE', ruleId: null });
    }
  });

  it('scope + trace: events recorded; another advisor sees nothing', async () => {
    const e = await prisma.payoutEntitlement.findFirstOrThrow({ where: { leadId: leadA } });
    const events = await api().get(`/api/v1/payouts/entitlements/${e.id}/events`).set(auth(advToken)).expect(200);
    expect(events.body.data.map((x: { toState: string }) => x.toState)).toEqual(['ELIGIBLE_AVAILABLE']);
    await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999402', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Other' } });
    const otherToken = (await loginAs(app, prisma, '9555999402')).accessToken;
    expect((await ents(otherToken)).body.data).toEqual([]);
    await api().get(`/api/v1/payouts/entitlements/${e.id}/events`).set(auth(otherToken)).expect(404);
  });

  it('correction: activation reported INACTIVE → UNDER_REVIEW (nothing deleted); restored → available again; PAID stays PAID with an exception (PAY-06)', async () => {
    const e = await prisma.payoutEntitlement.findFirstOrThrow({ where: { leadId: leadA } });
    await applyBatch([{ 'Application No': 'APP-501', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE', CUSTOMER_NAME: 'Pay A' }], 'b3.xlsx');
    let cur = await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.state).toBe('UNDER_REVIEW');
    expect(cur.reviewReason).toContain('INACTIVE');
    expect(await prisma.payoutEntitlement.count()).toBe(2); // A (under review) + B
    await applyBatch([{ 'Application No': 'APP-501', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'V + ACTIVE', CUSTOMER_NAME: 'Pay A' }], 'b4.xlsx');
    cur = await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.state).toBe('ELIGIBLE_AVAILABLE');
    expect(cur.reviewReason).toBeNull();
    // simulate paid (F-605 will do this through the request flow)
    await prisma.payoutEntitlement.update({ where: { id: e.id }, data: { state: 'PAID' } });
    await applyBatch([{ 'Application No': 'APP-501', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE', CUSTOMER_NAME: 'Pay A', 'Creation Date': '02-09-2026' }], 'b5.xlsx');
    cur = await prisma.payoutEntitlement.findUniqueOrThrow({ where: { id: e.id } });
    expect(cur.state).toBe('PAID');
    expect(await prisma.outboxEvent.count({ where: { type: 'payouts.exception' } })).toBe(1);
    // identical re-import of the same correction raises no second exception (MIS-08)
    await applyBatch([{ 'Application No': 'APP-501', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE', CUSTOMER_NAME: 'Pay A', 'Creation Date': '03-09-2026' }], 'b6.xlsx');
    expect(await prisma.outboxEvent.count({ where: { type: 'payouts.exception' } })).toBe(1);
    expect((await ents()).body.meta.counts).toMatchObject({ paid: 1, eligible: 2, availableToClaim: 1 }); // B is still claimable
  });
});
