import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';
import { hdfcWorkbook, type MisRowInput, XLSX_TYPE } from './mis-fixture';

/**
 * F-824, owner decision "pay through KBS": when the bank activates a card on a lead of an Advisor who joined with
 * another Advisor's code, that other Advisor gets a payable item of their own on the same card.
 * Line used here: Manager → Up → Down → Deep.
 */
describe('F-824 referral share paid through KBS', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let managerToken: string;
  let managerId: string;
  let hdfcId: string;
  let profileId: string;
  const who: Record<'up' | 'down' | 'deep', { id: string; token: string }> = { up: { id: '', token: '' }, down: { id: '', token: '' }, deep: { id: '', token: '' } };
  const lead: Record<'down' | 'deep' | 'up', string> = { down: '', deep: '', up: '' };
  const api = () => request(app.getHttpServer());
  const post = (path: string, token: string, body: object) => api().post(`/api/v1${path}`).set(auth(token)).set('idempotency-key', idem()).send(body);
  const ents = async (token: string) => (await api().get('/api/v1/payouts/entitlements').set(auth(token)).expect(200)).body.data as Array<{ id: string; kind: string; state: string; lead: { id: string }; sourceAdvisor: { id: string; fullName: string } | null }>;

  async function applyBatch(rows: MisRowInput[], name: string) {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', await hdfcWorkbook(rows), { filename: name, contentType: XLSX_TYPE }).expect(201);
    const b = await post('/mis/batches', adminToken, { bankId: hdfcId, profileId, fileId: up.body.data.id }).expect(201);
    const id = b.body.data.id as string;
    if (b.body.data.stage === 'MAPPED') {
      await post(`/mis/batches/${id}/preview`, adminToken, {}).expect(201);
      await post(`/mis/batches/${id}/apply`, adminToken, {}).expect(201);
    }
    return id;
  }
  const row = (appNo: string, name: string, activation: string): MisRowInput => ({ 'Application No': appNo, CURRENT_STAGE: 'Decisioned Cases and Card setup completed', FINAL_DECISION: 'Approve', 'Card Activation Staus': activation, CUSTOMER_NAME: name });

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    profileId = (await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } })).id;
    await post(`/mis/profiles/${profileId}/approve`, adminToken, { reason: 'test' }).expect(201);
    const mgr = await setupManagerAndTelecaller(app, prisma, '82401');
    managerToken = mgr.manager.accessToken;
    managerId = mgr.managerId;
    const card = await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const parents = { up: () => managerId, down: () => who.up.id, deep: () => who.down.id };
    for (const [i, key] of (['up', 'down', 'deep'] as const).entries()) {
      const mobile = `955582400${i + 1}`;
      const u = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: `+91${mobile}`, role: 'ADVISOR', status: 'ACTIVE', fullName: `${key[0].toUpperCase()}${key.slice(1)} Advisor` } });
      await prisma.reportingAssignment.create({ data: { childUserId: u.id, parentUserId: parents[key](), source: 'AGENT_CODE', status: 'ACTIVE' } });
      who[key] = { id: u.id, token: (await loginAs(app, prisma, mobile)).accessToken };
    }
    const mk = async (key: 'up' | 'down' | 'deep', appNo: string) => {
      const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: who[key].id, reportingParentUserIdSnapshot: parents[key](), bankId: hdfcId, cardId: card.id, customerFullName: `Cust ${key}`, customerMobile: `+91955570060${appNo.slice(-1)}`, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
      await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: who[key].id } });
      lead[key] = l.id;
    };
    await mk('up', 'APP-601');
    await mk('down', 'APP-602');
    await mk('deep', 'APP-603');
  });
  afterAll(async () => app.close());

  it('an activated card pays its own Advisor and, one level up, the Advisor they joined under — never a Manager, never two levels', async () => {
    await applyBatch([row('APP-601', 'Cust up', 'V + ACTIVE'), row('APP-602', 'Cust down', 'V + ACTIVE'), row('APP-603', 'Cust deep', 'V + ACTIVE')], 'r1.xlsx');
    const all = await prisma.payoutEntitlement.findMany({ select: { leadId: true, advisorUserId: true, kind: true, state: true, reportingParentSnapshot: true } });
    const of = (leadId: string) => all.filter((e) => e.leadId === leadId).map((e) => `${e.kind}:${e.advisorUserId}`).sort();
    expect(of(lead.up)).toEqual([`OWN:${who.up.id}`]); // Up reports to a Manager: the Manager's share stays outside KBS
    expect(of(lead.down)).toEqual([`OWN:${who.down.id}`, `REFERRAL:${who.up.id}`].sort());
    expect(of(lead.deep)).toEqual([`OWN:${who.deep.id}`, `REFERRAL:${who.down.id}`].sort()); // nothing for Up, two levels above
    expect(all.every((e) => e.state === 'ELIGIBLE_AVAILABLE')).toBe(true);
    // the share's approver line is the payee's own line
    expect(all.find((e) => e.kind === 'REFERRAL' && e.advisorUserId === who.up.id)?.reportingParentSnapshot).toBe(managerId);

    const mine = await ents(who.up.token);
    expect(mine.map((e) => e.kind).sort()).toEqual(['OWN', 'REFERRAL']);
    expect(mine.find((e) => e.kind === 'REFERRAL')).toMatchObject({ lead: { id: lead.down }, sourceAdvisor: { id: who.down.id, fullName: 'Down Advisor' } });
    expect(mine.find((e) => e.kind === 'OWN')?.sourceAdvisor).toBeNull();
    expect(await prisma.notification.count({ where: { recipientUserId: who.up.id, kind: 'PAYOUT_ELIGIBLE' } })).toBe(2);
    // the same activation again creates nothing new
    await applyBatch([row('APP-602', 'Cust down', 'V + ACTIVE'), row('APP-603', 'Cust deep', 'TXN ACTIVE - Rs 100')], 'r2.xlsx');
    expect(await prisma.payoutEntitlement.count()).toBe(5);
  });

  it('each person sees only their own payable item on the lead; the Admin sees both with the payee named', async () => {
    const forUp = (await api().get(`/api/v1/leads/${lead.down}`).set(auth(who.up.token)).expect(200)).body.data.payouts as Array<{ kind: string; payee: { id: string } }>;
    expect(forUp).toMatchObject([{ kind: 'REFERRAL', payee: { id: who.up.id } }]);
    const forDown = (await api().get(`/api/v1/leads/${lead.down}`).set(auth(who.down.token)).expect(200)).body.data.payouts as Array<{ kind: string }>;
    expect(forDown).toMatchObject([{ kind: 'OWN' }]);
    const forAdmin = (await api().get(`/api/v1/leads/${lead.down}`).set(auth(adminToken)).expect(200)).body.data.payouts as Array<{ kind: string; payee: { fullName: string } }>;
    expect(forAdmin.map((p) => `${p.kind}:${p.payee.fullName}`).sort()).toEqual(['OWN:Down Advisor', 'REFERRAL:Up Advisor']);
    await api().get(`/api/v1/leads/${lead.deep}`).set(auth(who.up.token)).expect(404); // two levels down stays closed
  });

  it('the share is requested, approved by the payee\'s Manager and priced by the Admin on its own; a bank reversal reviews both items', async () => {
    const share = (await ents(who.up.token)).find((e) => e.kind === 'REFERRAL');
    const r = (await post('/payouts/requests', who.up.token, { entitlementIds: [share?.id] }).expect(201)).body.data;
    expect(r.items).toMatchObject([{ kind: 'REFERRAL', sourceAdvisor: { id: who.down.id }, lead: { id: lead.down } }]);
    await api().get(`/api/v1/payouts/requests/${r.id}`).set(auth(who.down.token)).expect(404); // not the lead owner's request
    await post(`/payouts/requests/${r.id}/approvals`, managerToken, { decision: 'APPROVED' }).expect(201);

    // the bank takes the activation back before the Admin approves: both items go under review, the request cannot be approved
    await applyBatch([row('APP-602', 'Cust down', 'INACTIVE')], 'r3.xlsx');
    expect((await prisma.payoutEntitlement.findMany({ where: { leadId: lead.down } })).map((e) => e.state).sort()).toEqual(['UNDER_REVIEW', 'UNDER_REVIEW']);
    await post(`/payouts/requests/${r.id}/approvals`, adminToken, { decision: 'APPROVED', amountInr: 300 }).expect(409);
    // active again: the own item is claimable, the share is back in its request
    await applyBatch([row('APP-602', 'Cust down', 'V + ACTIVE')], 'r4.xlsx');
    const back = await prisma.payoutEntitlement.findMany({ where: { leadId: lead.down }, select: { kind: true, state: true } });
    expect(back.map((e) => `${e.kind}:${e.state}`).sort()).toEqual(['OWN:ELIGIBLE_AVAILABLE', 'REFERRAL:RESERVED']);
    const ok = (await post(`/payouts/requests/${r.id}/approvals`, adminToken, { decision: 'APPROVED', amountInr: 300 }).expect(201)).body.data;
    expect(ok).toMatchObject({ state: 'APPROVED', totalAmountInr: 300 });
    // Down requests the card's own payout: neither request lists the other as an earlier request for the same lead
    const own = (await post('/payouts/requests', who.down.token, { entitlementIds: (await ents(who.down.token)).filter((e) => e.lead.id === lead.down).map((e) => e.id) }).expect(201)).body.data;
    for (const id of [r.id, own.id]) expect((await api().get(`/api/v1/payouts/requests/${id}`).set(auth(adminToken)).expect(200)).body.data.items[0].priorRequests).toEqual([]);
    await post(`/payouts/requests/${own.id}/cancel`, who.down.token, { reason: 'test cleanup' }).expect(201);
    // Down's own item is untouched by Up's request
    expect((await ents(who.down.token)).filter((e) => e.lead.id === lead.down)).toMatchObject([{ kind: 'OWN', state: 'ELIGIBLE_AVAILABLE' }]);
  });

  it('the share follows who the Advisor reported to when the lead was created: moving them later changes neither the payee nor the payee\'s access', async () => {
    await post(`/users/${who.down.id}/reporting`, adminToken, { parentUserId: managerId, reason: 'moved under the Manager' }).expect(201);
    const fresh = (await loginAs(app, prisma, '9555824001')).accessToken; // Up, with no team now
    expect((await api().get('/api/v1/me/team').set(auth(fresh)).expect(200)).body.data.advisors).toEqual([]);
    await api().get(`/api/v1/leads/${lead.down}`).set(auth(fresh)).expect(200); // still readable: Up is paid on it
    await api().get(`/api/v1/leads/${lead.down}/mis-history`).set(auth(fresh)).expect(200);
    await post(`/leads/${lead.down}/remarks`, fresh, { text: 'not mine' }).expect(403);
    expect((await ents(fresh)).filter((e) => e.kind === 'REFERRAL')).toHaveLength(1);
  });
});
