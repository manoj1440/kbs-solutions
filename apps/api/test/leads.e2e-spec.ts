import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const LINK = 'https://balaji-partner-h.getpopcard.co/?utm_source=SRIBALAJI&utm_medium=cardifye&utm_campaign=CADF43_KBS';

describe('F-406 lead creation / F-407 link + bank reference (FOS-03/04/05)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let advToken: string;
  let advisorId: string;
  let cardId: string;
  let bankId: string;
  const api = () => request(app.getHttpServer());

  async function onboardedAdvisor(mobile: string) {
    const req = await api().post('/api/v1/auth/otp/request').send({ mobile, purpose: 'ADVISOR_SIGNUP' }).expect(201);
    const v = await api().post('/api/v1/auth/otp/verify').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201);
    const id = v.body.data.user.id as string;
    await prisma.user.update({ where: { id }, data: { fullName: `Advisor ${mobile.slice(-4)}`, status: 'ACTIVE' } });
    await prisma.advisorProfile.update({ where: { userId: id }, data: { onboardingStep: 'COMPLETE', identityStatus: 'VERIFIED' } });
    return { token: v.body.data.accessToken as string, id };
  }

  async function fullDraft(token: string, opts: { mobile?: string; pan?: string; override?: string } = {}) {
    const t = auth(token);
    const d = await api().post('/api/v1/leads/drafts').set(t).set('idempotency-key', idem()).send({ cardId }).expect(201);
    const id = d.body.data.id as string;
    await api().patch(`/api/v1/leads/drafts/${id}/mobile`).set(t).send({ mobile: opts.mobile ?? '9811122233', ...(opts.override ? { duplicateOverrideReason: opts.override } : {}) }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/details`).set(t).send({ fullName: 'Ramesh Customer', email: 'ramesh@example.com' }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/pan`).set(t).send({ pan: opts.pan ?? 'abcpr1234k' }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/pincode`).set(t).send({ pincode: '302001', locationConfirmed: true }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/employment`).set(t).send({ employmentType: 'SALARIED' }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/income`).set(t).send({ annualIncomeItr: 850000.5 }).expect(200);
    const decl = await api().patch(`/api/v1/leads/drafts/${id}/declarations`).set(t).send({ acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: true }).expect(200);
    expect(decl.body.data.step).toBe('REVIEW');
    return id;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/leads.declarations').set(auth(adminToken)).send({ value: [{ id: 'D1', version: '1', text: 'I confirm the details are accurate.' }, { id: 'D2', version: '1', text: 'I authorise a credit bureau check.' }], reason: 'test' }).expect(200);
    await prisma.pincodeMaster.createMany({ data: [{ pincode: '302001', officeName: 'Jaipur GPO', district: 'Jaipur', state: 'Rajasthan' }], skipDuplicates: true });
    const bank = await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } });
    bankId = bank.id;
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, name: 'HDFC Regalia' }).expect(201);
    cardId = c.body.data.id;
    await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'ADVISOR', url: LINK }).expect(201);
    await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
    const a = await onboardedAdvisor('9444400001');
    advToken = a.token;
    advisorId = a.id;
  });
  afterAll(async () => app.close());

  it('FOS-05: step errors — invalid mobile, PAN mismatch/failed, missing declaration, out-of-order — create no lead', async () => {
    const t = auth(advToken);
    const d = await api().post('/api/v1/leads/drafts').set(t).set('idempotency-key', idem()).send({ cardId }).expect(201);
    const id = d.body.data.id as string;
    expect(d.body.data).toMatchObject({ step: 'MOBILE', card: { name: 'HDFC Regalia' } });
    expect(d.body.data.declarations).toHaveLength(2);
    await api().patch(`/api/v1/leads/drafts/${id}/details`).set(t).send({ fullName: 'X Y' }).expect(409); // order
    await api().patch(`/api/v1/leads/drafts/${id}/mobile`).set(t).send({ mobile: '12345' }).expect(400);
    await api().patch(`/api/v1/leads/drafts/${id}/mobile`).set(t).send({ mobile: '9811100999' }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/details`).set(t).send({ fullName: 'Ramesh Customer' }).expect(200);
    const mm = await api().patch(`/api/v1/leads/drafts/${id}/pan`).set(t).send({ pan: 'MMMMM1234K' }).expect(400);
    expect(mm.body.error.details.status).toBe('MISMATCH');
    await api().patch(`/api/v1/leads/drafts/${id}/pan`).set(t).send({ pan: 'BAD' }).expect(400);
    const un = await api().patch(`/api/v1/leads/drafts/${id}/pan`).set(t).send({ pan: 'ZZZZZ1234K' }).expect(429);
    expect(un.body.error.details.status).toBe('UNAVAILABLE');
    // still at PAN; draft survives (resume)
    expect((await api().get(`/api/v1/leads/drafts/${id}`).set(t).expect(200)).body.data.step).toBe('PAN');
    await api().patch(`/api/v1/leads/drafts/${id}/pan`).set(t).send({ pan: 'ABCPR1234K' }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/pincode`).set(t).send({ pincode: '302001', locationConfirmed: true }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/employment`).set(t).send({ employmentType: 'FREELANCER' }).expect(400);
    await api().patch(`/api/v1/leads/drafts/${id}/employment`).set(t).send({ employmentType: 'SELF_EMPLOYED_PROFESSIONAL' }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/income`).set(t).send({ annualIncomeItr: 1200000 }).expect(200);
    await api().patch(`/api/v1/leads/drafts/${id}/declarations`).set(t).send({ acceptedDeclarationIds: ['D1'], bureauAcknowledged: true }).expect(400);
    await api().patch(`/api/v1/leads/drafts/${id}/declarations`).set(t).send({ acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: false }).expect(400);
    await api().post(`/api/v1/leads/drafts/${id}/submit`).set(t).set('idempotency-key', idem()).expect(409); // not at REVIEW
    expect(await prisma.lead.count()).toBe(0);
    // no PAN plaintext anywhere in the draft row
    const row = await prisma.leadDraft.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify(row.data)).not.toContain('ABCPR1234K');
    expect((row.data as { panLast4: string }).panLast4).toBe('234K');
  });

  it('FOS-03/FOS-04: full draft → idempotent submit → lead with all fields, no bank status ("Awaiting MIS Update"); double submit = one lead', async () => {
    const t = auth(advToken);
    const id = await fullDraft(advToken);
    const view = (await api().get(`/api/v1/leads/drafts/${id}`).set(t).expect(200)).body.data;
    expect(view.data).toMatchObject({ mobileMasked: '+91••••••2233', panMasked: '••••••234K', panVerification: { status: 'VERIFIED' }, city: 'Jaipur', state: 'Rajasthan', locationConfirmed: true, employmentType: 'SALARIED', annualIncomeItr: 850000.5 });
    const key = idem();
    const s1 = await api().post(`/api/v1/leads/drafts/${id}/submit`).set(t).set('idempotency-key', key).expect(201);
    const s2 = await api().post(`/api/v1/leads/drafts/${id}/submit`).set(t).set('idempotency-key', key).expect(201);
    expect(s2.body.data.id).toBe(s1.body.data.id);
    expect(await prisma.lead.count()).toBe(1);
    const lead = s1.body.data;
    expect(lead.kbsRef).toMatch(/^KBS-L-/);
    lead.publicRef = lead.kbsRef;
    expect(lead).toMatchObject({ customer: { name: 'Ramesh Customer', mobileMasked: '+91••••••2233' }, customerPanMasked: '••••••234K', panVerificationStatus: 'VERIFIED', pincode: '302001', city: 'Jaipur', state: 'Rajasthan', employmentType: 'SALARIED', annualIncomeItr: 850000.5, stage: { display: 'Awaiting MIS Update', value: null, provenance: 'BANK_MIS', asOf: null }, decision: { display: 'Awaiting MIS Update' }, activation: { display: 'Awaiting MIS Update' }, bankCreationDate: { value: null, source: null }, remarksPreview: null, lastMatchedAt: null, matched: false, actions: ['OPEN_DETAILS', 'ENTER_BANK_REFERENCE', 'SHARE_APPLICATION_LINK'], bankStatus: { matched: false, provenance: 'NONE' } });
    expect(lead.bankReference).toMatchObject({ value: null, label: 'Bank application reference not yet available' });
    expect(lead.declarations).toMatchObject({ accepted: ['D1', 'D2'], versions: { D1: '1', D2: '1' } });
    const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.reportingParentUserIdSnapshot).toBeTruthy();
    expect(row.customerPanEncrypted).not.toContain('ABCPR1234K');
    expect(await prisma.bankStatusSnapshot.count({ where: { leadId: lead.id } })).toBe(0);
    expect(await prisma.leadDraft.count({ where: { id } })).toBe(0);
    // duplicate guard on a second draft for same mobile + card → needs override reason
    const t2 = auth(advToken);
    const d2 = await api().post('/api/v1/leads/drafts').set(t2).set('idempotency-key', idem()).send({ cardId }).expect(201);
    const dup = await api().patch(`/api/v1/leads/drafts/${d2.body.data.id}/mobile`).set(t2).send({ mobile: '9811122233' }).expect(409);
    expect(dup.body.error.code).toBe('LEAD_DUPLICATE_REFERENCE');
    const ok = await api().patch(`/api/v1/leads/drafts/${d2.body.data.id}/mobile`).set(t2).send({ mobile: '9811122233', duplicateOverrideReason: 'customer wants a second application' }).expect(200);
    expect(ok.body.data.data.duplicateWarning.leadPublicRef).toBe(lead.publicRef);
    // lists: own; Manager team; Admin all; other advisor nothing
    const mine = await api().get('/api/v1/leads').set(t).expect(200);
    expect(mine.body.meta.total).toBe(1);
    const other = await onboardedAdvisor('9444400002');
    expect((await api().get('/api/v1/leads').set(auth(other.token)).expect(200)).body.meta.total).toBe(0);
    await api().get(`/api/v1/leads/${lead.id}`).set(auth(other.token)).expect(404);
    expect((await api().get('/api/v1/leads').set(auth(adminToken)).expect(200)).body.meta.total).toBe(1);
  });

  it('F-407: link share/open recorded as KBS activity with verbatim URL + version; bank status untouched', async () => {
    const t = auth(advToken);
    const lead = (await api().get('/api/v1/leads').set(t).expect(200)).body.data[0];
    const share = await api().post(`/api/v1/leads/${lead.id}/link/share`).set(t).set('idempotency-key', idem()).expect(201);
    expect(share.body.data).toMatchObject({ action: 'SHARED', linkVersion: 1, url: LINK, label: 'Application link shared (KBS activity)' });
    const open = await api().post(`/api/v1/leads/${lead.id}/link/open`).set(t).set('idempotency-key', idem()).expect(201);
    expect(open.body.data.url).toBe(LINK);
    // sharing through F-311 with target LEAD also works and logs a ShareAction
    const wa = await api().post('/api/v1/share').set(t).set('idempotency-key', idem()).send({ targetType: 'LEAD', targetId: lead.id, kind: 'APPLICATION_LINK', cardId }).expect(201);
    expect(decodeURIComponent(wa.body.data.handoffUrl)).toContain(LINK);
    const detail = await api().get(`/api/v1/leads/${lead.id}`).set(t).expect(200);
    expect(detail.body.data.linkActivity.map((a: { action: string }) => a.action)).toEqual(['OPENED', 'SHARED']);
    expect(detail.body.data.linkActivity[0].provenance).toBe('KBS_OPERATIONAL');
    expect(detail.body.data.shares).toHaveLength(1);
    expect(detail.body.data.stage.display).toBe('Awaiting MIS Update'); // FOS-04
    expect(await prisma.bankStatusSnapshot.count()).toBe(0);
    expect(JSON.stringify(detail.body).toLowerCase()).not.toContain('application submitted');
  });

  it('F-407: bank reference stored exactly (zeros/case), unique across leads, correctable while UNVERIFIED with history; Admin any', async () => {
    const t = auth(advToken);
    const lead = (await api().get('/api/v1/leads').set(t).expect(200)).body.data[0];
    const r1 = await api().post(`/api/v1/leads/${lead.id}/bank-reference`).set(t).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: '  0012345aB ' }).expect(201);
    expect(r1.body.data.bankReference).toMatchObject({ kind: 'APPLICATION_NO', value: '0012345aB', status: 'UNVERIFIED', source: 'ADVISOR_ENTERED' });
    // another lead cannot reuse it
    const other = await onboardedAdvisor('9444400003');
    const id2 = await fullDraft(other.token, { mobile: '9811155555' });
    const lead2 = (await api().post(`/api/v1/leads/drafts/${id2}/submit`).set(auth(other.token)).set('idempotency-key', idem()).expect(201)).body.data;
    const clash = await api().post(`/api/v1/leads/${lead2.id}/bank-reference`).set(auth(other.token)).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: '0012345aB' }).expect(409);
    expect(clash.body.error.message).toContain('already linked to another lead');
    expect(JSON.stringify(clash.body)).not.toContain(lead.kbsRef);
    // correction keeps history
    const r2 = await api().post(`/api/v1/leads/${lead.id}/bank-reference`).set(t).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: '0012346' }).expect(201);
    expect(r2.body.data.bankReference.value).toBe('0012346');
    expect(r2.body.data.referenceHistory).toHaveLength(2);
    expect(r2.body.data.referenceHistory.find((h: { value: string }) => h.value === '0012345aB').supersededAt).toBeTruthy();
    // verified references are immutable for the Advisor
    await prisma.bankApplicationLinkage.updateMany({ where: { leadId: lead.id, supersededAt: null }, data: { verificationStatus: 'VERIFIED_BY_MIS_MATCH' } });
    await api().post(`/api/v1/leads/${lead.id}/bank-reference`).set(t).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: '0012347' }).expect(409);
    // Admin can set on any lead; other Advisor cannot touch this lead
    await api().post(`/api/v1/leads/${lead2.id}/bank-reference`).set(auth(adminToken)).set('idempotency-key', idem()).send({ referenceKind: 'OTHER', referenceValue: 'X-1' }).expect(201);
    await api().post(`/api/v1/leads/${lead.id}/bank-reference`).set(auth(other.token)).set('idempotency-key', idem()).send({ referenceKind: 'OTHER', referenceValue: 'Y-1' }).expect(404);
    void advisorId;
    void bankId;
    void setupManagerAndTelecaller;
  });
});
