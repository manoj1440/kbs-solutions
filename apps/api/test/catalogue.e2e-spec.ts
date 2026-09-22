import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Fixture workbook: the nine REQ-07 §7.2 sheet structures with exact headers (PIN-01). */
async function nineSheetWorkbook() {
  const wb = new ExcelJS.Workbook();
  const add = (name: string, headers: string[], rows: Array<Array<string | number>>) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
  };
  add('EQUITAS', ['CITY', 'DISTRICT', 'STATE', 'REGION', 'SOURCING PINCODE', 'BANK', 'Asset _Branch_Code', 'LIABILITY_BRANCH CODE', 'Remarks'], [
    ['Jaipur', 'Jaipur', 'Rajasthan', 'North', '302001', 'EQUITAS', 'AB01', 'LB01', 'ok'],
    ['Delhi', 'Delhi', 'Delhi', 'North', 110001, 'EQUITAS', 'AB02', 'LB02', 'not serviceable'],
    ['Nowhere', 'X', 'Y', 'Z', '', 'EQUITAS', '', '', ''],
  ]);
  add('IDFC BANK', ['EXTERNAL_CODE', 'MASTER_PINCODES_NAME', 'CITY', 'STATE', 'COUNTRY', 'NTB'], [['E1', '302001', 'Jaipur', 'Rajasthan', 'India', 'Y']]);
  add('HSBC BANK', ['CARDDELIVERYFLAG', 'CITY', 'COUNTRY', 'DISTRICT', 'FLAG', 'PINCODE', 'PINCODEFLAG', 'STATE', 'STATUS', 'STDCODE'], [['Y', 'Jaipur', 'IN', 'Jaipur', 'A', '302001', 'Y', 'RJ', 'ACTIVE', '0141']]);
  add('Indusind bank', ['Pincode', 'City', 'State/UT', 'Branch SOL ID', 'Added on'], [['302001', 'Jaipur', 'Rajasthan', 'SOL1', '2024-01-01'], [123, 'Zeros', 'Test', 'SOL2', '2024-01-01']]);
  add('rbl bank', ['Pincode', 'City', 'City Code', 'City_Unique_Code', 'State', 'State Code', 'State_Unique_Code', 'Region Code', 'Country: Country Name', 'Sourceable', 'Is Online City'], [
    ['302001', 'Jaipur', 'JAI', 'JAI1', 'Rajasthan', 'RJ', 'RJ1', 'N', 'India', 'Y', 'Y'],
    ['110001', 'Delhi', 'DEL', 'DEL1', 'Delhi', 'DL', 'DL1', 'N', 'India', 'N', 'Y'],
    ['400001', 'Mumbai', 'MUM', 'MUM1', 'Maharashtra', 'MH', 'MH1', 'W', 'India', '', 'Y'],
  ]);
  add('au bank', ['CUST_PINCODE', 'CUST_STATE'], [['302001', 'Rajasthan']]);
  add('yes bank', ['PINCODE', 'District', 'STATE NAME', 'CITY NAME', 'city_code', 'REGION CODE', 'state_short', 'std_code', 'hub_location', 'branch_code', 'ICL/OCL', 'Policy', 'REGION'], [['302001', 'Jaipur', 'Rajasthan', 'Jaipur', 'JAI', 'N', 'RJ', '0141', 'JAI', 'B1', 'ICL', 'P1', 'North']]);
  add('AXIS BANK', ['lender_id', 'pincode', 'city', 'state', 'address_type', 'lenderApiVersion', 'pincode_type'], [['AX', '302001', 'Jaipur', 'Rajasthan', 'RES', 'v1', 'URBAN']]);
  add('SBI BANK', ['lender_id', 'pincode', 'city', 'state', 'address_type', 'std', 'source_code', 'lenderApiVersion'], [['SBI', '302001', 'Jaipur', 'Rajasthan', 'RES', '0141', 'SC1', 'v1']]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('F-403 catalogue / F-404 bank pincode profiles', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let hdfcId: string;
  let cardId: string;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
  });
  afterAll(async () => app.close());

  it('seeds: ten banks, five categories, nine DRAFT pincode profiles, example links unpublished', async () => {
    const banks = await api().get('/api/v1/catalogue/banks').set(auth(adminToken)).expect(200);
    expect(banks.body.data.length).toBeGreaterThanOrEqual(10);
    const cats = await api().get('/api/v1/catalogue/categories').set(auth(adminToken)).expect(200);
    expect(cats.body.data.map((c: { key: string }) => c.key)).toEqual(['TRAVEL', 'SHOPPING', 'PREMIUM', 'FUEL', 'OTHER']);
    const profiles = await api().get('/api/v1/pincode-profiles').set(auth(adminToken)).expect(200);
    expect(profiles.body.data).toHaveLength(9);
    expect(profiles.body.data.every((p: { status: string }) => p.status === 'DRAFT')).toBe(true);
    const published = await api().get('/api/v1/catalogue/cards?status=PUBLISHED').set(auth(adminToken)).expect(200);
    expect(published.body.data).toHaveLength(0);
  });

  it('CARD-01: create → edit → forbidden phrase blocks publish → override with reason → publish bumps version; retire', async () => {
    const created = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'HDFC Millennia', description: 'Cashback on everyday spends. Guaranteed approval for salaried!', benefits: ['5% cashback online'], joiningFee: 1000, annualFee: 1000, categoryKeys: ['SHOPPING', 'FUEL'] }).expect(201);
    cardId = created.body.data.id;
    expect(created.body.data).toMatchObject({ status: 'DRAFT', version: 1, joiningFee: 1000, effectiveChannels: [] });
    expect(created.body.data.categories.map((c: { key: string }) => c.key)).toEqual(['SHOPPING', 'FUEL']);
    const blocked = await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(400);
    expect(blocked.body.error.details.forbiddenPhrases).toEqual(['guaranteed approval']);
    // fix copy instead of override
    await api().patch(`/api/v1/catalogue/cards/${cardId}`).set(auth(adminToken)).send({ description: 'Cashback on everyday spends. Subject to bank approval.', categoryKeys: ['SHOPPING'] }).expect(200);
    const pub = await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
    expect(pub.body.data).toMatchObject({ status: 'PUBLISHED', version: 1, forbiddenPhraseOverride: null });
    // second publish (after edits) increments version; override path is audited
    await api().patch(`/api/v1/catalogue/cards/${cardId}`).set(auth(adminToken)).send({ eligibilityHighlights: 'Instant approval decision in minutes' }).expect(200);
    await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(400);
    const pub2 = await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({ overrideReason: 'bank-approved wording for this campaign' }).expect(201);
    expect(pub2.body.data.version).toBe(2);
    expect(pub2.body.data.forbiddenPhraseOverride).toContain('bank-approved wording');
    expect(await prisma.auditLog.count({ where: { action: 'card.publish', entityId: cardId } })).toBe(2);
    // non-admin cannot manage but can read
    const s = await setupManagerAndTelecaller(app, prisma, '20001');
    await api().get('/api/v1/catalogue/cards').set(auth(s.manager.accessToken)).expect(200);
    await api().post('/api/v1/catalogue/cards').set(auth(s.manager.accessToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'x' }).expect(403);
  });

  it('WA-02: application links are stored verbatim (utm + fragment); one effective link per channel; history kept', async () => {
    const url = 'https://balaji-partner-h.getpopcard.co/?utm_source=SRIBALAJI&utm_medium=cardifye&utm_campaign=CADF43_KBS#/apply?x=1&y=2 ';
    const l1 = await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', url }).expect(201);
    expect(l1.body.data.url).toBe(url);
    const l2 = await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'TELECALLER', url: 'https://example.com/tc?utm_source=TC' }).expect(201);
    const card = await api().get(`/api/v1/catalogue/cards/${cardId}`).set(auth(adminToken)).expect(200);
    expect(card.body.data.links).toHaveLength(2);
    // BOTH link was closed when the TELECALLER link started (overlap) → only TELECALLER effective now
    const both = card.body.data.links.find((l: { id: string }) => l.id === l1.body.data.id);
    expect(both.effectiveTo).toBeTruthy();
    expect(card.body.data.effectiveChannels).toEqual(['TELECALLER']);
    await api().post(`/api/v1/catalogue/links/${l2.body.data.id}/end`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'campaign over' }).expect(201);
    const after = await api().get(`/api/v1/catalogue/cards/${cardId}`).set(auth(adminToken)).expect(200);
    expect(after.body.data.effectiveChannels).toEqual([]);
    await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', url: 'ftp://nope' }).expect(400);
  });

  it('crosswalk: MIS product code → card (same bank only)', async () => {
    await api().post('/api/v1/catalogue/crosswalks').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, misProductCode: 'MILLENNIA-CC', cardId }).expect(201);
    const au = await prisma.bank.findUniqueOrThrow({ where: { code: 'AU' } });
    await api().post('/api/v1/catalogue/crosswalks').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: au.id, misProductCode: 'X', cardId }).expect(400);
    const list = await api().get(`/api/v1/catalogue/crosswalks?bankId=${hdfcId}`).set(auth(adminToken)).expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('PIN-01/02/03: nine-sheet fixture imports with raw preserved; HSBC stays REQUIRES_BANK_MAPPING; zeros preserved; approval gates sourceability', async () => {
    const buf = await nineSheetWorkbook();
    const up = await api().post('/api/v1/files/bank_pincode').set(auth(adminToken)).attach('file', buf, { filename: 'bank-pincodes.xlsx', contentType: XLSX }).expect(201);
    const fileId = up.body.data.id as string;
    const profiles = (await api().get('/api/v1/pincode-profiles').set(auth(adminToken)).expect(200)).body.data as Array<{ id: string; bank: { code: string }; sheetName: string }>;
    const byBank = Object.fromEntries(profiles.map((p) => [p.bank.code, p]));

    // nothing sourceable before any approval
    expect((await api().get('/api/v1/sourceability/302001').set(auth(adminToken)).expect(200)).body.data).toEqual([]);

    const results: Record<string, { batchId: string; counts: { sourceable: number; requiresBankMapping: number } }> = {};
    for (const code of ['EQUITAS', 'IDFC', 'HSBC', 'INDUSIND', 'RBL', 'AU', 'YES', 'AXIS', 'SBI']) {
      const p = byBank[code];
      const created = await api().post(`/api/v1/pincode-profiles/${p.id}/batches`).set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId }).expect(201);
      expect(created.body.data.preview.headerCheck.ok).toBe(true);
      expect(created.body.data.status).toBe('VALIDATED');
      const confirmed = await api().post(`/api/v1/pincode-batches/${created.body.data.id}/confirm`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
      results[code] = { batchId: created.body.data.id, counts: confirmed.body.data.counts };
    }
    expect(results.EQUITAS.counts).toMatchObject({ rows: 3, sourceable: 2 }); // blank pincode row → NOT_SOURCEABLE
    expect(results.HSBC.counts).toMatchObject({ rows: 1, sourceable: 0, requiresBankMapping: 1 }); // PIN-02
    expect(results.RBL.counts).toMatchObject({ rows: 3, sourceable: 1, requiresBankMapping: 1 }); // Y / N / blank flag
    expect(results.AU.counts.sourceable).toBe(1);

    // raw preserved exactly (PIN-01) and numeric cell 123 padded to '000123' with wasPadded (PIN-03)
    const eqRows = await api().get(`/api/v1/pincode-batches/${results.EQUITAS.batchId}/rows`).set(auth(adminToken)).expect(200);
    expect(eqRows.body.data[0].raw).toEqual({ CITY: 'Jaipur', DISTRICT: 'Jaipur', STATE: 'Rajasthan', REGION: 'North', 'SOURCING PINCODE': '302001', BANK: 'EQUITAS', 'Asset _Branch_Code': 'AB01', 'LIABILITY_BRANCH CODE': 'LB01', Remarks: 'ok' });
    expect(eqRows.body.data[1]).toMatchObject({ pincode: '110001', wasPadded: false, sourceability: 'SOURCEABLE' });
    const indRows = await api().get(`/api/v1/pincode-batches/${results.INDUSIND.batchId}/rows?pincode=000123`).set(auth(adminToken)).expect(200);
    expect(indRows.body.data).toHaveLength(1);
    expect(indRows.body.data[0]).toMatchObject({ pincode: '000123', wasPadded: true, raw: { Pincode: '123', 'Branch SOL ID': 'SOL2' } });
    expect(await prisma.auditLog.count({ where: { action: 'pincodeBatch.rowsViewed' } })).toBe(2);
    const rblRows = await api().get(`/api/v1/pincode-batches/${results.RBL.batchId}/rows`).set(auth(adminToken)).expect(200);
    expect(rblRows.body.data.map((r: { sourceability: string }) => r.sourceability)).toEqual(['SOURCEABLE', 'NOT_SOURCEABLE', 'REQUIRES_BANK_MAPPING']);
    expect(rblRows.body.data[1].raw['Is Online City']).toBe('Y'); // preserved, never equated with Sourceable

    // approve EQUITAS, RBL, HSBC → sourceability lookup reflects only approved banks; HSBC never "available"
    for (const code of ['EQUITAS', 'RBL', 'HSBC']) await api().post(`/api/v1/pincode-profiles/${byBank[code].id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    const s = (await api().get('/api/v1/sourceability/302001').set(auth(adminToken)).expect(200)).body.data as Array<{ bankId: string; sourceability: string }>;
    const banks = await prisma.bank.findMany({ where: { code: { in: ['EQUITAS', 'RBL', 'HSBC'] } } });
    const byId = Object.fromEntries(banks.map((b) => [b.id, b.code]));
    expect(Object.fromEntries(s.map((x) => [byId[x.bankId], x.sourceability]))).toEqual({ EQUITAS: 'SOURCEABLE', RBL: 'SOURCEABLE', HSBC: 'REQUIRES_BANK_MAPPING' });
    const s2 = (await api().get('/api/v1/sourceability/110001').set(auth(adminToken)).expect(200)).body.data as Array<{ bankId: string; sourceability: string }>;
    expect(Object.fromEntries(s2.map((x) => [byId[x.bankId], x.sourceability]))).toEqual({ EQUITAS: 'SOURCEABLE', RBL: 'NOT_SOURCEABLE' });

    // editing an APPROVED profile creates a new DRAFT version; approving it retires the old one
    const hsbc = byBank.HSBC;
    const edited = await api().patch(`/api/v1/pincode-profiles/${hsbc.id}`).set(auth(adminToken)).send({ semantics: { rule: 'FLAG_EQUALS', column: 'STATUS', trueValues: ['ACTIVE'] } }).expect(200);
    expect(edited.body.data).toMatchObject({ version: 2, status: 'DRAFT' });
    await api().post(`/api/v1/pincode-profiles/${edited.body.data.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    expect((await prisma.bankPincodeProfile.findUniqueOrThrow({ where: { id: hsbc.id } })).status).toBe('RETIRED');
    // the new version has no batch yet → HSBC drops out of the lookup until re-imported under it
    const s3 = (await api().get('/api/v1/sourceability/302001').set(auth(adminToken)).expect(200)).body.data as Array<{ bankId: string }>;
    expect(s3.map((x) => byId[x.bankId]).sort()).toEqual(['EQUITAS', 'RBL']);
    // identical file under the same profile → prior batch
    const again = await api().post(`/api/v1/pincode-profiles/${byBank.AU.id}/batches`).set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId }).expect(201);
    expect(again.body.data.duplicateOf).toBe(results.AU.batchId);
  });

  it('header mismatch is surfaced and blocks confirm', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('au bank');
    ws.addRow(['PINCODE', 'STATE']);
    ws.addRow(['302001', 'RJ']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const up = await api().post('/api/v1/files/bank_pincode').set(auth(adminToken)).attach('file', buf, { filename: 'au-bad.xlsx', contentType: XLSX }).expect(201);
    const au = (await prisma.bankPincodeProfile.findFirstOrThrow({ where: { bank: { code: 'AU' } } })).id;
    const created = await api().post(`/api/v1/pincode-profiles/${au}/batches`).set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId: up.body.data.id }).expect(201);
    expect(created.body.data.status).toBe('UPLOADED');
    expect(created.body.data.preview.headerCheck).toMatchObject({ ok: false, missing: ['CUST_PINCODE', 'CUST_STATE'], unknown: ['PINCODE', 'STATE'], pincodePresent: false });
    await api().post(`/api/v1/pincode-batches/${created.body.data.id}/confirm`).set(auth(adminToken)).set('idempotency-key', idem()).expect(409);
  });
});
