import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';
import { HDFC_HEADERS, hdfcWorkbook, XLSX_TYPE } from './mis-fixture';

describe('F-501 MIS profiles / F-502 upload, parse, map (MIS-01, MIS-08, MIS-11)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let hdfcId: string;
  let profileId: string;
  const api = () => request(app.getHttpServer());

  async function upload(buf: Buffer, name = 'mis.xlsx') {
    const up = await api().post('/api/v1/files/mis').set(auth(adminToken)).attach('file', buf, { filename: name, contentType: XLSX_TYPE }).expect(201);
    return up.body.data.id as string;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
  });
  afterAll(async () => app.close());

  it('seeded HDFC v1 profile maps all 36 headers; approval is required before import; edits to an approved profile create v2', async () => {
    const list = await api().get(`/api/v1/mis/profiles?bankId=${hdfcId}`).set(auth(adminToken)).expect(200);
    expect(list.body.data).toHaveLength(1);
    profileId = list.body.data[0].id;
    const p = await api().get(`/api/v1/mis/profiles/${profileId}`).set(auth(adminToken)).expect(200);
    expect(p.body.data.status).toBe('DRAFT');
    expect(Object.keys(p.body.data.fieldMap)).toHaveLength(36);
    expect(new Set(Object.values(p.body.data.fieldMap))).toEqual(new Set(HDFC_HEADERS));
    expect(p.body.data.referenceFields).toEqual([{ kind: 'APPLICATION_NO', header: 'Application No' }, { kind: 'APPLICATION_REFERENCE_NUMBER', header: 'APPLICATION_REFERENCE_NUMBER' }]);
    // import refused while DRAFT
    const f = await upload(await hdfcWorkbook([{ 'Application No': '1' }]));
    const refused = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId: f }).expect(409);
    expect(refused.body.error.code).toBe('MIS_PROFILE_NOT_APPROVED');
    // bad internal field rejected
    await api().patch(`/api/v1/mis/profiles/${profileId}`).set(auth(adminToken)).send({ fieldMap: { bogusField: 'X' } }).expect(400);
    await api().post(`/api/v1/mis/profiles/${profileId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'reviewed against sample KBS804' }).expect(201);
    const v2 = await api().patch(`/api/v1/mis/profiles/${profileId}`).set(auth(adminToken)).send({ headerAliases: { 'Card Activation Staus': ['Card Activation Status'] } }).expect(200);
    expect(v2.body.data).toMatchObject({ version: 2, status: 'DRAFT' });
    expect((await prisma.misImportProfile.findUniqueOrThrow({ where: { id: profileId } })).status).toBe('APPROVED');
    // Manager cannot touch profiles
    const mgr = await setupManagerAndTelecaller(app, prisma, '70001');
    await api().get('/api/v1/mis/profiles').set(auth(mgr.manager.accessToken)).expect(403);
  });

  it('MIS-01/MIS-11: HDFC-like file parses with raw preserved (zeros, sci-notation, blanks, #N/A), extra column kept, new values verbatim', async () => {
    const wb = await hdfcWorkbook(
      [
        { 'Application No': '0012345', APPLICATION_REFERENCE_NUMBER: 'REF-A1', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', 'Card Activation Staus': '#N/A', CUSTOMER_NAME: 'Ramesh Kumar', COMPANY_NAME: 'Acme Ltd', CAPTURE_LINK: 'https://x/y', FINAL_DECISION_DATE: '15-09-2026 10:30:00', 'Creation Date': '01-09-2026', 'Extra Col': 'kept' },
        { 'Application No': 12000000, CURRENT_STAGE: 'Some Brand New Stage', FINAL_DECISION: '', CUSTOMER_NAME: 'Sita Devi' },
        { CUSTOMER_NAME: 'No Reference Row', CURRENT_STAGE: 'Document Curing' },
        { 'Application No': '0012345', APPLICATION_REFERENCE_NUMBER: 'REF-A1', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', 'Card Activation Staus': '#N/A', CUSTOMER_NAME: 'Ramesh Kumar', COMPANY_NAME: 'Acme Ltd', CAPTURE_LINK: 'https://x/y', FINAL_DECISION_DATE: '15-09-2026 10:30:00', 'Creation Date': '01-09-2026', 'Extra Col': 'kept' },
      ],
      { extraHeaders: ['Extra Col'] },
    );
    const fileId = await upload(wb);
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId }).expect(201);
    expect(b.body.data.publicRef).toMatch(/^KBS-M-/);
    expect(b.body.data.stage).toBe('MAPPED');
    expect(b.body.data.totals).toMatchObject({ rows: 4, unique: 3, duplicateRows: 1, invalid: 1, missingHeaders: [], unmappedColumns: ['Extra Col'] });
    const batchId = b.body.data.id as string;
    // rows (masked by default)
    const rows = await api().get(`/api/v1/mis/batches/${batchId}/rows`).set(auth(adminToken)).expect(200);
    expect(rows.body.meta.total).toBe(3);
    const r1 = rows.body.data[0];
    expect(r1.raw['Application No']).toBe('0012345');
    expect(r1.raw['Extra Col']).toBe('kept');
    expect(r1.raw['Card Activation Staus']).toBe('#N/A');
    expect(r1.raw.CUSTOMER_NAME).toBe('R••••••');
    expect(r1.mapped.customerName).toBe('R••••••');
    expect(r1.mapped.companyName).toBe('A••••••');
    expect(r1.mapped.captureLink).not.toContain('https');
    expect(r1.mapped.currentStage).toBe('Decisioned Cases');
    expect(r1.referenceValues).toEqual([{ kind: 'APPLICATION_NO', value: '0012345' }, { kind: 'APPLICATION_REFERENCE_NUMBER', value: 'REF-A1' }]);
    expect(r1.matchState).toBe('PENDING');
    expect(JSON.stringify(rows.body)).not.toContain('Ramesh');
    const r2 = rows.body.data[1];
    expect(r2.raw['Application No']).toBe('12000000');
    expect(r2.mapped.currentStage).toBe('Some Brand New Stage'); // verbatim, not translated (MIS-11)
    expect(rows.body.data[2]).toMatchObject({ matchState: 'INVALID', matchExplanation: expect.stringContaining('NO_REFERENCE') });
    // dates parsed with text kept
    const dbRow = await prisma.misRow.findFirstOrThrow({ where: { batchId, sourceRowNumber: 2 } });
    const dates = dbRow.mappedDates as Record<string, { text: string; iso: string | null }>;
    expect(dates.finalDecisionDate).toEqual({ text: '15-09-2026 10:30:00', iso: '2026-09-15T05:00:00.000Z' });
    expect(dates.creationDate.text).toBe('01-09-2026');
    // reveal requires MIS_RAW_ROW_VIEW and is logged
    const revealed = await api().get(`/api/v1/mis/batches/${batchId}/rows?reveal=true`).set(auth(adminToken)).expect(200);
    expect(revealed.body.data[0].raw.CUSTOMER_NAME).toBe('Ramesh Kumar');
    expect(revealed.body.meta.revealed).toBe(true);
    expect(await prisma.sensitiveAccessLog.count({ where: { field: 'MIS_RAW_ROW' } })).toBe(1);
    // MIS-08 (part): identical file → same batch, no new rows
    const again = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId: await upload(wb, 'copy.xlsx') }).expect(201);
    expect(again.body.data.id).toBe(batchId);
    expect(again.body.data.duplicateOf).toBe(b.body.data.publicRef);
    expect(await prisma.misImportBatch.count({ where: { bankId: hdfcId } })).toBe(1);
  });

  it('a pincode workbook or calling list uploaded as MIS is REJECTED with an explicit reason', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('rbl bank');
    ws.addRow(['Pincode', 'City', 'State', 'Sourceable']);
    ws.addRow(['302001', 'Jaipur', 'Rajasthan', 'Y']);
    const fileId = await upload(Buffer.from(await wb.xlsx.writeBuffer()), 'pincodes.xlsx');
    const b = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId }).expect(201);
    expect(b.body.data.stage).toBe('REJECTED');
    expect(b.body.data.rejectReason).toContain('No reference column');
    expect(await prisma.misRow.count({ where: { batchId: b.body.data.id } })).toBe(0);
    // a file with references but no status columns is also rejected
    const wb2 = new ExcelJS.Workbook();
    const ws2 = wb2.addWorksheet('Sheet1');
    ws2.addRow(['Application No', 'CUSTOMER_NAME']);
    ws2.addRow(['1', 'X']);
    const b2 = await api().post('/api/v1/mis/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId: await upload(Buffer.from(await wb2.xlsx.writeBuffer()), 'nostatus.xlsx') }).expect(201);
    expect(b2.body.data.rejectReason).toContain('No status column');
    // reject a mapped batch manually
    const list = await api().get(`/api/v1/mis/batches?bankId=${hdfcId}&stage=MAPPED`).set(auth(adminToken)).expect(200);
    expect(list.body.data).toHaveLength(1);
    await api().post(`/api/v1/mis/batches/${list.body.data[0].id}/reject`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'wrong month' }).expect(201);
  });
});
