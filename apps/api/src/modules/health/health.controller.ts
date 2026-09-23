import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { JobsService } from '../jobs/jobs.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jobs: JobsService,
  ) {}

  @Public()
  @Get()
  async health() {
    const db = await this.prisma.client.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redis = await this.redis.ping();
    // F-110 observability: queue depths (-1 = unreachable) and outbox backlog / dead letters (attempts ≥ 5)
    const queues = redis ? await this.jobs.depths().catch(() => ({})) : {};
    const outbox = db
      ? await Promise.all([this.prisma.client.outboxEvent.count({ where: { processedAt: null, attempts: { lt: 5 } } }), this.prisma.client.outboxEvent.count({ where: { processedAt: null, attempts: { gte: 5 } } })]).then(([pending, deadLettered]) => ({ pending, deadLettered }))
      : null;
    return { status: db ? 'ok' : 'degraded', db, redis, queues, outbox, time: new Date().toISOString() };
  }
}
