import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';
import { hdfcWorkbook, XLSX_TYPE } from './mis-fixture';

describe('F-409 Pending Actions, follow-up tasks, lead remarks (VIEW-03)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let advToken: string;
  let advId: string;
  let hdfcId: string;
  let leadId: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    const profile = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    await api().post(`/api/v1/mis/profiles/${profile.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test' }).expect(201);
    const adv = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999301', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Pending' } });
    advId = adv.id;
    advToken = (await loginAs(app, prisma, '9555999301')).accessToken;
    const card = await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advId, reportingParentUserIdSnapshot: advId, bankId: hdfcId, cardId: card.id, customerFullName: 'Pending Customer', customerMobile: '+919555700401', pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    leadId = l.id;
    await prisma.bankApplicationLinkage.create({ data: { leadId, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: 'APP-401', source: 'ADVISOR_ENTERED', enteredByUserId: advId } });
    // Apply a batch: generic Inprocess, blank reasons, a curable flag text
    const up = await api()
      .post('/api/v1/files/mis')
      .set(auth(adminToken))
      .attach('file', await hdfcWorkbook([{ 'Application No': 'APP-401', CURRENT_STAGE: 'Document Curing', FINAL_DECISION: 'Inprocess', CURABLE_FLAG: 'Y - Address proof pending', CUSTOMER_NAME: 'Pending Customer' }]), { filename: 'b.xlsx', contentType: XLSX_TYPE })
      .expect(201);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId: profile.id, fileId: up.body.data.id }).expect(201);
    await api().post(`/api/v1/mis/batches/${b.body.data.id}/preview`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    await api().post(`/api/v1/mis/batches/${b.body.data.id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
  });
  afterAll(async () => app.close());

  it('VIEW-03: Inprocess + blank reasons + no rules → zero pending actions; explicit follow-up → one item with owner', async () => {
    const none = await api().get('/api/v1/pending-actions').set(auth(advToken)).expect(200);
    expect(none.body.data).toEqual([]);
    const due = new Date(Date.now() + 3600_000).toISOString();
    const t = await api().post(`/api/v1/leads/${leadId}/follow-ups`).set(auth(advToken)).set('idempotency-key', idem()).send({ text: 'Call customer about address proof', dueAt: due }).expect(201);
    const one = await api().get('/api/v1/pending-actions').set(auth(advToken)).expect(200);
    expect(one.body.data).toHaveLength(1);
    expect(one.body.data[0]).toMatchObject({ leadId, customer: 'Pending Customer', issuer: 'HDFC Bank', owner: { userId: advId, name: 'Adv Pending', role: 'ADVISOR' }, whatToDo: 'Call customer about address proof', source: { type: 'KBS_TASK' }, date: due, cta: 'OPEN_LEAD', doneAt: null });
    // past due date rejected; assigning to a stranger rejected
    await api().post(`/api/v1/leads/${leadId}/follow-ups`).set(auth(advToken)).set('idempotency-key', idem()).send({ text: 'too late', dueAt: new Date(Date.now() - 86_400_000).toISOString() }).expect(400);
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    await api().post(`/api/v1/leads/${leadId}/follow-ups`).set(auth(advToken)).set('idempotency-key', idem()).send({ text: 'not mine to give', dueAt: due, ownerUserId: admin.id }).expect(403);
    // done → disappears unless includeDone
    await api().post(`/api/v1/follow-ups/${t.body.data.id}/done`).set(auth(advToken)).set('idempotency-key', idem()).expect(201);
    expect((await api().get('/api/v1/pending-actions').set(auth(advToken)).expect(200)).body.data).toEqual([]);
    expect((await api().get('/api/v1/pending-actions?includeDone=true').set(auth(advToken)).expect(200)).body.data[0].doneAt).toBeTruthy();
    expect(await prisma.auditLog.count({ where: { action: { in: ['followUp.create', 'followUp.done'] } } })).toBe(2);
    // it shows in the lead's operational events, separate from MIS
    const d = await api().get(`/api/v1/leads/${leadId}`).set(auth(advToken)).expect(200);
    expect(d.body.data.operationalEvents.find((e: { kind: string }) => e.kind === 'FOLLOW_UP_TASK')).toMatchObject({ provenance: 'KBS_OPERATIONAL', detail: expect.stringContaining('done') });
    expect(d.body.data.followUps).toHaveLength(1);
  });

  it('MIS-derived items exist only through configured rules; no owner → verbatim bank text without CTA; Admin assigns via rule with owner', async () => {
    const rules = [
      { bankCode: 'HDFC', field: 'curableFlag', pattern: '^Y', label: 'Collect the pending document from the customer', owner: 'ADVISOR', cta: 'CONTACT_CUSTOMER' },
      { bankCode: 'HDFC', field: 'finalDecision', pattern: '^Inprocess$', label: 'ignored: generic inprocess' },
      { bankCode: 'HDFC', field: 'dropoffReason', pattern: '.*', label: 'never matches a blank' },
      { bogus: true },
    ];
    // the second rule has no owner → informational "Bank reported: Inprocess" (explicitly configured by Admin, not inferred)
    await api().put('/api/v1/config/mis.actionableRules').set(auth(adminToken)).send({ value: rules, reason: 'enable curable follow-ups' }).expect(200);
    const r = await api().get('/api/v1/pending-actions').set(auth(advToken)).expect(200);
    const items = r.body.data as Array<{ id: string; whatToDo: string; cta: string | null; owner: { role: string }; source: { type: string; field?: string; bankText?: string } }>;
    expect(items.map((i) => i.source.field).sort()).toEqual(['curableFlag', 'finalDecision']); // blank dropoffReason never matches
    const curable = items.find((i) => i.source.field === 'curableFlag');
    expect(curable).toMatchObject({ whatToDo: 'Collect the pending document from the customer', cta: 'CONTACT_CUSTOMER', owner: { role: 'ADVISOR', userId: advId }, source: { type: 'MIS_FIELD', bankText: 'Y - Address proof pending' } });
    const info = items.find((i) => i.source.field === 'finalDecision');
    expect(info).toMatchObject({ whatToDo: 'Bank reported: Inprocess', cta: null, owner: { role: 'BANK', userId: null } });
    expect(items.every((i) => i.source.type === 'MIS_FIELD' && 'batchRef' in i.source)).toBe(true);
    // rules off again → nothing
    await api().put('/api/v1/config/mis.actionableRules').set(auth(adminToken)).send({ value: [], reason: 'off' }).expect(200);
    expect((await api().get('/api/v1/pending-actions').set(auth(advToken)).expect(200)).body.data).toEqual([]);
  });

  it('lead operational remarks are separate from bank remarks and appear as KBS activity', async () => {
    await api().post(`/api/v1/leads/${leadId}/remarks`).set(auth(advToken)).set('idempotency-key', idem()).send({ text: 'Customer will send address proof on Monday' }).expect(201);
    const list = await api().get(`/api/v1/leads/${leadId}/remarks`).set(auth(advToken)).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].author.fullName).toBe('Adv Pending');
    const d = await api().get(`/api/v1/leads/${leadId}`).set(auth(advToken)).expect(200);
    expect(d.body.data.operationalEvents.find((e: { kind: string }) => e.kind === 'OPERATIONAL_REMARK')).toMatchObject({ detail: 'Customer will send address proof on Monday', provenance: 'KBS_OPERATIONAL' });
    // bank remarks untouched
    expect(d.body.data.bankRemarks.remarks.every((f: { raw: string | null }) => f.raw === null)).toBe(true);
    expect(d.body.data.bankRemarks.kyc.find((f: { field: string }) => f.field === 'curableFlag').display).toBe('Y - Address proof pending');
  });
});
