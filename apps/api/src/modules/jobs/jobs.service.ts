import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type JobsOptions, Queue } from 'bullmq';

import { ENV, type Env } from '../../config/env';

import { QUEUES } from './queues';

/** BullMQ queue registry (F-110). Processors register in worker mode / JOBS_INLINE. */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  readonly queues: Record<keyof typeof QUEUES, Queue>;

  constructor(@Inject(ENV) env: Env) {
    const connection = parseRedisUrl(env.REDIS_URL);
    const mk = (name: string) => new Queue(name, { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 } });
    this.queues = {
      training: mk(QUEUES.training),
      misImport: mk(QUEUES.misImport),
      notifications: mk(QUEUES.notifications),
      files: mk(QUEUES.files),
      payouts: mk(QUEUES.payouts),
      maintenance: mk(QUEUES.maintenance),
    };
  }

  async enqueue(queue: keyof typeof QUEUES, name: string, data: Record<string, unknown>, opts: JobsOptions = {}) {
    await this.queues[queue].add(name, data, opts);
  }

  async depths(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [k, q] of Object.entries(this.queues)) out[k] = await q.getWaitingCount().catch(() => -1);
    return out;
  }

  async onModuleDestroy() {
    await Promise.allSettled(Object.values(this.queues).map((q) => q.close()));
    this.logger.debug('queues closed');
  }
}

export function parseRedisUrl(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined, db: u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : 0, maxRetriesPerRequest: null as null };
}
