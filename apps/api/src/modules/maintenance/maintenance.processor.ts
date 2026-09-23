import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { type Job, Worker } from 'bullmq';

import { ENV, type Env } from '../../config/env';
import { JobsService, parseRedisUrl } from '../jobs/jobs.service';
import { OutboxService } from '../jobs/outbox.service';
import { QUEUES } from '../jobs/queues';
import { PayoutEligibilityService } from '../payouts/eligibility.service';

/** Relayed domain-event queues. Their side effects (notifications, payout review) already run in the writing request; */
/** these workers acknowledge the events so queues drain, and are the extension point for future async handlers. */
const EVENT_QUEUES = [QUEUES.misImport, QUEUES.payouts, QUEUES.notifications, QUEUES.files] as const;
export type EventHandler = (job: Job) => Promise<unknown>;

/**
 * F-110: scheduler + processors that only run in worker mode (or JOBS_INLINE in dev), never in tests.
 * - `outbox.relay` every 5 s moves committed OutboxEvents to their queues (deterministic job ids collapse duplicates).
 * - `payouts.releaseHolds` hourly materialises PENDING_HOLD → ELIGIBLE_AVAILABLE (reads also release lazily).
 */
@Injectable()
export class MaintenanceProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceProcessor.name);
  private workers: Worker[] = [];
  readonly handlers = new Map<string, EventHandler>();
  /** Scheduled maintenance jobs contributed by feature modules (registered in their onModuleInit). */
  private readonly scheduled = new Map<string, { run: () => Promise<unknown>; repeat: { every?: number; pattern?: string; tz?: string } }>();

  schedule(name: string, repeat: { every?: number; pattern?: string; tz?: string }, run: () => Promise<unknown>) {
    this.scheduled.set(name, { run, repeat });
  }

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jobs: JobsService,
    private readonly outbox: OutboxService,
    private readonly eligibility: PayoutEligibilityService,
  ) {}

  /** Runs one maintenance job by name (used by the worker and directly by tests). */
  async runMaintenance(name: string): Promise<unknown> {
    if (name === 'outbox.relay') return { relayed: await this.outbox.relay() };
    if (name === 'payouts.releaseHolds') return { released: await this.eligibility.releaseHolds() };
    const job = this.scheduled.get(name);
    if (job) return job.run();
    throw new Error(`unknown maintenance job ${name}`);
  }

  /** Default event handling: registered handler, else acknowledge (logged) — never silently dropped. */
  async handleEvent(job: Job): Promise<unknown> {
    const h = this.handlers.get(job.name);
    if (h) return h(job);
    this.logger.debug({ queue: job.queueName, name: job.name, jobId: job.id, outboxId: job.data?.outboxId }, 'domain event acknowledged (handled synchronously at write time)');
    return { acknowledged: true };
  }

  /** After every module's onModuleInit, so contributed schedules are known. */
  async onApplicationBootstrap() {
    if (!(this.env.WORKER_MODE || this.env.JOBS_INLINE) || this.env.NODE_ENV === 'test') return;
    const connection = parseRedisUrl(this.env.REDIS_URL);
    try {
      await this.jobs.queues.maintenance.add('outbox.relay', {}, { jobId: 'outbox.relay', repeat: { every: 5_000 }, removeOnComplete: 100, removeOnFail: 100 });
      await this.jobs.queues.maintenance.add('payouts.releaseHolds', {}, { jobId: 'payouts.releaseHolds', repeat: { every: 60 * 60_000 } });
      for (const [name, j] of this.scheduled) await this.jobs.queues.maintenance.add(name, {}, { jobId: name, repeat: j.repeat });
      this.workers.push(new Worker(QUEUES.maintenance, (job) => this.runMaintenance(job.name), { connection, concurrency: 1 }));
      for (const q of EVENT_QUEUES) this.workers.push(new Worker(q, (job) => this.handleEvent(job), { connection, concurrency: 4 }));
      for (const w of this.workers) w.on('failed', (job, err) => this.logger.error({ queue: w.name, jobId: job?.id, requestId: job?.data?.requestId, err: err.message }, 'job failed'));
      this.logger.log({ queues: [QUEUES.maintenance, ...EVENT_QUEUES] }, 'maintenance + event workers started');
    } catch (e) {
      this.logger.warn({ err: (e as Error).message }, 'maintenance processor not started (Redis unavailable?)');
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.workers.map((w) => w.close()));
  }
}
