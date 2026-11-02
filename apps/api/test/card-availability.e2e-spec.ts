import { makePublicRef, RefPrefix, shareCodeOf } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const EMPTY = 'No card available for this pincode from current uploaded data';
const AU_LINK = 'https://cconboarding.au.bank.in/auccself/#/?utm_source=KBS&agent={code}';

/**
 * Catalogue rewrite: a card is offered where its own availability says (all India, a pincode list, or a legacy state
 * publication) ∩ PUBLISHED (active) ∩ an effective link for the channel. Bank coverage sheets no longer gate it.
 */
describe('F-308 card availability (card availability ∩ active ∩ link)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());
  let rblId: string;
  let auId: string;
  let platinum: string;
  let jaipur: string;

  /** One-form create, as the catalogue modal sends it. */
  async function card(bankId: string, name: string, extra: Record<string, unknown>) {
    const c = await api().post('/api/v1/catalogue/cards').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId, name, benefits: ['2x points'], categoryKeys: ['TRAVEL'], ...extra }).expect(201);
    return c.body.data as { id: string; status: string; applyUrl: string | null; availability: { allIndia: boolean; pincodeCount: number }; pincodes: string[] };
  }
  const names = (r: request.Response) => r.body.data.cards.map((c: { name: string }) => c.name);

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().put('/api/v1/config/network.enforceForTelecallers').set(auth(adminToken)).send({ value: false, reason: 'test' }).expect(200);
    rblId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'RBL' } })).id;
    auId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'AU' } })).id;
    await prisma.pincodeMaster.createMany({ data: [{ pincode: '302001', officeName: 'Jaipur GPO', district: 'Jaipur', state: 'Rajasthan' }, { pincode: '302002', officeName: 'Jaipur City', district: 'Jaipur', state: 'Rajasthan' }], skipDuplicates: true });

    const p = await card(rblId, 'RBL Platinum', { applyUrl: 'https://apply.example.com/RBLPlatinum?utm_source=KBS#top', availability: 'ALL_INDIA', active: true });
    platinum = p.id;
    expect(p).toMatchObject({ status: 'PUBLISHED', availability: { allIndia: true, pincodeCount: 0 }, pincodes: [] });
    const j = await card(auId, 'AU Jaipur', { applyUrl: AU_LINK, availability: ['302001', '302001', '302003'], active: true });
    jaipur = j.id;
    expect(j).toMatchObject({ applyUrl: AU_LINK, availability: { allIndia: false, pincodeCount: 2 }, pincodes: ['302001', '302003'] }); // duplicates collapse
    await card(rblId, 'RBL Draft', { applyUrl: 'https://apply.example.com/draft', availability: 'ALL_INDIA', active: false });
    // legacy paths still honoured: no link → hidden; state publication; advisor-only channel
    const noLink = await card(rblId, 'RBL NoLink', { availability: 'ALL_INDIA', active: true });
    expect(noLink.applyUrl).toBeNull();
    const state = await card(rblId, 'RBL Rajasthan Only', { applyUrl: 'https://apply.example.com/raj', active: true });
    await api().post(`/api/v1/catalogue/cards/${state.id}/publications`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'BOTH', scope: 'STATE', state: 'Rajasthan' }).expect(201);
    const adv = await card(rblId, 'RBL Advisor Only', { applyUrl: 'https://apply.example.com/adv', active: true });
    await api().post(`/api/v1/catalogue/cards/${adv.id}/publications`).set(auth(adminToken)).set('idempotency-key', idem()).send({ channel: 'ADVISOR', scope: 'GLOBAL' }).expect(201);
  });
  afterAll(async () => app.close());

  it('the card\'s own pincodes decide: all-India everywhere, pincode list only there, state via pincode master; inactive / unlinked / other-channel hidden', async () => {
    const r = await api().get('/api/v1/cards/available?pincode=302001&channel=TELECALLER').set(auth(adminToken)).expect(200);
    expect(names(r)).toEqual(['AU Jaipur', 'RBL Platinum', 'RBL Rajasthan Only']);
    expect(r.body.data.message).toBeNull();
    expect(r.body.data.cards[0].provenance).toEqual({ publication: { scope: 'PINCODE', id: expect.any(String) } });
    expect(r.body.data.cards[1].provenance.publication.scope).toBe('GLOBAL');
    expect(r.body.data.cards[2].provenance.publication.scope).toBe('STATE');
    const adv = await api().get('/api/v1/cards/available?pincode=302001&channel=ADVISOR').set(auth(adminToken)).expect(200);
    expect(names(adv)).toEqual(['AU Jaipur', 'RBL Advisor Only', 'RBL Platinum', 'RBL Rajasthan Only']);
    // no bank coverage upload exists at all, and an unknown pincode still gets the all-India card
    expect(await prisma.bankPincodeRow.count()).toBe(0);
    expect(names(await api().get('/api/v1/cards/available?pincode=110001&channel=TELECALLER').set(auth(adminToken)).expect(200))).toEqual(['RBL Platinum']);
  });

  it('editing replaces the pincode list; making a card inactive hides it → exact empty message (never "ineligible")', async () => {
    const e = await api().patch(`/api/v1/catalogue/cards/${jaipur}`).set(auth(adminToken)).send({ availability: ['302002'] }).expect(200);
    expect(e.body.data).toMatchObject({ availability: { allIndia: false, pincodeCount: 1 }, pincodes: ['302002'] });
    expect(names(await api().get('/api/v1/cards/available?pincode=302001&channel=TELECALLER').set(auth(adminToken)).expect(200))).not.toContain('AU Jaipur');
    expect(names(await api().get('/api/v1/cards/available?pincode=302002&channel=TELECALLER').set(auth(adminToken)).expect(200))).toContain('AU Jaipur');
    await api().patch(`/api/v1/catalogue/cards/${platinum}`).set(auth(adminToken)).send({ active: false }).expect(200);
    const r = await api().get('/api/v1/cards/available?pincode=110001&channel=TELECALLER').set(auth(adminToken)).expect(200);
    expect(r.body.data).toMatchObject({ cards: [], message: EMPTY });
    expect(JSON.stringify(r.body).toLowerCase()).not.toContain('ineligible');
    // re-activating publishes it again (version bump), list view shows it paginated with its availability
    await api().patch(`/api/v1/catalogue/cards/${platinum}`).set(auth(adminToken)).send({ active: true }).expect(200);
    const list = await api().get('/api/v1/catalogue/cards?pageSize=2&page=1&q=RBL').set(auth(adminToken)).expect(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 5 });
  });

  it('record-scoped lookup / CALL-03: Telecaller gets cards for an assigned record only, with benefits, PDF, link, ID and remarks reachable in the call context', async () => {
    const s = await setupManagerAndTelecaller(app, prisma, '30001');
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: s.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: 't/c.csv', originalName: 'c.csv', contentType: 'text/csv', sizeBytes: 1, sha256: 'a'.repeat(64), uploadedByUserId: s.admin.user.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: s.admin.user.id, checksum: 'a'.repeat(64), status: 'IMPORTED' } });
    const mine = await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 2, fullName: 'Mine', mobile: '+919555700001', pincode: '302002', assignedTelecallerUserId: s.telecallerId, assignedAt: new Date() } });
    const other = await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: 3, fullName: 'Other', mobile: '+919555700002', pincode: '302002' } });
    const t = await loginAs(app, prisma, s.telecallerMobile);
    const r = await api().get(`/api/v1/calling/records/${mine.id}/cards`).set(auth(t.accessToken)).expect(200);
    expect(r.body.data.cards.map((c: { name: string }) => c.name)).toEqual(['AU Jaipur', 'RBL Platinum', 'RBL Rajasthan Only']);
    expect(r.body.data.location).toMatchObject({ state: 'Rajasthan' });
    // CALL-03: everything the call needs is reachable from the record without leaving the calling context
    for (const c of r.body.data.cards) {
      expect(Array.isArray(c.benefits)).toBe(true);
      expect(c).toHaveProperty('benefitPdfFileId');
      expect(c.link).toMatchObject({ id: expect.any(String), version: expect.any(Number) });
    }
    // the shared apply link carries the sharer's own code in place of {code}; links without {code} stay verbatim
    const share = await api().post('/api/v1/share').set(auth(t.accessToken)).set('idempotency-key', idem()).send({ targetType: 'CALLING_RECORD', targetId: mine.id, kind: 'APPLICATION_LINK', cardId: jaipur }).expect(201);
    const code = shareCodeOf((await prisma.user.findUniqueOrThrow({ where: { id: s.telecallerId } })).publicRef);
    expect(decodeURIComponent(share.body.data.handoffUrl)).toContain(AU_LINK.replace('{code}', code));
    expect(code).toMatch(/^[0-9A-Z]{6,}$/);
    const rec = await api().get(`/api/v1/calling/records/${mine.id}`).set(auth(t.accessToken)).expect(200);
    expect(rec.body.data).toHaveProperty('outcomes'); // remarks live on outcomes
    await api().get(`/api/v1/calling/records/${mine.id}/shares`).set(auth(t.accessToken)).expect(200);
    await api().get('/api/v1/id-cards/me').set(auth(t.accessToken)).expect(200);
    await api().get(`/api/v1/calling/records/${other.id}/cards`).set(auth(t.accessToken)).expect(404);
    // generic route is not for Telecallers' customers but still permitted for catalogue reads; training gate applies
    await api().get('/api/v1/cards/available?pincode=302002&channel=TELECALLER').set(auth(t.accessToken)).expect(200);
  });

  it('F-405 browse: PUBLISHED + ADVISOR link, filters; with a pincode only the cards available there', async () => {
    const all = await api().get('/api/v1/cards/browse').set(auth(adminToken)).expect(200);
    expect(names(all)).toEqual(expect.arrayContaining(['RBL Platinum', 'RBL Advisor Only', 'RBL Rajasthan Only', 'AU Jaipur']));
    expect(names(all)).not.toContain('RBL NoLink');
    expect(names(all)).not.toContain('RBL Draft');
    expect(all.body.data.cards[0].sourceableAtPincode).toBeNull();
    const travel = await api().get('/api/v1/cards/browse?category=TRAVEL&q=advisor').set(auth(adminToken)).expect(200);
    expect(names(travel)).toEqual(['RBL Advisor Only']);
    const far = await api().get('/api/v1/cards/browse?pincode=110001').set(auth(adminToken)).expect(200);
    expect(names(far).sort()).toEqual(['RBL Advisor Only', 'RBL Platinum']);
    const near = await api().get('/api/v1/cards/browse?pincode=302002').set(auth(adminToken)).expect(200);
    expect(names(near).sort()).toEqual(['AU Jaipur', 'RBL Advisor Only', 'RBL Platinum', 'RBL Rajasthan Only']);
    expect(near.body.data.cards.every((c: { sourceableAtPincode: unknown }) => c.sourceableAtPincode === true)).toBe(true);
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
