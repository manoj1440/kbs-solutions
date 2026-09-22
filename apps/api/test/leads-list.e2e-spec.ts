import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';
import { hdfcWorkbook, XLSX_TYPE } from './mis-fixture';

describe('F-408 My Leads search / filters / detail sections / MIS history (FOS-06, VIEW-01, MIS-02/05/06)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let adv1Token: string;
  let adv2Token: string;
  let hdfcId: string;
  const api = () => request(app.getHttpServer());
  const ids: Record<string, string> = {};

  async function mkLead(advisorUserId: string, key: string, name: string, mobile: string, appNo: string | null, createdAt: Date) {
    const card = await prisma.creditCard.findFirstOrThrow({ where: { bankId: hdfcId } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId, reportingParentUserIdSnapshot: advisorUserId, bankId: hdfcId, cardId: card.id, customerFullName: name, customerMobile: mobile, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem(), createdAt } });
    if (appNo) await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: advisorUserId } });
    ids[key] = l.id;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    const profile = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    await api().post(`/api/v1/mis/profiles/${profile.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'test' }).expect(201);
    const a1 = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999101', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv One' } });
    const a2 = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999102', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Two' } });
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Test', status: 'PUBLISHED' } });
    await mkLead(a1.id, 'old', 'Ramesh Kumar', '+919555700101', 'APP-101', new Date('2026-08-01T05:00:00Z'));
    await mkLead(a1.id, 'new', 'Sita Devi', '+919555700102', 'APP-102', new Date('2026-09-10T05:00:00Z'));
    await mkLead(a1.id, 'noref', 'Amit Shah', '+919555700103', null, new Date('2026-09-15T05:00:00Z'));
    await mkLead(a2.id, 'other', 'Ramesh Other', '+919555700104', 'APP-104', new Date('2026-09-12T05:00:00Z'));
    adv1Token = (await loginAs(app, prisma, '9555999101')).accessToken;
    adv2Token = (await loginAs(app, prisma, '9555999102')).accessToken;
    // one applied batch: old → Approve + INACTIVE with a decline-type remark; new → Decisioned, activation blank
    const up = await api()
      .post('/api/v1/files/mis')
      .set(auth(adminToken))
      .attach(
        'file',
        await hdfcWorkbook([
          { 'Application No': 'APP-101', CURRENT_STAGE: 'Decisioned Cases and Card setup completed', FINAL_DECISION: 'Approve', 'Card Activation Staus': 'INACTIVE', 'Decline Type': 'Policy', CUSTOMER_NAME: 'Ramesh Kumar', 'Creation Date': '01-08-2026', 'KYC Status': 'Completed' },
          { 'Application No': 'APP-102', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approve', 'Card Activation Staus': '#N/A', CUSTOMER_NAME: 'Sita Devi' },
        ]),
        { filename: 'b1.xlsx', contentType: XLSX_TYPE },
      )
      .expect(201);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId: profile.id, fileId: up.body.data.id }).expect(201);
    await api().post(`/api/v1/mis/batches/${b.body.data.id}/preview`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    await api().post(`/api/v1/mis/batches/${b.body.data.id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
  });
  afterAll(async () => app.close());

  it('FOS-06/VIEW-01: rows carry three distinct badges + last matched time; scope is own leads only', async () => {
    const r = await api().get('/api/v1/leads').set(auth(adv1Token)).expect(200);
    expect(r.body.meta.total).toBe(3);
    const old = r.body.data.find((x: { id: string }) => x.id === ids.old);
    expect(old.stage.display).toBe('Decisioned Cases and Card setup completed');
    expect(old.decision.display).toBe('Approve');
    expect(old.activation.display).toBe('INACTIVE'); // Approve + INACTIVE coexist (REQ-14 §14.4)
    expect(old.lastMatchedAt).toBeTruthy();
    expect(old.remarksPreview).toBe('Decline Type: Policy');
    expect(old.bankApplicationNo).toBe('APP-101');
    expect(old.bankCreationDate).toMatchObject({ source: 'Creation Date' });
    const noref = r.body.data.find((x: { id: string }) => x.id === ids.noref);
    expect([noref.stage.display, noref.decision.display, noref.activation.display]).toEqual(['Awaiting MIS Update', 'Awaiting MIS Update', 'Awaiting MIS Update']);
    expect(noref.lastMatchedAt).toBeNull();
    expect(JSON.stringify(r.body)).not.toContain('Ramesh Other');
    // other advisor cannot open it
    await api().get(`/api/v1/leads/${ids.old}`).set(auth(adv2Token)).expect(404);
    await api().get(`/api/v1/leads/${ids.old}/mis-history`).set(auth(adv2Token)).expect(404);
  });

  it('search by name, mobile (any format) and reference; never by status text', async () => {
    const t = auth(adv1Token);
    const byName = await api().get('/api/v1/leads?q=sita').set(t).expect(200);
    expect(byName.body.data.map((x: { id: string }) => x.id)).toEqual([ids.new]);
    const byMobile = await api().get('/api/v1/leads?q=09555700101').set(t).expect(200);
    expect(byMobile.body.data.map((x: { id: string }) => x.id)).toEqual([ids.old]);
    const byRef = await api().get('/api/v1/leads?q=APP-102').set(t).expect(200);
    expect(byRef.body.data.map((x: { id: string }) => x.id)).toEqual([ids.new]);
    const kbs = (await api().get(`/api/v1/leads/${ids.noref}`).set(t).expect(200)).body.data.kbsRef as string;
    const byKbs = await api().get(`/api/v1/leads?q=${kbs.slice(-6)}`).set(t).expect(200);
    expect(byKbs.body.data.map((x: { id: string }) => x.id)).toEqual([ids.noref]);
    const byStatus = await api().get('/api/v1/leads?q=Approve').set(t).expect(200);
    expect(byStatus.body.meta.total).toBe(0);
  });

  it('filters: decision, activation sentinels, MIS freshness, actionable, date range, sort; filter options are verbatim values', async () => {
    const t = auth(adv1Token);
    const ids_ = (r: request.Response) => r.body.data.map((x: { id: string }) => x.id);
    expect(ids_(await api().get('/api/v1/leads?decision=approve').set(t).expect(200)).sort()).toEqual([ids.old, ids.new].sort());
    expect(ids_(await api().get('/api/v1/leads?activation=INACTIVE').set(t).expect(200))).toEqual([ids.old]);
    expect(ids_(await api().get('/api/v1/leads?activation=__not_reported__').set(t).expect(200))).toEqual([ids.new]);
    expect(ids_(await api().get('/api/v1/leads?activation=__awaiting__').set(t).expect(200))).toEqual([ids.noref]);
    expect(ids_(await api().get('/api/v1/leads?misFreshness=never').set(t).expect(200))).toEqual([ids.noref]);
    expect(ids_(await api().get('/api/v1/leads?misFreshness=recent').set(t).expect(200)).sort()).toEqual([ids.old, ids.new].sort());
    expect(ids_(await api().get('/api/v1/leads?misFreshness=older30d').set(t).expect(200))).toEqual([]);
    expect(ids_(await api().get('/api/v1/leads?actionable=true').set(t).expect(200))).toEqual([ids.noref]);
    expect(ids_(await api().get('/api/v1/leads?from=2026-09-01&to=2026-09-10').set(t).expect(200))).toEqual([ids.new]);
    expect(ids_(await api().get('/api/v1/leads?sort=createdAt_asc').set(t).expect(200))).toEqual([ids.old, ids.new, ids.noref]);
    expect(ids_(await api().get('/api/v1/leads?sort=customer_asc').set(t).expect(200))).toEqual([ids.noref, ids.old, ids.new]);
    expect(ids_(await api().get('/api/v1/leads?sort=lastMatchedAt_desc').set(t).expect(200)).slice(-1)).toEqual([ids.noref]);
    await api().get('/api/v1/leads?misFreshness=bogus').set(t).expect(400);
    const f = await api().get('/api/v1/leads/filters').set(t).expect(200);
    expect(f.body.data.decisions).toEqual(['Approve']);
    expect(f.body.data.activations).toEqual(['INACTIVE']); // #N/A is not a value
    expect(f.body.data.stages).toEqual(['Decisioned Cases', 'Decisioned Cases and Card setup completed']);
    expect(f.body.data.banks).toHaveLength(1);
    // manager/admin scope of filters unaffected by advisor
    const fa = await api().get('/api/v1/leads/filters').set(auth(adminToken)).expect(200);
    expect(fa.body.data.banks).toHaveLength(1);
  });

  it('detail sections: A operational events labelled KBS activity, B raw snapshot, C grouped remarks + KYC, MIS history grouped by batch (MIS-02/06)', async () => {
    const t = auth(adv1Token);
    const d = (await api().get(`/api/v1/leads/${ids.old}`).set(t).expect(200)).body.data;
    expect(d.operationalEvents.map((e: { kind: string }) => e.kind)).toEqual(['BANK_REFERENCE_ENTERED', 'LEAD_CREATED']);
    expect(d.operationalEvents.every((e: { provenance: string }) => e.provenance === 'KBS_OPERATIONAL')).toBe(true);
    expect(d.bankStatus).toMatchObject({ matched: true, stage: 'Decisioned Cases and Card setup completed', decision: 'Approve', activation: 'INACTIVE' });
    expect(d.bankStatus.raw['Card Activation Staus']).toBe('INACTIVE');
    expect(d.bankRemarks.remarks.find((f: { field: string }) => f.field === 'declineType')).toMatchObject({ label: 'Decline Type', raw: 'Policy', display: 'Policy' });
    expect(d.bankRemarks.remarks.find((f: { field: string }) => f.field === 'declineCode').display).toBe('Not reported');
    expect(d.bankRemarks.kyc.find((f: { field: string }) => f.field === 'kycStatus')).toMatchObject({ label: 'KYC Status', display: 'Completed' });
    expect(d.actions).toEqual(['OPEN_DETAILS', 'SHARE_APPLICATION_LINK']); // reference verified by MIS match → no "enter reference"
    const h = (await api().get(`/api/v1/leads/${ids.old}/mis-history`).set(t).expect(200)).body.data;
    expect(h).toHaveLength(1);
    expect(h[0].publicRef).toMatch(/^KBS-M-/);
    const act = h[0].changes.find((c: { field: string }) => c.field === 'cardActivationStatus');
    expect(act).toMatchObject({ oldValue: null, newValue: 'INACTIVE', changeKind: 'SET' });
    // never-matched lead: sections say so, no history
    const n = (await api().get(`/api/v1/leads/${ids.noref}`).set(t).expect(200)).body.data;
    expect(n.bankStatus.raw).toBeNull();
    expect(n.bankRemarks.kyc[0].display).toBe('Awaiting MIS Update');
    expect((await api().get(`/api/v1/leads/${ids.noref}/mis-history`).set(t).expect(200)).body.data).toEqual([]);
  });
});
