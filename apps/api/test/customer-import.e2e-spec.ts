import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

async function workbook(rows: Array<Array<string | number>>, headers = ['NAME', 'PAN NO', 'MOBILE', 'Pincode']) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Customers');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('F-303 customer list import + F-305 allocation', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    // pincode master for location resolution
    await prisma.pincodeMaster.createMany({ data: [{ pincode: '302001', officeName: 'Jaipur GPO', district: 'Jaipur', state: 'Rajasthan' }], skipDuplicates: true });
    // one suppressed mobile
    await api().post('/api/v1/suppressions').set(auth(adminToken)).set('idempotency-key', idem()).send({ mobile: '9555500909', reason: 'COMPLIANCE' }).expect(201);
  });
  afterAll(async () => app.close());

  async function upload(buf: Buffer, name = 'customers.xlsx') {
    const up = await api().post('/api/v1/files/customer_list').set(auth(adminToken)).attach('file', buf, { filename: name, contentType: XLSX }).expect(201);
    return up.body.data.id as string;
  }

  async function makeTrainedTelecaller(suffix: string) {
    const s = await setupManagerAndTelecaller(app, prisma, suffix);
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: s.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    await prisma.user.update({ where: { id: s.telecallerId }, data: { employeeCode: `TC${suffix}` } });
    return s;
  }

  let batchId: string;

  it('CUST-01: the sample header set maps automatically, preview is masked, numeric pincodes keep leading zeros', async () => {
    const rows: Array<Array<string | number>> = [];
    for (let i = 1; i <= 10; i++) rows.push([`Customer ${i}`, 'ABCDE1234F', 9555500000 + i, i === 3 ? '012345' : 302001]); // row 3: text cell with leading zero; others numeric cells
    rows.push(['Bad Mobile', '', '12345', 302001]); // invalid mobile → review
    rows.push(['', 'BADPAN', 9555500011, 302001]); // blank name → review, invalid PAN → warning
    rows.push(['Dup Customer', '', 9555500001, 302001]); // in-batch duplicate → excluded
    rows.push(['Suppressed Cust', '', 9555500909, 302001]); // suppressed → excluded
    const fileId = await upload(await workbook(rows));
    const created = await api().post('/api/v1/calling-list/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId }).expect(201);
    batchId = created.body.data.id;
    expect(created.body.data.status).toBe('UPLOADED');
    expect(created.body.data.headerMapping.proposed).toEqual({ name: 'NAME', mobile: 'MOBILE', pincode: 'Pincode', pan: 'PAN NO' });
    expect(created.body.data.headerMapping.proposed.location).toBeUndefined();
    expect(created.body.data.preview[0].mobile).toBe('+91••••••0001');
    expect(created.body.data.preview[0].pan).toBe('•••••1234F');
    expect(created.body.data.preview[0].name).toBe('Customer 1');

    const mapped = await api().put(`/api/v1/calling-list/batches/${batchId}/mapping`).set(auth(adminToken)).send({ name: 'NAME', mobile: 'MOBILE', pincode: 'Pincode', pan: 'PAN NO' }).expect(200);
    expect(mapped.body.data.status).toBe('VALIDATED');
    const v = mapped.body.data.totals.validation;
    expect(v).toMatchObject({ accepted: 10, needsReview: 2, excluded: 2 });
    expect(v.byIssue).toMatchObject({ INVALID_MOBILE: 1, BLANK_NAME: 1, INVALID_PAN: 1, DUPLICATE_IN_BATCH: 1, SUPPRESSED: 1 });
    // wrong column name is rejected
    await api().put(`/api/v1/calling-list/batches/${batchId}/mapping`).set(auth(adminToken)).send({ name: 'Nope', mobile: 'MOBILE', pincode: 'Pincode' }).expect(400);
  });

  it('CUST-02: confirm without compliance confirmation imports but does not allocate; attestation + trained Telecallers → 4/3/3 split', async () => {
    const confirmed = await api().post(`/api/v1/calling-list/batches/${batchId}/confirm`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
    expect(confirmed.body.data.status).toBe('IMPORTED');
    expect(confirmed.body.data.allocation).toMatchObject({ ran: false, blockedReason: 'COMPLIANCE_NOT_CONFIRMED', unassigned: 10 });
    expect(confirmed.body.data.allocationAllowed).toBe(false);
    const rec = await prisma.callingRecord.findFirstOrThrow({ where: { batchId, sourceRowNumber: 4 } }); // row 3 data → sheet row 4
    expect(rec.pincode).toBe('012345');
    expect(rec.locationResolved).toBe(false);
    const rec1 = await prisma.callingRecord.findFirstOrThrow({ where: { batchId, sourceRowNumber: 2 } });
    expect(rec1).toMatchObject({ pincode: '302001', resolvedCity: 'Jaipur', resolvedState: 'Rajasthan', locationResolved: true, panLast4: '234F' });
    expect(rec1.panEncrypted).not.toContain('ABCDE1234F');
    expect(await prisma.callingRecord.count({ where: { batchId, reviewStatus: 'EXCLUDED', hiddenAt: { not: null } } })).toBe(2);

    // explicit run is refused while the gate is closed
    await api().post(`/api/v1/calling-list/batches/${batchId}/allocate`).set(auth(adminToken)).set('idempotency-key', idem()).expect(409);

    // three trained Telecallers + one untrained; pool sorted by employee code
    const a = await makeTrainedTelecaller('00001');
    const b = await makeTrainedTelecaller('00002');
    const c = await makeTrainedTelecaller('00003');
    const untrained = await setupManagerAndTelecaller(app, prisma, '00004');

    // per-batch attestation is recorded on the batch, then run
    await prisma.customerImportBatch.update({ where: { id: batchId }, data: { consentRepresentationConfirmed: true, sourceVendor: 'Vendor X', permittedUseBasis: 'consented marketing list' } });
    const run = await api().post(`/api/v1/calling-list/batches/${batchId}/allocate`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    expect(run.body.data).toMatchObject({ ran: true, assigned: 10, unassigned: 0, algorithm: 'ROUND_ROBIN_EQUAL' });
    expect(run.body.data.perTelecaller).toEqual({ [a.telecallerId]: 4, [b.telecallerId]: 3, [c.telecallerId]: 3 });
    expect(await prisma.callingRecord.count({ where: { assignedTelecallerUserId: untrained.telecallerId } })).toBe(0);
    expect(await prisma.allocationEvent.count({ where: { batchId, reason: 'AUTO_ALLOCATION' } })).toBe(10);
    expect(await prisma.notification.count({ where: { kind: 'ASSIGNMENT_NEW' } })).toBe(3);
    const detail = await api().get(`/api/v1/calling-list/batches/${batchId}`).set(auth(adminToken)).expect(200);
    expect(detail.body.data.allocation).toMatchObject({ assigned: 10, unassigned: 0, hidden: 2 });
    expect(detail.body.data.allocatedAt).toBeTruthy();
  });

  it('review queue: accept allocates the row, exclude hides it; rows are masked', async () => {
    const rows = await api().get(`/api/v1/calling-list/batches/${batchId}/rows?reviewStatus=NEEDS_REVIEW`).set(auth(adminToken)).expect(200);
    expect(rows.body.meta.total).toBe(2);
    const badMobile = rows.body.data.find((r: { reviewReason: string }) => r.reviewReason.includes('INVALID_MOBILE'));
    const blankName = rows.body.data.find((r: { reviewReason: string }) => r.reviewReason.includes('BLANK_NAME'));
    expect(badMobile.mobileMasked).toBe('(invalid)');
    expect(blankName.mobileMasked).toBe('+91••••••0011');
    // invalid mandatory data cannot be accepted
    await api().post(`/api/v1/calling-list/records/${badMobile.id}/review`).set(auth(adminToken)).set('idempotency-key', idem()).send({ action: 'ACCEPT', reason: 'looks fine' }).expect(400);
    await api().post(`/api/v1/calling-list/records/${badMobile.id}/review`).set(auth(adminToken)).set('idempotency-key', idem()).send({ action: 'EXCLUDE', reason: 'mobile unusable' }).expect(201);
    // blank name cannot be accepted either (mandatory) → exclude
    await api().post(`/api/v1/calling-list/records/${blankName.id}/review`).set(auth(adminToken)).set('idempotency-key', idem()).send({ action: 'EXCLUDE', reason: 'no name' }).expect(201);
    expect(await prisma.callingRecord.count({ where: { batchId, reviewStatus: 'NEEDS_REVIEW' } })).toBe(0);
    expect(await prisma.callingRecord.count({ where: { id: badMobile.id, hiddenAt: { not: null } } })).toBe(1);
  });

  it('CUST-03: re-import keeps existing assignments; suppressed mobiles are excluded; identical file returns the prior batch', async () => {
    // record 1 gets a call outcome-ish state so we can prove it is untouched
    const existing = await prisma.callingRecord.findFirstOrThrow({ where: { batchId, mobile: '+919555500001' } });
    await prisma.callingRecord.update({ where: { id: existing.id }, data: { interactionStatus: 'FOLLOW_UP' } });

    const rows: Array<Array<string | number>> = [
      ['Customer 1 again', '', 9555500001, 302001], // duplicate of existing active → excluded
      ['Suppressed Cust', '', 9555500909, 302001], // suppressed → excluded
      ['Fresh Customer', 'ABCDE1234F', 9555500099, 302001], // accepted
    ];
    const buf = await workbook(rows, ['Customer Name', 'Pan No', 'Mobile No', 'PIN']);
    const fileId = await upload(buf, 'reimport.xlsx');
    const created = await api().post('/api/v1/calling-list/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId }).expect(201);
    expect(created.body.data.headerMapping.proposed).toEqual({ name: 'Customer Name', mobile: 'Mobile No', pincode: 'PIN', pan: 'Pan No' });
    const id2 = created.body.data.id as string;
    const mapped = await api().put(`/api/v1/calling-list/batches/${id2}/mapping`).set(auth(adminToken)).send({ name: 'Customer Name', mobile: 'Mobile No', pincode: 'PIN', pan: 'Pan No' }).expect(200);
    expect(mapped.body.data.totals.validation).toMatchObject({ accepted: 1, excluded: 2, byIssue: { DUPLICATE_OF_EXISTING: 1, SUPPRESSED: 1 } });
    const confirmed = await api().post(`/api/v1/calling-list/batches/${id2}/confirm`).set(auth(adminToken)).set('idempotency-key', idem()).send({ consentRepresentationConfirmed: true, sourceVendor: 'Vendor X', permittedUseBasis: 'consented list' }).expect(201);
    expect(confirmed.body.data.allocation).toMatchObject({ ran: true, assigned: 1 });
    expect(confirmed.body.data.consentRepresentationConfirmed).toBe(true);

    const still = await prisma.callingRecord.findUniqueOrThrow({ where: { id: existing.id } });
    expect(still.assignedTelecallerUserId).toBe(existing.assignedTelecallerUserId);
    expect(still.interactionStatus).toBe('FOLLOW_UP');
    expect(await prisma.callingRecord.count({ where: { batchId: id2, suppressed: true, hiddenAt: { not: null } } })).toBe(1);
    expect(await prisma.contactSuppression.count({ where: { mobile: '+919555500909', liftedAt: null } })).toBe(1);

    // same bytes again → prior batch, no new rows
    const fileId3 = await upload(buf, 'reimport-copy.xlsx');
    const again = await api().post('/api/v1/calling-list/batches').set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId: fileId3 }).expect(201);
    expect(again.body.data.id).toBe(id2);
    expect(again.body.data.duplicateOf).toBe(created.body.data.publicRef);
    expect(await prisma.customerImportBatch.count()).toBe(2);
  });

  it('Manager cannot import; Telecaller cannot review', async () => {
    const s = await setupManagerAndTelecaller(app, prisma, '00005');
    await api().get('/api/v1/calling-list/batches').set(auth(s.manager.accessToken)).expect(403);
  });
});
