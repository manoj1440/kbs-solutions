import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';
import { hdfcWorkbook, type MisRowInput, XLSX_TYPE } from './mis-fixture';

describe('A21 Telecaller interest → bank application number → MIS status', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let tc: { accessToken: string; id: string };
  let bankId: string;
  let cardId: string;
  let interestId: string;
  const api = () => request(app.getHttpServer());

  async function interestFor(telecallerId: string, token: string, mobile: string) {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: `t/${mobile}`, originalName: 'r.csv', contentType: 'text/csv', sizeBytes: 1, sha256: mobile.padEnd(64, '0'), uploadedByUserId: admin.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: admin.id, checksum: mobile.padEnd(64, '0'), status: 'IMPORTED' } });
    const rec = await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 2, fullName: `Customer ${mobile}`, mobile, pincode: '302001', assignedTelecallerUserId: telecallerId, assignedAt: new Date() } });
    const share = await api().post('/api/v1/share').set(auth(token)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: rec.id, kind: 'APPLICATION_LINK', cardId }).expect(201);
    return share.body.data.callingInterestId as string;
  }

  async function mis(rows: MisRowInput[]) {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', await hdfcWorkbook(rows), { filename: `mis-${idem()}.xlsx`, contentType: XLSX_TYPE }).expect(201);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, fileId: up.body.data.id }).expect(201);
    return (await api().post(`/api/v1/mis/batches/${b.body.data.id}/apply`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201)).body.data;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    bankId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'AU' } })).id;
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, name: 'AU LIT' }).expect(201);
    cardId = c.body.data.id;
    await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', url: 'https://apply.au.example/lit?utm_source=KBS' }).expect(201);
    await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
    const team = await setupManagerAndTelecaller(app, prisma, '62001');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: team.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    tc = { accessToken: (await loginAs(app, prisma, team.telecallerMobile)).accessToken, id: team.telecallerId };
    interestId = await interestFor(tc.id, tc.accessToken, '+919555600001');
  });
  afterAll(async () => app.close());

  it('before a reference: awaiting reference; MIS row with that number stays unmatched', async () => {
    const list = await api().get('/api/v1/calling/interests').set(auth(tc.accessToken)).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ id: interestId, stage: 'AWAITING_REFERENCE', reference: null, bankStatus: null });
    const r = await mis([{ 'Application No': 'AU-0007', CURRENT_STAGE: 'Login', CUSTOMER_NAME: 'Customer +919555600001' }]);
    expect(r).toMatchObject({ unmatched: 1, callingInterestsApplied: 0 }); // never matched by name/mobile (INV-08)
  });

  it('Telecaller enters the number exactly; duplicates refused', async () => {
    const r = await api().post(`/api/v1/calling/interests/${interestId}/bank-reference`).set(auth(tc.accessToken)).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: '  AU-0042 ' }).expect(201);
    expect(r.body.data).toMatchObject({ stage: 'AWAITING_BANK_UPDATE', reference: { kind: 'APPLICATION_NO', value: 'AU-0042', verified: false } });
    const other = await interestFor(tc.id, tc.accessToken, '+919555600002');
    await api().post(`/api/v1/calling/interests/${other}/bank-reference`).set(auth(tc.accessToken)).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: 'AU-0042' }).expect(409);
    // another Telecaller cannot see or touch it
    const stranger = await setupManagerAndTelecaller(app, prisma, '62002');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: stranger.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    const st = await loginAs(app, prisma, stranger.telecallerMobile);
    await api().post(`/api/v1/calling/interests/${interestId}/bank-reference`).set(auth(st.accessToken)).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: 'X1' }).expect(404);
    expect((await api().get('/api/v1/calling/interests').set(auth(st.accessToken)).expect(200)).body.data).toHaveLength(0);
  });

  it('MIS with that number updates the interest (bank values verbatim), notifies the Telecaller, no lead/payout rows', async () => {
    const r = await mis([{ 'Application No': 'AU-0042', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'V + ACTIVE', FINAL_DECISION_DATE: '05-11-2026 10:00:00' }]);
    expect(r).toMatchObject({ callingInterestsApplied: 1, updatedChanged: 1, unmatched: 0 });
    const s = await prisma.callingBankStatus.findUniqueOrThrow({ where: { callingInterestId: interestId } });
    expect(s).toMatchObject({ applicationNo: 'AU-0042', currentStage: 'Decisioned Cases', finalDecision: 'Approved', cardActivationStatus: 'V + ACTIVE' });
    expect(await prisma.misRow.count({ where: { matchedCallingInterestId: interestId } })).toBe(1);
    expect(await prisma.bankStatusSnapshot.count()).toBe(0);
    expect(await prisma.payoutEntitlement.count()).toBe(0); // INV-05
    expect(await prisma.notification.count({ where: { recipientUserId: tc.id, kind: 'MIS_CHANGED' } })).toBe(1);
    const list = await api().get('/api/v1/calling/interests').set(auth(tc.accessToken)).expect(200);
    expect(list.body.data.find((i: { id: string }) => i.id === interestId)).toMatchObject({ stage: 'APPROVED', reference: { verified: true }, bankStatus: { provenance: 'BANK_MIS', finalDecision: 'Approved' } });
    // verified → the Telecaller can no longer change it
    await api().post(`/api/v1/calling/interests/${interestId}/bank-reference`).set(auth(tc.accessToken)).set('idempotency-key', idem()).send({ referenceKind: 'APPLICATION_NO', referenceValue: 'AU-9' }).expect(409);
  });

  it('INV-02: a later blank never wipes; INV-01: raw writes outside MIS apply are refused', async () => {
    await mis([{ 'Application No': 'AU-0042', CURRENT_STAGE: 'Card Dispatched', FINAL_DECISION: '#N/A' }]);
    expect(await prisma.callingBankStatus.findUniqueOrThrow({ where: { callingInterestId: interestId } })).toMatchObject({ currentStage: 'Card Dispatched', finalDecision: 'Approved' });
    await expect(prisma.$executeRawUnsafe(`UPDATE "CallingBankStatus" SET "finalDecision" = 'Declined'`)).rejects.toThrow(/INV-01/);
  });

  it('Telecaller own performance + Manager/Admin overview carry the bank results', async () => {
    const p = await api().get('/api/v1/calling/me/performance').set(auth(tc.accessToken)).expect(200);
    expect(p.body.data.applications).toMatchObject({ total: 2, APPROVED: 1, AWAITING_REFERENCE: 1, activated: 1 });
    expect(p.body.data.period).toMatchObject({ interests: 2 });
    expect(p.body.data.queueSize).toBe(2);
    const o = await api().get('/api/v1/calling/team/overview').set(auth(adminToken)).expect(200);
    expect(o.body.data.telecallers.find((t: { id: string }) => t.id === tc.id).applications).toMatchObject({ APPROVED: 1 });
    // the team endpoint stays closed to Telecallers
    await api().get('/api/v1/calling/team/overview').set(auth(tc.accessToken)).expect(403);
  });
});
