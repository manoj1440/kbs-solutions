import { createHash, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { DATA_PURGE_JOB, DataPurgeService } from '../src/modules/maintenance/data-purge.service';
import { MaintenanceProcessor } from '../src/modules/maintenance/maintenance.processor';

import { bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const DAY = 24 * 60 * 60_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const hash = () => createHash('sha256').update(randomUUID()).digest('hex');

describe('F-908 D7 nightly purge of expired operational records', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let svc: DataPurgeService;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    svc = app.get(DataPurgeService);
  });
  afterAll(async () => app.close());

  it('deletes only expired OTPs, drafts, idempotency records and ended sessions; keeps everything live', async () => {
    const team = await setupManagerAndTelecaller(app, prisma, '95001');
    const userId = team.telecallerId;
    // a real, live session through the OTP flow
    const live = await loginAs(app, prisma, team.telecallerMobile);

    // OTP challenges
    const otpOld = await prisma.otpChallenge.create({ data: { mobile: '+919555695001', purpose: 'LOGIN', codeHash: hash(), expiresAt: ago(2) } });
    const otpRecent = await prisma.otpChallenge.create({ data: { mobile: '+919555695001', purpose: 'LOGIN', codeHash: hash(), expiresAt: ago(0.5) } });
    // lead drafts (hold encrypted customer PAN)
    const card = { id: randomUUID() }; // LeadDraft.cardId is a plain reference
    const draftOld = await prisma.leadDraft.create({ data: { advisorUserId: userId, cardId: card.id, step: 'PAN', data: { panEncrypted: 'x' }, expiresAt: ago(1) } });
    const draftLive = await prisma.leadDraft.create({ data: { advisorUserId: userId, cardId: card.id, step: 'PAN', data: {}, expiresAt: new Date(Date.now() + DAY) } });
    // idempotency records
    const idemOld = await prisma.idempotencyRecord.create({ data: { userId, key: randomUUID(), route: 'POST /x', responseStatus: 201, responseBody: {}, createdAt: ago(8) } });
    const idemRecent = await prisma.idempotencyRecord.create({ data: { userId, key: randomUUID(), route: 'POST /x', responseStatus: 201, responseBody: {}, createdAt: ago(1) } });
    // sessions: revoked long ago, revoked recently, and one never revoked whose tokens all expired long ago
    const session = (data: { createdAt: Date; revokedAt?: Date; tokenExpiresAt: Date }) =>
      prisma.session.create({
        data: { userId, platform: 'ANDROID', createdAt: data.createdAt, revokedAt: data.revokedAt, refreshTokens: { create: { tokenHash: hash(), familyId: randomUUID(), expiresAt: data.tokenExpiresAt } } },
      });
    const revokedOld = await session({ createdAt: ago(90), revokedAt: ago(40), tokenExpiresAt: ago(35) });
    const revokedRecent = await session({ createdAt: ago(20), revokedAt: ago(5), tokenExpiresAt: ago(1) });
    const abandoned = await session({ createdAt: ago(100), tokenExpiresAt: ago(60) });
    // business data that must never be touched
    const auditBefore = await prisma.auditLog.count();

    const res = (await app.get(MaintenanceProcessor).runMaintenance(DATA_PURGE_JOB)) as Awaited<ReturnType<DataPurgeService['run']>>;
    expect(res).toMatchObject({ otpChallenges: 1, leadDrafts: 1, idempotencyRecords: 1, sessions: 2 });
    expect(res.refreshTokens).toBeGreaterThanOrEqual(2);

    const exists = async (p: Promise<unknown>) => Boolean(await p);
    expect(await exists(prisma.otpChallenge.findUnique({ where: { id: otpOld.id } }))).toBe(false);
    expect(await exists(prisma.otpChallenge.findUnique({ where: { id: otpRecent.id } }))).toBe(true);
    expect(await exists(prisma.leadDraft.findUnique({ where: { id: draftOld.id } }))).toBe(false);
    expect(await exists(prisma.leadDraft.findUnique({ where: { id: draftLive.id } }))).toBe(true);
    expect(await exists(prisma.idempotencyRecord.findUnique({ where: { id: idemOld.id } }))).toBe(false);
    expect(await exists(prisma.idempotencyRecord.findUnique({ where: { id: idemRecent.id } }))).toBe(true);
    expect(await exists(prisma.session.findUnique({ where: { id: revokedOld.id } }))).toBe(false);
    expect(await exists(prisma.session.findUnique({ where: { id: abandoned.id } }))).toBe(false);
    expect(await exists(prisma.session.findUnique({ where: { id: revokedRecent.id } }))).toBe(true);
    expect(await prisma.refreshToken.count({ where: { sessionId: { in: [revokedOld.id, abandoned.id] } } })).toBe(0);
    // the live session still refreshes
    expect(await prisma.session.count({ where: { userId, revokedAt: null } })).toBeGreaterThan(0);
    expect(live.refreshToken).toBeTruthy();

    // one audit row with counts only; nothing else in the audit log changed
    const rows = await prisma.auditLog.findMany({ where: { action: 'maintenance.purge' } });
    expect(rows).toHaveLength(1);
    expect(await prisma.auditLog.count()).toBe(auditBefore + 1);

    // idempotent: a second run finds nothing and writes no audit row
    expect(await svc.run()).toEqual({ otpChallenges: 0, leadDrafts: 0, idempotencyRecords: 0, refreshTokens: 0, sessions: 0 });
    expect(await prisma.auditLog.count({ where: { action: 'maintenance.purge' } })).toBe(1);
  });
});
