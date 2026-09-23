import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { startApp } from '../src/bootstrap';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { JobsService, safeJobId } from '../src/modules/jobs/jobs.service';
import { OutboxService } from '../src/modules/jobs/outbox.service';
import { MaintenanceProcessor } from '../src/modules/maintenance/maintenance.processor';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase } from './helpers';

describe('F-110 background jobs, outbox relay and worker mode (REQ-24 §24.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let jobs: JobsService;
  let outbox: OutboxService;
  let admin: string;
  const run = randomUUID().slice(0, 8);
  const cleanup: string[] = [];

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    jobs = app.get(JobsService);
    outbox = app.get(OutboxService);
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
  });
  afterAll(async () => {
    for (const id of cleanup) await jobs.queues.files.remove(safeJobId(id)).catch(() => undefined);
    await app.close();
  });

  it('F-110: outbox events written in a rolled-back transaction are never relayed; committed ones are, exactly once', async () => {
    const lost = `files.test.rolledback.${run}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.outboxEvent.create({ data: { type: lost, payload: { jobId: `${lost}:1` } } });
        throw new Error('business write failed');
      }),
    ).rejects.toThrow('business write failed');
    expect(await prisma.outboxEvent.count({ where: { type: lost } })).toBe(0);

    const kept = `files.test.committed.${run}`;
    const jobId = `${kept}:1`;
    cleanup.push(jobId);
    await prisma.$transaction(async (tx) => {
      await tx.outboxEvent.create({ data: { type: kept, payload: { jobId } } });
    });
    await outbox.relay();
    await outbox.relay(); // second pass finds nothing new
    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { type: kept } });
    expect(ev.processedAt).not.toBeNull();
    const job = await jobs.queues.files.getJob(safeJobId(jobId));
    expect(job?.data).toMatchObject({ outboxId: ev.id });
    expect(await jobs.queues.files.getJob(safeJobId(`${lost}:1`))).toBeUndefined();
    expect(ev.lastError).toBeNull(); // BullMQ refuses ':' in ids — the relay must map it (regression)
  });

  it('F-110: re-adding a job with the same id is a no-op (duplicates collapse)', async () => {
    const jobId = `files.test.dup.${run}`;
    cleanup.push(jobId);
    const before = await jobs.queues.files.getJobCountByTypes('waiting', 'delayed', 'active', 'completed');
    await jobs.enqueue('files', 'files.test', { n: 1 }, { jobId });
    await jobs.enqueue('files', 'files.test', { n: 2 }, { jobId });
    const after = await jobs.queues.files.getJobCountByTypes('waiting', 'delayed', 'active', 'completed');
    expect(after - before).toBe(1);
    expect((await jobs.queues.files.getJob(jobId))?.data).toEqual({ n: 1 }); // first write wins
  });

  it('F-110: an unroutable event is retried then dead-lettered after 5 attempts and surfaced in /ops/jobs and /health', async () => {
    const type = `unknown.${run}`;
    const ev = await prisma.outboxEvent.create({ data: { type, payload: {} } });
    for (let i = 0; i < 7; i++) await outbox.relay();
    const after = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ev.id } });
    expect(after).toMatchObject({ attempts: 5, processedAt: null });
    expect(after.lastError).toMatch(/no route/);
    const ops = (await request(app.getHttpServer()).get('/api/v1/ops/jobs').set(auth(admin)).expect(200)).body.data;
    expect(ops.outbox.deadLettered).toBeGreaterThanOrEqual(1);
    const health = (await request(app.getHttpServer()).get('/api/v1/health').expect(200)).body.data;
    expect(health.outbox.deadLettered).toBeGreaterThanOrEqual(1);
    expect(Object.keys(health.queues)).toEqual(expect.arrayContaining(['training', 'misImport', 'notifications', 'files', 'payouts', 'maintenance']));
  });

  it('F-110: on-demand relay is Admin-only and audited; maintenance jobs run by name', async () => {
    const r = await request(app.getHttpServer()).post('/api/v1/ops/outbox/relay').set(auth(admin)).expect(201);
    expect(r.body.data).toHaveProperty('relayed');
    expect(await prisma.auditLog.count({ where: { action: 'outbox.relay' } })).toBe(1);
    const proc = app.get(MaintenanceProcessor);
    expect(await proc.runMaintenance('payouts.releaseHolds')).toEqual({ released: 0 });
    await expect(proc.runMaintenance('nope')).rejects.toThrow(/unknown maintenance job/);
  });

  it('F-110: worker mode boots without listening on HTTP', async () => {
    const worker = await startApp({ WORKER_MODE: true, API_PORT: 0, NODE_ENV: 'test' });
    try {
      expect(worker.getHttpServer().listening).toBe(false);
    } finally {
      await worker.close();
    }
  });
});
