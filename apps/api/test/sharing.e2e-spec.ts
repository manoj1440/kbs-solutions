import { makePublicRef, RefPrefix, shareStatusLabel } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const LINK = 'https://cconboarding.au.bank.in/auccself/#/?utm_source=MMFNT&utm_medium=banner&utm_campaign=MMFNT-display-campaign-ENT-KBS_50263';

describe('F-312 official ID / F-311 WhatsApp sharing (WA-01, WA-02)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let team: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let tcToken: string;
  let rec: string;
  let cardId: string;
  let publicRef: string;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    team = await setupManagerAndTelecaller(app, prisma, '50001');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: team.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    publicRef = (await prisma.user.findUniqueOrThrow({ where: { id: team.telecallerId } })).publicRef;
    tcToken = (await loginAs(app, prisma, team.telecallerMobile)).accessToken;
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: 't/s.csv', originalName: 's.csv', contentType: 'text/csv', sizeBytes: 1, sha256: 'd'.repeat(64), uploadedByUserId: team.admin.user.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: team.admin.user.id, checksum: 'd'.repeat(64), status: 'IMPORTED' } });
    rec = (await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 2, fullName: 'Sharma Ji', mobile: '+919555900001', pincode: '302001', assignedTelecallerUserId: team.telecallerId, assignedAt: new Date() } })).id;
    const bank = await prisma.bank.findUniqueOrThrow({ where: { code: 'AU' } });
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]);
    const up = await api().post('/api/v1/files/benefit_pdf').set(auth(adminToken)).attach('file', pdf, { filename: 'benefits.pdf', contentType: 'application/pdf' }).expect(201);
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: bank.id, name: 'AU LIT', benefitPdfFileId: up.body.data.id }).expect(201);
    cardId = c.body.data.id;
    await api().post(`/api/v1/catalogue/cards/${cardId}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', url: LINK }).expect(201);
    await api().post(`/api/v1/catalogue/cards/${cardId}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
  });
  afterAll(async () => app.close());

  it('ID card: rendered on demand, contains only allowed fields (no mobile/PAN/customer data), verifies publicly', async () => {
    const me = await api().get('/api/v1/id-cards/me').set(auth(tcToken)).expect(200);
    expect(me.body.data).toMatchObject({ status: 'ACTIVE', version: 1 });
    const svg = me.body.data.svg as string;
    expect(svg).toContain('Telecaller 50001');
    expect(svg).toContain(team.telecallerId ? 'KBS-TC-' : '');
    expect(svg).toContain(`/verify/${publicRef}`);
    expect(svg).not.toContain('9776550001'); // telecaller mobile never on the card
    expect(svg).not.toMatch(/[A-Z]{5}[0-9]{4}[A-Z]/); // no PAN-shaped strings
    expect(svg).not.toContain('Sharma'); // no customer data
    const raw = await api().get('/api/v1/id-cards/me.svg').set(auth(tcToken)).expect(200);
    expect(raw.headers['content-type']).toContain('image/svg+xml');
    const v = await api().get(`/api/v1/verify/${publicRef}`).expect(200);
    expect(v.body.data).toMatchObject({ valid: true, fullName: 'Telecaller 50001', role: 'Telecaller', version: 1 });
    expect(JSON.stringify(v.body)).not.toContain('9776550001');
    // Manager view is a sensitive access; other Manager 404
    await api().get(`/api/v1/users/${team.telecallerId}/id-card`).set(auth(team.manager.accessToken)).expect(200);
    expect(await prisma.sensitiveAccessLog.count({ where: { field: 'ID_CARD' } })).toBe(1);
    const other = await setupManagerAndTelecaller(app, prisma, '50002');
    await api().get(`/api/v1/users/${team.telecallerId}/id-card`).set(auth(other.manager.accessToken)).expect(404);
    await api().get('/api/v1/verify/KBS-U-NOPE').expect(200).then((r) => expect(r.body.data).toEqual({ valid: false, reason: 'NOT_FOUND' }));
  });

  it('WA-01/WA-02: three distinct share kinds; link verbatim; hand-off never shows Delivered; interest created on link share', async () => {
    // application link
    const link = await api().post('/api/v1/share').set(auth(tcToken)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: rec, kind: 'APPLICATION_LINK', cardId }).expect(201);
    expect(link.body.data).toMatchObject({ kind: 'APPLICATION_LINK', channel: 'WHATSAPP_HANDOFF', handoffResult: 'OPENED', deliveryStatus: 'UNKNOWN', linkVersion: 1, consentPolicyConfigured: false });
    expect(link.body.data.message).toContain(LINK);
    expect(decodeURIComponent(link.body.data.handoffUrl)).toContain(LINK);
    expect(link.body.data.handoffUrl).toMatch(/^https:\/\/wa\.me\/919555900001\?text=/);
    expect(shareStatusLabel(link.body.data)).toBe('Share sheet opened');
    expect(link.body.data.callingInterestId).toBeTruthy();
    const interest = await prisma.callingInterest.findUniqueOrThrow({ where: { id: link.body.data.callingInterestId } });
    expect(interest).toMatchObject({ callingRecordId: rec, cardId });
    expect(interest.applicationLinkId).toBeTruthy();
    const sa = await prisma.shareAction.findUniqueOrThrow({ where: { id: link.body.data.shareActionId } });
    expect(sa).toMatchObject({ kind: 'APPLICATION_LINK', cardId, callingRecordId: rec, targetMobileMasked: '+91••••••0001', deliveryStatus: 'UNKNOWN' });
    expect(sa.assetVersionRef).toMatch(/^link:.*:v1$/);
    expect((await prisma.callingRecord.findUniqueOrThrow({ where: { id: rec } })).interactionStatus).toBe('LINK_SHARED');

    // benefit PDF → redirect link, which resolves to a presigned URL and logs the open
    const pdf = await api().post('/api/v1/share').set(auth(tcToken)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: rec, kind: 'BENEFIT_PDF', cardId }).expect(201);
    expect(pdf.body.data.message).toMatch(/\/api\/v1\/r\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    const token = (pdf.body.data.message as string).match(/\/api\/v1\/r\/([^\s]+)/)?.[1] as string;
    const redirect = await api().get(`/api/v1/r/${token}`).expect(302);
    expect(redirect.headers.location).toBeTruthy();
    await api().get(`/api/v1/r/${token}x`).expect(404); // tampered signature
    expect(await prisma.auditLog.count({ where: { action: 'share.redirectOpened', entityId: pdf.body.data.shareActionId } })).toBe(1);

    // official ID
    const id = await api().post('/api/v1/share').set(auth(tcToken)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: rec, kind: 'OFFICE_ID' }).expect(201);
    expect(id.body.data.message).toContain('official KBS Solutions ID');
    expect((await prisma.shareAction.findUniqueOrThrow({ where: { id: id.body.data.shareActionId } })).assetVersionRef).toMatch(/^idcard:.*:v1$/);

    const list = await api().get(`/api/v1/calling/records/${rec}/shares`).set(auth(team.manager.accessToken)).expect(200);
    expect(list.body.data.map((s: { kind: string }) => s.kind).sort()).toEqual(['APPLICATION_LINK', 'BENEFIT_PDF', 'OFFICE_ID']);
    expect(list.body.data.every((s: { deliveryStatus: string }) => s.deliveryStatus === 'UNKNOWN')).toBe(true);
    // delivery webhook never touches hand-off rows
    await api().post('/api/v1/webhooks/whatsapp/delivery').send({ providerMessageId: 'x', status: 'DELIVERED' }).expect(201);
    expect(await prisma.shareAction.count({ where: { deliveryStatus: 'DELIVERED' } })).toBe(0);
    // suppressed customer / another Telecaller's record refused
    const other = await setupManagerAndTelecaller(app, prisma, '50003');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: other.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    const ot = await loginAs(app, prisma, other.telecallerMobile);
    await api().post('/api/v1/share').set(auth(ot.accessToken)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: rec, kind: 'OFFICE_ID' }).expect(404);
  });

  it('deactivation revokes the ID (verify → revoked; share refused); reactivation issues v2', async () => {
    await api().post(`/api/v1/users/${team.telecallerId}/deactivate`).set(auth(team.manager.accessToken)).set('idempotency-key', idem()).send({ reason: 'left the company' }).expect(201);
    const v = await api().get(`/api/v1/verify/${publicRef}`).expect(200);
    expect(v.body.data).toMatchObject({ valid: false, reason: 'REVOKED', fullName: 'Telecaller 50001' });
    await api().post(`/api/v1/users/${team.telecallerId}/reactivate`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'rehired' }).expect(201);
    const v2 = await api().get(`/api/v1/verify/${publicRef}`).expect(200);
    expect(v2.body.data).toMatchObject({ valid: true, version: 2 });
    expect(await prisma.officialIdCard.count({ where: { userId: team.telecallerId } })).toBe(2);
  });
});
