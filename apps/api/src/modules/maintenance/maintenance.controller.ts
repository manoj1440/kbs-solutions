import { Controller, Get, Post } from '@nestjs/common';

import { Audited, RequirePermission } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';

import { MaintenanceProcessor } from './maintenance.processor';

/** F-110 ops: queue/outbox status and an on-demand relay (Admin). */
@Controller('ops')
export class MaintenanceController {
  constructor(
    private readonly processor: MaintenanceProcessor,
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('jobs')
  @RequirePermission('CONFIG_MANAGE')
  async status() {
    const [pending, deadLettered, depths] = await Promise.all([
      this.prisma.client.outboxEvent.count({ where: { processedAt: null, attempts: { lt: 5 } } }),
      this.prisma.client.outboxEvent.count({ where: { processedAt: null, attempts: { gte: 5 } } }),
      this.jobs.depths(),
    ]);
    return { outbox: { pending, deadLettered }, queues: depths };
  }

  @Post('outbox/relay')
  @RequirePermission('CONFIG_MANAGE')
  @Audited({ action: 'outbox.relay', entityType: 'OutboxEvent' })
  relay() {
    return this.processor.runMaintenance('outbox.relay');
  }
}
