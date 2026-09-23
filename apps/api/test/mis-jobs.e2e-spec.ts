import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { MisJobsService } from '../src/modules/mis/mis-jobs.service';
import { MisPipelineService } from '../src/modules/mis/mis-pipeline.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';
import { hdfcWorkbook, type MisRowInput, XLSX_TYPE } from './mis-fixture';

describe('F-508 MIS preview/apply as background jobs (ADR-013, REQ-24 §24.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let adminId: string;
  let hdfcId: string;
  let profileId: string;
  let advisorId: string;
  const api = () => request(app.getHttpServer());
  const setThreshold = (value: number) => api().put('/api/v1/config/mis.asyncRowThreshold').set(auth(admin)).send({ value, reason: 'F-508 test' }).expect(200);

  async function batch(rows: MisRowInput[], name: string) {
    const up = await api().post('/api/v1/files/mis').set(auth(admin)).attach('file', await hdfcWorkbook(rows), { filename: name, contentType: XLSX_TYPE }).expect(201);
    return (await api().post('/api/v1/mis/batches').set(auth(admin)).set('idempotency-key', idem()).send({ bankId: hdfcId, profileId, fileId: up.body.data.id }).expect(201)).body.data.id as string;
  }
  async function lead(appNo: string, mobile: string) {
    const card = await prisma.creditCard.findFirstOrThrow({ where: { bankId: hdfcId } });
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advisorId, reportingParentUserIdSnapshot: advisorId, bankId: hdfcId, cardId: card.id, customerFullName: `Customer ${appNo}`, customerMobile: mobile, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    await prisma.bankApplicationLinkage.create({ data: { leadId: l.id, bankId: hdfcId, referenceKind: 'APPLICATION_NO', referenceValue: appNo, source: 'ADVISOR_ENTERED', enteredByUserId: advisorId } });
    return l.id;
  }
  async function waitFor(batchId: string, status: 'SUCCEEDED' | 'FAILED') {
    for (let i = 0; i < 100; i++) {
      const j = (await api().get(`/api/v1/mis/batches/${batchId}/job`).set(auth(admin)).expect(200)).body.data;
      if (j.job.status === status) return j;
      if (j.job.status === (status === 'SUCCEEDED' ? 'FAILED' : 'SUCCEEDED')) throw new Error(`job ended ${j.job.status}: ${j.job.error}`);
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('job did not finish');
  }
  const rows: MisRowInput[] = [
    { 'Application No': 'JOB-001', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Approved', CUSTOMER_NAME: 'Customer A' },
    { 'Application No': 'JOB-002', CURRENT_STAGE: 'Document Curing', CUSTOMER_NAME: 'Customer B' },
    { 'Application No': 'JOB-404', CURRENT_STAGE: 'In-Complete Application', CUSTOMER_NAME: 'Nobody' },
  ];

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const login = await loginAs(app, prisma, ADMIN_MOBILE);
    admin = login.accessToken;
    adminId = (await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).id;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    profileId = (await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } })).id;
    await api().post(`/api/v1/mis/profiles/${profileId}/approve`).set(auth(admin)).set('idempotency-key', idem()).send({ reason: 'test' }).expect(201);
    advisorId = (await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555999508', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Jobs' } })).id;
    await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Jobs', status: 'PUBLISHED' } });
    await lead('JOB-001', '+919555750801');
    await lead('JOB-002', '+919555750802');
  });
  afterAll(async () => app.close());

  it('F-508: small batches stay synchronous (result in the response)', async () => {
    const id = await batch(rows, 'small.xlsx');
    const pv = (await api().post(`/api/v1/mis/batches/${id}/preview`).set(auth(admin)).expect(201)).body.data;
    expect(pv.queued).toBeUndefined();
    expect(pv.totals).toMatchObject({ rows: 3, MATCHED: 2, UNMATCHED: 1 });
    await prisma.misImportBatch.update({ where: { id }, data: { stage: 'REJECTED', rejectReason: 'test cleanup' } });
  });

  it('F-508: above the threshold preview runs as a job: queued response, progress, PREVIEWED with the same report', async () => {
    await setThreshold(1);
    const id = await batch(rows, 'large.xlsx');
    const r = (await api().post(`/api/v1/mis/batches/${id}/preview`).set(auth(admin)).expect(201)).body.data;
    expect(r).toMatchObject({ queued: true, alreadyRunning: false, job: { kind: 'PREVIEW', status: 'QUEUED' } });
    const done = await waitFor(id, 'SUCCEEDED');
    expect(done.stage).toBe('PREVIEWED');
    expect(done.job.progress).toMatchObject({ phase: 'match', done: 3, total: 3 });
    const b = await prisma.misImportBatch.findUniqueOrThrow({ where: { id } });
    expect((b.preview as { report: { totals: unknown } }).report.totals).toMatchObject({ rows: 3, MATCHED: 2, UNMATCHED: 1 });
    expect(await prisma.auditLog.count({ where: { action: 'misBatch.previewCompleted', entityId: id, actorUserId: adminId } })).toBe(1);
    expect(await prisma.notification.count({ where: { recipientUserId: adminId, dedupeKey: { startsWith: `mis:preview:${id}` } } })).toBe(1);
  });

  it('F-508: a failed apply job is visible (FAILED, error, audit, notification) and a retry completes without duplicating history', async () => {
    const id = (await prisma.misImportBatch.findFirstOrThrow({ where: { stage: 'PREVIEWED' } })).id;
    const pipeline = app.get(MisPipelineService);
    const spy = jest.spyOn(pipeline, 'apply').mockRejectedValueOnce(new Error('database went away'));
    await api().post(`/api/v1/mis/batches/${id}/apply`).set(auth(admin)).set('idempotency-key', idem()).expect(201);
    const failed = await waitFor(id, 'FAILED');
    expect(failed).toMatchObject({ stage: 'FAILED', job: { kind: 'APPLY', error: 'database went away' } });
    expect(await prisma.auditLog.count({ where: { action: 'misBatch.jobFailed', entityId: id } })).toBe(1);
    expect(await prisma.notification.count({ where: { dedupeKey: { startsWith: `mis:failed:${id}` } } })).toBe(1);
    spy.mockRestore();

    await api().post(`/api/v1/mis/batches/${id}/apply`).set(auth(admin)).set('idempotency-key', idem()).expect(201);
    const ok = await waitFor(id, 'SUCCEEDED');
    expect(ok.stage).toBe('APPLIED');
    const hist = await prisma.bankStatusHistory.findMany({ where: { batchId: id } });
    expect(new Set(hist.map((h) => `${h.leadId}|${h.field}`)).size).toBe(hist.length);
    expect(await prisma.bankStatusSnapshot.count({ where: { lastMatchedBatchId: id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: 'misBatch.applyCompleted', entityId: id } })).toBe(1);

    // re-running apply on an APPLIED batch is refused before anything is queued
    expect((await api().post(`/api/v1/mis/batches/${id}/apply`).set(auth(admin)).set('idempotency-key', idem()).expect(409)).body.error.code).toBe('MIS_BATCH_STAGE_INVALID');
  });

  it('F-508: two triggers at once start one job; a stale RUNNING job can be re-triggered', async () => {
    const id = await batch(rows.map((r) => ({ ...r, CURRENT_STAGE: 'Login' })), 'concurrent.xlsx');
    const jobs = app.get(MisJobsService);
    const run = jest.spyOn(jobs, 'run').mockResolvedValue({ skipped: true }); // keep it QUEUED
    const actor = { userId: adminId, role: 'ADMIN' } as never;
    const [a, b] = await Promise.all([jobs.trigger(actor, id, 'PREVIEW'), jobs.trigger(actor, id, 'PREVIEW')]);
    expect([a.alreadyRunning, b.alreadyRunning].sort()).toEqual([false, true]);
    await new Promise((r) => setImmediate(r));
    expect(run).toHaveBeenCalledTimes(1);

    await prisma.misImportBatch.update({ where: { id }, data: { jobStatus: 'RUNNING', jobHeartbeatAt: new Date(Date.now() - 11 * 60_000) } });
    expect((await jobs.trigger(actor, id, 'PREVIEW')).alreadyRunning).toBe(false);
    await new Promise((r) => setImmediate(r));
    expect(run).toHaveBeenCalledTimes(2);
    run.mockRestore();
    await setThreshold(2000);
  });
});
