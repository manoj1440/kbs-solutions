import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';

import { ENV, type Env } from '../../config/env';
import { JobsService, parseRedisUrl } from '../jobs/jobs.service';
import { QUEUES } from '../jobs/queues';

import { TrainingExpiryService } from './training-expiry.service';

/** F-204/F-110: repeatable `training.sweep` every 5 minutes (worker mode or JOBS_INLINE). */
@Injectable()
export class TrainingProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrainingProcessor.name);
  private worker: Worker | null = null;
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jobs: JobsService,
    private readonly expiry: TrainingExpiryService,
  ) {}

  async onModuleInit() {
    if (!(this.env.WORKER_MODE || this.env.JOBS_INLINE) || this.env.NODE_ENV === 'test') return;
    try {
      await this.jobs.queues.training.add('training.sweep', {}, { jobId: 'training.sweep', repeat: { every: 5 * 60_000 } });
      this.worker = new Worker(
        QUEUES.training,
        async (job) => {
          if (job.name === 'training.sweep') {
            const r = await this.expiry.sweep();
            if (r.expired) this.logger.warn({ expired: r.expired }, 'training deadlines materialised');
          }
        },
        { connection: parseRedisUrl(this.env.REDIS_URL), concurrency: 1 },
      );
      this.worker.on('failed', (job, err) => this.logger.error({ jobId: job?.id, err: err.message }, 'training job failed'));
    } catch (e) {
      this.logger.warn({ err: (e as Error).message }, 'training processor not started (Redis unavailable?)');
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
