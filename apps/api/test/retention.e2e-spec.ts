import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { MemoryStorageAdapter } from '../src/providers/adapters/memory-storage.adapter';
import { MaintenanceProcessor } from '../src/modules/maintenance/maintenance.processor';
import { STORAGE_PROVIDER } from '../src/providers/ports';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';

const PNG = (tail: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]), Buffer.from(tail)]);
const OLD = new Date(Date.now() - 400 * 86_400_000);

describe('F-904 data retention & legal hold — fail closed while durations are OPEN (REQ-21 §21.5, INV-07)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let accounts: string;
  let storage: MemoryStorageAdapter;
  const api = () => request(app.getHttpServer());
  const setCfg = (key: string, value: unknown) => api().put(`/api/v1/config/${key}`).set(auth(admin)).send({ value, reason: 'F-904 test setup' }).expect(200);
  const run = (category: string, expectStatus: number) => api().post('/api/v1/retention/execute').set(auth(admin)).set('idempotency-key', idem()).send({ category, reason: 'KBS retention policy v-test' }).expect(expectStatus);
  const upload = async (purpose: string, tail: string, token = accounts) => {
    const r = await api().post(`/api/v1/files/${purpose}`).set(auth(token)).attach('file', PNG(tail), { filename: `${tail}.png`, contentType: 'image/png' }).expect(201);
    await prisma.storedFile.update({ where: { id: r.body.data.id }, data: { createdAt: OLD } });
    return prisma.storedFile.findUniqueOrThrow({ where: { id: r.body.data.id } });
  };

  let linkedProof: string;
  let freeProof: string;
  let heldProof: string;
  let oldRec: string;
  let heldRec: string;
  let activeRec: string;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().post('/api/v1/users').set(auth(admin)).set('idempotency-key', idem()).send({ role: 'ACCOUNTS', fullName: 'Acc Retention', mobile: '9666600049' }).expect(201);
    accounts = (await loginAs(app, prisma, '9666600049')).accessToken;
    storage = app.get(STORAGE_PROVIDER);
    expect(storage).toBeInstanceOf(MemoryStorageAdapter);

    freeProof = (await upload('payment_proof', 'free')).id;
    heldProof = (await upload('payment_proof', 'held')).id;
    // a cheque an Advisor profile still points at is live bank evidence: protected even when old
    linkedProof = (await upload('cheque', 'linked', admin)).id;
    const adv = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    await prisma.advisorProfile.create({ data: { userId: adv.id, chequeFileId: linkedProof } });

    const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: freeProof } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: adv.id, checksum: 'r'.repeat(64), status: 'IMPORTED' } });
    const mk = async (n: number, extra: object = {}) =>
      (await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: n, fullName: `Retain ${n}`, mobile: `+91955590000${n}`, panLast4: '1234', pincode: '302001', ...extra } })).id;
    oldRec = await mk(1, { hiddenAt: OLD, hiddenReason: 'closed' });
    heldRec = await mk(2, { hiddenAt: OLD, hiddenReason: 'closed' });
    activeRec = await mk(3, { assignedTelecallerUserId: adv.id, assignedAt: OLD });
    await prisma.$executeRawUnsafe(`UPDATE "CallingRecord" SET "updatedAt" = $1 WHERE "batchId" = $2`, OLD, batch.id);
  });
  afterAll(async () => app.close());

  it('F-904: plan is a dry run; with durations unset every category reports "not configured" and nothing is runnable', async () => {
    const r = await api().get('/api/v1/retention/plan').set(auth(admin)).expect(200);
    expect(r.body.data.executionEnabled).toBe(false);
    expect(r.body.data.categories).toHaveLength(4);
    for (const c of r.body.data.categories) expect(c).toMatchObject({ configured: false, eligible: null, runnable: false });
    await api().get('/api/v1/retention/plan').set(auth(accounts)).expect(403);
  });

  it('F-904: execute fails closed with CONFIG_MISSING until days are set AND execution is enabled; nothing changes', async () => {
    expect((await run('DOCUMENTS', 409)).body.error).toMatchObject({ code: 'CONFIG_MISSING', details: { key: 'retention.documentsDays' } });
    await setCfg('retention.documentsDays', 365);
    expect((await run('DOCUMENTS', 409)).body.error).toMatchObject({ code: 'CONFIG_MISSING', details: { key: 'retention.executionEnabled' } });
    await api().post('/api/v1/retention/execute').set(auth(accounts)).set('idempotency-key', idem()).send({ category: 'DOCUMENTS', reason: 'not allowed at all' }).expect(403);
    expect(await prisma.storedFile.count({ where: { purgedAt: { not: null } } })).toBe(0);
  });

  it('F-904: legal hold blocks purge; the plan counts held / protected / eligible separately', async () => {
    await api().post('/api/v1/retention/legal-holds').set(auth(admin)).send({ subject: 'FILE', id: heldProof, hold: true, reason: 'dispute #42' }).expect(201);
    expect(await prisma.auditLog.count({ where: { action: 'legalHold.set', entityId: heldProof } })).toBe(1);
    const plan = (await api().get('/api/v1/retention/plan').set(auth(admin)).expect(200)).body.data;
    const docs = plan.categories.find((c: { category: string }) => c.category === 'DOCUMENTS');
    expect(docs).toMatchObject({ configured: true, days: 365, runnable: false, olderThanCutoff: 3, onHold: 1, protected: 1, eligible: 1 });
    const holds = (await api().get('/api/v1/retention/legal-holds').set(auth(admin)).expect(200)).body.data;
    expect(holds.files.map((f: { id: string }) => f.id)).toContain(heldProof);
  });

  it('F-904: an authorised run purges only eligible files (object deleted, row kept as trace, download → FILE_PURGED)', async () => {
    await setCfg('retention.executionEnabled', true);
    const r = (await run('DOCUMENTS', 201)).body.data;
    expect(r).toMatchObject({ category: 'DOCUMENTS', processed: 1, failed: 0 });
    const purged = await prisma.storedFile.findUniqueOrThrow({ where: { id: freeProof } });
    expect(purged.purgedAt).not.toBeNull();
    expect(storage.has(purged.bucket, purged.key)).toBe(false);
    const held = await prisma.storedFile.findUniqueOrThrow({ where: { id: heldProof } });
    expect(held.purgedAt).toBeNull();
    expect(storage.has(held.bucket, held.key)).toBe(true);
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: linkedProof } })).purgedAt).toBeNull();
    expect((await api().get(`/api/v1/files/${freeProof}/url`).set(auth(admin)).expect(410)).body.error.code).toBe('FILE_PURGED');
    expect(await prisma.auditLog.count({ where: { action: 'retention.purgeFile', entityId: freeProof } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'retention.execute', entityId: 'DOCUMENTS' } })).toBe(1);
    // a purged file cannot be put on hold (the hold would pretend to preserve something that is gone)
    expect((await api().post('/api/v1/retention/legal-holds').set(auth(admin)).send({ subject: 'FILE', id: freeProof, hold: true, reason: 'too late' }).expect(410)).body.error.code).toBe('FILE_PURGED');
    // idempotent: a second run finds nothing new
    expect((await run('DOCUMENTS', 201)).body.data.processed).toBe(0);
  });

  it('F-904 / INV-07: calling records are restricted (PII redacted, hidden), never deleted; held and active records are untouched', async () => {
    await api().post('/api/v1/retention/legal-holds').set(auth(admin)).send({ subject: 'CALLING_RECORD', id: heldRec, hold: true, reason: 'customer complaint' }).expect(201);
    expect((await run('CALLING_RECORDS', 409)).body.error.details.key).toBe('retention.callingRecordsDays');
    await setCfg('retention.callingRecordsDays', 180);
    const before = await prisma.callingRecord.count();
    expect((await run('CALLING_RECORDS', 201)).body.data.processed).toBe(1);
    expect(await prisma.callingRecord.count()).toBe(before); // nothing deleted
    const r = await prisma.callingRecord.findUniqueOrThrow({ where: { id: oldRec } });
    expect(r).toMatchObject({ fullName: 'Restricted (retention)', mobile: 'restricted:0001', panLast4: null, panEncrypted: null });
    expect(r.restrictedAt).not.toBeNull();
    expect(r.hiddenAt).not.toBeNull();
    expect((await prisma.callingRecord.findUniqueOrThrow({ where: { id: heldRec } })).restrictedAt).toBeNull();
    expect((await prisma.callingRecord.findUniqueOrThrow({ where: { id: activeRec } })).restrictedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'retention.restrictRecord', entityId: oldRec } })).toBe(1);
  });

  it('F-904: MIS rows, bank status history, payouts and audit logs are never in scope', async () => {
    const plan = (await api().get('/api/v1/retention/plan').set(auth(admin)).expect(200)).body.data;
    expect(plan.categories.map((c: { category: string }) => c.category).sort()).toEqual(['CALLING_RECORDS', 'DOCUMENTS', 'MIS_FILES', 'RECORDINGS']);
    expect(plan.neverRemoved.join(' ')).toMatch(/MIS rows.*Payout.*Audit.*suppressions/s);
    // reset for other suites sharing the DB
    await setCfg('retention.executionEnabled', false);
  });

  it('F-904: the nightly run does nothing unless both retention.scheduleEnabled and retention.executionEnabled are on', async () => {
    const extra = (await upload('payment_proof', 'nightly')).id;
    const proc = app.get(MaintenanceProcessor);
    expect(await proc.runMaintenance('retention.nightly')).toMatchObject({ skipped: expect.any(String) });
    await setCfg('retention.scheduleEnabled', true);
    expect(await proc.runMaintenance('retention.nightly')).toMatchObject({ skipped: expect.any(String) }); // execution still off
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: extra } })).purgedAt).toBeNull();

    await setCfg('retention.executionEnabled', true);
    const r = (await proc.runMaintenance('retention.nightly')) as { processed: number; results: { category: string; skipped?: string; processed?: number }[] };
    expect(r.processed).toBe(1);
    expect(r.results.find((x) => x.category === 'RECORDINGS')).toMatchObject({ skipped: 'duration not set' });
    expect(r.results.find((x) => x.category === 'DOCUMENTS')).toMatchObject({ processed: 1 });
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: extra } })).purgedAt).not.toBeNull();
    const run = await prisma.auditLog.findFirstOrThrow({ where: { action: 'retention.scheduledRun' } });
    expect(run.actorUserId).toBeNull(); // system run
    expect(await prisma.notification.count({ where: { kind: 'SECURITY_EVENT', title: 'Nightly retention run' } })).toBe(1);
    expect((await api().get('/api/v1/retention/plan').set(auth(admin)).expect(200)).body.data.scheduleEnabled).toBe(true);
    await setCfg('retention.scheduleEnabled', false);
    await setCfg('retention.executionEnabled', false);
  });
});
