import type { MisJobKind } from '@kbs/shared';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { JobsService } from '../jobs/jobs.service';
import { MaintenanceProcessor } from '../maintenance/maintenance.processor';
import { NotificationsService } from '../notifications/notifications.service';

import { APPLY_STAGES, MisPipelineService, type MisProgress, PREVIEW_STAGES } from './mis-pipeline.service';

export const MIS_JOB_NAME = 'mis.job.run';
/** A RUNNING job without a heartbeat for this long is treated as dead (worker crash) and may be re-triggered. */
export const STALE_AFTER_MS = 10 * 60_000;
const PROGRESS_EVERY_MS = 1_000;

type JobView = { kind: MisJobKind | null; status: string | null; progress: unknown; error: string | null; queuedAt: string | null; startedAt: string | null; heartbeatAt: string | null; finishedAt: string | null };

/**
 * F-508 / ADR-013: preview and apply of large MIS batches run as a background job. State lives on the batch row so the
 * UI, audit and recovery never depend on Redis retention. `queue` dispatch → BullMQ `mis-import` (worker mode);
 * `local` → detached in this process (dev/test). Idempotency comes from the pipeline itself (row-level `appliedAt`,
 * `(leadId, batchId, field)` history unique), so a retry after a crash never duplicates history.
 */
@Injectable()
export class MisJobsService implements OnModuleInit {
  private readonly logger = new Logger(MisJobsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly pipeline: MisPipelineService,
    private readonly jobs: JobsService,
    private readonly maintenance: MaintenanceProcessor,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.maintenance.handlers.set(MIS_JOB_NAME, (job) => this.run(job.data.batchId as string, job.data.kind as MisJobKind));
  }

  private get dispatch(): 'queue' | 'local' {
    return this.env.JOBS_DISPATCH ?? (this.env.NODE_ENV === 'production' ? 'queue' : 'local');
  }

  /** True when the batch is above `mis.asyncRowThreshold` and must not run inside the request. */
  async isLarge(batchId: string): Promise<boolean> {
    const threshold = this.config.getInt('mis.asyncRowThreshold') ?? 2000;
    const rows = await this.prisma.client.misRow.count({ where: { batchId } });
    return rows > threshold;
  }

  view(b: { jobKind: string | null; jobStatus: string | null; jobProgress: unknown; jobError: string | null; jobQueuedAt: Date | null; jobStartedAt: Date | null; jobHeartbeatAt: Date | null; jobFinishedAt: Date | null }): JobView {
    return { kind: b.jobKind as MisJobKind | null, status: b.jobStatus, progress: b.jobProgress ?? null, error: b.jobError, queuedAt: b.jobQueuedAt?.toISOString() ?? null, startedAt: b.jobStartedAt?.toISOString() ?? null, heartbeatAt: b.jobHeartbeatAt?.toISOString() ?? null, finishedAt: b.jobFinishedAt?.toISOString() ?? null };
  }

  async status(batchId: string) {
    const b = await this.prisma.client.misImportBatch.findUnique({ where: { id: batchId } });
    if (!b) throw AppError.notFound('MIS batch');
    return { batchId, stage: b.stage, job: this.view(b) };
  }

  /** Validate, claim (one active job per batch) and dispatch. Returns immediately. */
  async trigger(actor: Actor, batchId: string, kind: MisJobKind) {
    const b = await this.prisma.client.misImportBatch.findUnique({ where: { id: batchId } });
    if (!b) throw AppError.notFound('MIS batch');
    const allowed = (kind === 'PREVIEW' ? PREVIEW_STAGES : APPLY_STAGES) as readonly string[];
    if (!allowed.includes(b.stage)) throw new AppError('MIS_BATCH_STAGE_INVALID', `Batch is ${b.stage}; ${kind === 'PREVIEW' ? 'preview' : 'apply'} is not possible.`);
    const now = new Date();
    const stale = new Date(now.getTime() - STALE_AFTER_MS);
    // atomic claim: free, finished, or a RUNNING job whose heartbeat stopped
    const claimed = await this.prisma.client.misImportBatch.updateMany({
      where: { id: batchId, OR: [{ jobStatus: null }, { jobStatus: { in: ['SUCCEEDED', 'FAILED'] } }, { jobStatus: 'RUNNING', jobHeartbeatAt: { lt: stale } }, { jobStatus: 'QUEUED', jobQueuedAt: { lt: stale } }] },
      data: { jobKind: kind, jobStatus: 'QUEUED', jobProgress: { phase: 'queued', done: 0, total: await this.prisma.client.misRow.count({ where: { batchId } }) }, jobError: null, jobRequestedByUserId: actor.userId, jobQueuedAt: now, jobStartedAt: null, jobHeartbeatAt: null, jobFinishedAt: null },
    });
    const fresh = await this.prisma.client.misImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    if (claimed.count === 0) return { queued: true as const, alreadyRunning: true, batchId, stage: fresh.stage, job: this.view(fresh) };
    RequestContextStore.audit({ entityId: batchId, after: { job: kind, dispatch: this.dispatch, rows: (fresh.jobProgress as { total?: number } | null)?.total ?? null } });
    if (this.dispatch === 'queue') {
      await this.jobs.enqueue('misImport', MIS_JOB_NAME, { batchId, kind, requestedBy: actor.userId }, { jobId: `mis:${kind.toLowerCase()}:${batchId}:${now.getTime()}`, attempts: 1 });
    } else {
      setImmediate(() => {
        void this.run(batchId, kind).catch((e) => this.logger.error({ batchId, kind, err: (e as Error).message }, 'local MIS job crashed'));
      });
    }
    return { queued: true as const, alreadyRunning: false, batchId, stage: fresh.stage, job: this.view(fresh) };
  }

  /** Job body (worker or local). Duplicate deliveries are ignored by the QUEUED → RUNNING claim. */
  async run(batchId: string, kind: MisJobKind): Promise<unknown> {
    const start = new Date();
    const claim = await this.prisma.client.misImportBatch.updateMany({ where: { id: batchId, jobKind: kind, jobStatus: 'QUEUED' }, data: { jobStatus: 'RUNNING', jobStartedAt: start, jobHeartbeatAt: start } });
    if (claim.count === 0) return { skipped: true };
    const batch = await this.prisma.client.misImportBatch.findUniqueOrThrow({ where: { id: batchId }, select: { publicRef: true, jobRequestedByUserId: true } });
    const requester = batch.jobRequestedByUserId as string;
    const role = (await this.prisma.client.user.findUnique({ where: { id: requester }, select: { role: true } }))?.role ?? 'ADMIN';
    const actor = { userId: requester, role, status: 'ACTIVE', sessionId: 'mis-job', permissions: [], teamUserIds: [], reportingParentUserId: null } as Actor;
    let last = 0;
    const onProgress: MisProgress = async (phase, done, total) => {
      const t = Date.now();
      if (done !== total && t - last < PROGRESS_EVERY_MS) return;
      last = t;
      await this.prisma.client.misImportBatch.update({ where: { id: batchId }, data: { jobProgress: { phase, done, total }, jobHeartbeatAt: new Date(t) } });
    };
    try {
      const result = kind === 'PREVIEW' ? await this.pipeline.preview(batchId, { onProgress }) : await this.pipeline.apply(actor, batchId, { onProgress });
      const totals = kind === 'PREVIEW' ? (result as { totals: unknown }).totals : result;
      await this.prisma.client.misImportBatch.update({ where: { id: batchId }, data: { jobStatus: 'SUCCEEDED', jobFinishedAt: new Date(), jobHeartbeatAt: new Date() } });
      await this.audit.record({ action: kind === 'PREVIEW' ? 'misBatch.previewCompleted' : 'misBatch.applyCompleted', entityType: 'MisImportBatch', entityId: batchId, actor: { userId: requester, role }, after: { totals, durationMs: Date.now() - start.getTime() } });
      // apply already sends MIS_IMPORT_RESULT; tell the requester the preview is ready
      if (kind === 'PREVIEW') await this.notifications.notify({ recipientUserId: requester, kind: 'MIS_IMPORT_RESULT', title: `MIS batch ${batch.publicRef} preview ready`, body: 'The match preview finished. Review unmatched and conflicting rows before applying.', deepLink: { entityType: 'MisImportBatch', entityId: batchId }, dedupeKey: `mis:preview:${batchId}:${start.getTime()}` });
      return totals;
    } catch (e) {
      const msg = (e as Error).message.slice(0, 1000);
      this.logger.error({ batchId, kind, err: msg }, 'MIS background job failed');
      await this.prisma.client.misImportBatch.update({ where: { id: batchId }, data: { jobStatus: 'FAILED', jobError: msg, jobFinishedAt: new Date(), ...(kind === 'APPLY' ? { stage: 'FAILED', error: msg } : {}) } });
      await this.audit.record({ action: 'misBatch.jobFailed', entityType: 'MisImportBatch', entityId: batchId, actor: { userId: requester, role }, after: { kind, error: msg } });
      await this.notifications.notify({ recipientUserId: requester, kind: 'MIS_IMPORT_RESULT', title: `MIS batch ${batch.publicRef} ${kind === 'PREVIEW' ? 'preview' : 'apply'} failed`, body: `The background ${kind === 'PREVIEW' ? 'preview' : 'apply'} stopped: ${msg.slice(0, 160)}. Rows already applied are kept; run it again to continue.`, deepLink: { entityType: 'MisImportBatch', entityId: batchId }, dedupeKey: `mis:failed:${batchId}:${start.getTime()}` });
      return { failed: true, error: msg };
    }
  }
}
