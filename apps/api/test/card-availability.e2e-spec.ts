import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EMPTY = 'No card available for this pincode from current uploaded data';

describe('F-308 card availability (sourceability ∩ publication ∩ link)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let rblId: string;
  let hsbcId: string;
  let cardA: string;

  async function sheet(name: string, headers: string[], rows: string[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const up = await api().post('/api/v1/files/bank_pincode').set(auth(adminToken)).attach('file', buf, { filename: `${name}.xlsx`, contentType: XLSX }).expect(201);
    return up.body.data.id as string;
  }
  async function importAndApprove(bankCode: string, fileId: string) {
    const p = await prisma.bankPincodeProfile.findFirstOrThrow({ where: { bank: { code: bankCode }, status: 'DRAFT' } });
    const b = await api().post(`/api/v1/pincode-profiles/${p.id}/batches`).set(auth(adminToken)).set('idempotency-key', idem()).send({ fileId }).expect(201);
    await api().post(`/api/v1/pincode-batches/${b.body.data.id}/confirm`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
    await api().post(`/api/v1/pincode-profiles/${p.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).expect(201);
  }
  async function card(bankId: string, name: string, opts: { publish?: boolean; link?: boolean; publication?: { scope: 'GLOBAL' | 'STATE' | 'PINCODE'; pincode?: string; state?: string; channel?: string } }) {
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, name, benefits: ['2x points'], categoryKeys: ['TRAVEL'] }).expect(201);
    const id = c.body.data.id as string;
    if (opts.link) await api().post(`/api/v1/catalogue/cards/${id}/links`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', url: `https://apply.example.com/${name.replace(/\s/g, '')}?utm_source=KBS#top` }).expect(201);
    if (opts.publish) await api().post(`/api/v1/catalogue/cards/${id}/publish`).set(auth(adminToken)).set('idempotency-key', idem()).send({}).expect(201);
    if (opts.publication) await api().post(`/api/v1/catalogue/cards/${id}/publications`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: opts.publication.channel ?? 'BOTH', ...opts.publication }).expect(201);
    return id;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    rblId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'RBL' } })).id;
    hsbcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HSBC' } })).id;
    await prisma.pincodeMaster.createMany({ data: [{ pincode: '302001', officeName: 'Jaipur GPO', district: 'Jaipur', state: 'Rajasthan' }, { pincode: '302002', officeName: 'Jaipur City', district: 'Jaipur', state: 'Rajasthan' }], skipDuplicates: true });
    const rblHeaders = ['Pincode', 'City', 'City Code', 'City_Unique_Code', 'State', 'State Code', 'State_Unique_Code', 'Region Code', 'Country: Country Name', 'Sourceable', 'Is Online City'];
    const rblFile = await sheet('rbl bank', rblHeaders, [
      ['302001', 'Jaipur', 'J', 'J1', 'Rajasthan', 'RJ', 'R1', 'N', 'India', 'Y', 'Y'],
      ['302002', 'Jaipur', 'J', 'J1', 'Rajasthan', 'RJ', 'R1', 'N', 'India', 'Y', 'N'],
      ['110001', 'Delhi', 'D', 'D1', 'Delhi', 'DL', 'D2', 'N', 'India', 'N', 'Y'],
      ['400001', 'Mumbai', 'M', 'M1', 'Maharashtra', 'MH', 'M2', 'W', 'India', '', 'Y'],
    ]);
    await importAndApprove('RBL', rblFile);
    const hsbcFile = await sheet('HSBC BANK', ['CARDDELIVERYFLAG', 'CITY', 'COUNTRY', 'DISTRICT', 'FLAG', 'PINCODE', 'PINCODEFLAG', 'STATE', 'STATUS', 'STDCODE'], [['Y', 'Jaipur', 'IN', 'Jaipur', 'A', '302001', 'Y', 'RJ', 'ACTIVE', '0141']]);
    await importAndApprove('HSBC', hsbcFile);

    cardA = await card(rblId, 'RBL Platinum', { publish: true, link: true, publication: { scope: 'GLOBAL' } });
    await card(rblId, 'RBL NoLink', { publish: true, link: false, publication: { scope: 'GLOBAL' } });
    await card(rblId, 'RBL Draft', { publish: false, link: true, publication: { scope: 'GLOBAL' } });
    await card(rblId, 'RBL Rajasthan Only', { publish: true, link: true, publication: { scope: 'STATE', state: 'Rajasthan' } });
    await card(rblId, 'RBL Advisor Only', { publish: true, link: true, publication: { scope: 'GLOBAL', channel: 'ADVISOR' } });
    await card(hsbcId, 'HSBC Ambiguous', { publish: true, link: true, publication: { scope: 'GLOBAL' } });
  });
  afterAll(async () => app.close());

  it('PIN-02/03: sourceable+published+linked shown; unpublished, unlinked, ambiguous-flag and other-channel hidden; state publications resolve via pincode master', async () => {
    const r = await api().get('/api/v1/cards/available?pincode=302001&channel=TELECALLER').set(auth(adminToken)).expect(200);
    expect(r.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['RBL Platinum', 'RBL Rajasthan Only']);
    expect(r.body.data.message).toBeNull();
    const a = r.body.data.cards[0];
    expect(a.link).toMatchObject({ version: 1, channel: 'BOTH' });
    expect(a.provenance).toMatchObject({ sourceability: 'SOURCEABLE', publication: { scope: 'GLOBAL' }, rawFlags: { Sourceable: 'Y', 'Is Online City': 'Y' } });
    expect(a.provenance.batchUploadedAt).toBeTruthy();
    expect(r.body.data.cards[1].provenance.publication.scope).toBe('STATE');
    // ADVISOR channel sees the advisor-only card too
    const adv = await api().get('/api/v1/cards/available?pincode=302001&channel=ADVISOR').set(auth(adminToken)).expect(200);
    expect(adv.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['RBL Advisor Only', 'RBL Platinum', 'RBL Rajasthan Only']);
  });

  it('NOT_SOURCEABLE, ambiguous and unknown pincodes → exact empty message (never "ineligible")', async () => {
    for (const pin of ['110001', '400001', '999999']) {
      const r = await api().get(`/api/v1/cards/available?pincode=${pin}&channel=TELECALLER`).set(auth(adminToken)).expect(200);
      expect(r.body.data).toMatchObject({ cards: [], message: EMPTY });
      expect(JSON.stringify(r.body).toLowerCase()).not.toContain('ineligible');
    }
    // ending the only publication hides the card again
    const pubs = await api().get(`/api/v1/catalogue/cards/${cardA}/publications`).set(auth(adminToken)).expect(200);
    await api().post(`/api/v1/catalogue/publications/${pubs.body.data[0].id}/end`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'campaign paused' }).expect(201);
    const r = await api().get('/api/v1/cards/available?pincode=302001&channel=TELECALLER').set(auth(adminToken)).expect(200);
    expect(r.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['RBL Rajasthan Only']);
    // pincode-scoped publication for another pincode does not leak
    await api().post(`/api/v1/catalogue/cards/${cardA}/publications`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', scope: 'PINCODE', pincode: '302002' }).expect(201);
    const r2 = await api().get('/api/v1/cards/available?pincode=302001&channel=TELECALLER').set(auth(adminToken)).expect(200);
    expect(r2.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['RBL Rajasthan Only']);
    const r3 = await api().get('/api/v1/cards/available?pincode=302002&channel=TELECALLER').set(auth(adminToken)).expect(200);
    expect(r3.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['RBL Platinum', 'RBL Rajasthan Only']);
    expect(r3.body.data.cards[0].provenance.publication.scope).toBe('PINCODE');
  });

  it('record-scoped lookup: Telecaller gets cards for an assigned record only', async () => {
    const s = await setupManagerAndTelecaller(app, prisma, '30001');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: s.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: 't/c.csv', originalName: 'c.csv', contentType: 'text/csv', sizeBytes: 1, sha256: 'a'.repeat(64), uploadedByUserId: s.admin.user.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: s.admin.user.id, checksum: 'a'.repeat(64), status: 'IMPORTED' } });
    const mine = await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 2, fullName: 'Mine', mobile: '+919555700001', pincode: '302002', assignedTelecallerUserId: s.telecallerId, assignedAt: new Date() } });
    const other = await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 3, fullName: 'Other', mobile: '+919555700002', pincode: '302002' } });
    const t = await loginAs(app, prisma, s.telecallerMobile);
    const r = await api().get(`/api/v1/calling/records/${mine.id}/cards`).set(auth(t.accessToken)).expect(200);
    expect(r.body.data.cards).toHaveLength(2);
    expect(r.body.data.location).toMatchObject({ state: 'Rajasthan' });
    await api().get(`/api/v1/calling/records/${other.id}/cards`).set(auth(t.accessToken)).expect(404);
    // generic route is not for Telecallers' customers but still permitted for catalogue reads; training gate applies
    await api().get('/api/v1/cards/available?pincode=302002&channel=TELECALLER').set(auth(t.accessToken)).expect(200);
  });

  it('F-405 browse: PUBLISHED + ADVISOR link, category/text filters, pincode annotation (true/false/unknown), Advisor gate', async () => {
    const all = await api().get('/api/v1/cards/browse').set(auth(adminToken)).expect(200);
    const names = all.body.data.cards.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(['RBL Platinum', 'RBL Advisor Only', 'RBL Rajasthan Only', 'HSBC Ambiguous']));
    expect(names).not.toContain('RBL NoLink');
    expect(names).not.toContain('RBL Draft');
    expect(all.body.data.cards[0].sourceableAtPincode).toBeNull();
    const travel = await api().get('/api/v1/cards/browse?category=TRAVEL&q=advisor').set(auth(adminToken)).expect(200);
    expect(travel.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['RBL Advisor Only']);
    const pin = await api().get('/api/v1/cards/browse?pincode=110001').set(auth(adminToken)).expect(200);
    const byName = Object.fromEntries(pin.body.data.cards.map((c: { name: string; sourceableAtPincode: unknown }) => [c.name, c.sourceableAtPincode]));
    expect(byName['RBL Platinum']).toBe(false); // RBL says N for 110001
    expect(byName['HSBC Ambiguous']).toBe(false); // HSBC has no row for 110001 → not sourceable
    const pin2 = await api().get('/api/v1/cards/browse?pincode=302001').set(auth(adminToken)).expect(200);
    const byName2 = Object.fromEntries(pin2.body.data.cards.map((c: { name: string; sourceableAtPincode: unknown; sourceabilityProvenance: { sourceability: string } | null }) => [c.name, c]));
    expect(byName2['RBL Platinum'].sourceableAtPincode).toBe(true);
    expect(byName2['HSBC Ambiguous']).toMatchObject({ sourceableAtPincode: false, sourceabilityProvenance: { sourceability: 'REQUIRES_BANK_MAPPING' } });
    // a bank with no approved import → 'unknown'
    const au = await prisma.bank.findUniqueOrThrow({ where: { code: 'AU' } });
    await card(au.id, 'AU Unknown', { publish: true, link: true });
    const pin3 = await api().get('/api/v1/cards/browse?pincode=302001&q=AU%20Unknown').set(auth(adminToken)).expect(200);
    expect(pin3.body.data.cards[0].sourceableAtPincode).toBe('unknown');
    // an Advisor still onboarding is gated
    const req = await api().post('/api/v1/auth/otp/request').send({ mobile: '9333301111', purpose: 'ADVISOR_SIGNUP' }).expect(201);
    const v = await api().post('/api/v1/auth/otp/verify').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201);
    const g = await api().get('/api/v1/cards/browse').set(auth(v.body.data.accessToken)).expect(403);
    expect(g.body.error.code).toBe('GATE_ONBOARDING_INCOMPLETE');
  });

  it('no Advisor/Telecaller-facing copy promises approval (snapshot of shared strings + mobile screens)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const roots = [join(__dirname, '..', '..', 'mobile', 'app'), join(__dirname, '..', '..', 'mobile', 'components'), join(__dirname, '..', '..', '..', 'packages', 'shared', 'src')];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|ts)$/.test(f)) files.push(p);
      }
    };
    roots.forEach(walk);
    const offenders = files.filter((f) => {
      const t = readFileSync(f, 'utf8').replace(/forbiddenPhrases[^\n]*/g, '');
      return /guaranteed approval|instant approval|assured approval|eligible for sure|approval guaranteed/i.test(t);
    });
    expect(offenders).toEqual([]);
  });
});
