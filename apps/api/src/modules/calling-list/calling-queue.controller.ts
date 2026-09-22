import { QueueQuery, ReassignRecordBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequireGates, RequirePermission } from '../../common/decorators';

import { AllocationService } from './allocation.service';
import { CallingQueueService } from './calling-queue.service';

/** F-307 queue/detail (scoped) + F-305 reassignment & distribution. */
@Controller('calling')
export class CallingQueueController {
  constructor(
    private readonly queue: CallingQueueService,
    private readonly allocation: AllocationService,
  ) {}

  /** Telecaller's own queue: training + office-network gated (F-111). */
  @Get('queue')
  @RequirePermission('CALLING_QUEUE_OWN')
  @RequireGates('training', 'network')
  myQueue(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    const q = QueueQuery.parse(raw);
    return this.queue.list(actor, { ...q, telecallerId: actor.userId });
  }

  /** Manager (team) / Admin (all) listing, optionally for one Telecaller. */
  @Get('records')
  @RequirePermission('CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  records(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.queue.list(actor, QueueQuery.parse(raw));
  }

  @Get('records/:id')
  @RequirePermission('CALLING_QUEUE_OWN', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  @RequireGates('training', 'network')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.queue.detail(actor, id);
  }

  @Post('records/:id/reassign')
  @RequirePermission('ALLOCATION_REASSIGN_TEAM', 'ALLOCATION_REASSIGN_ANY')
  @Idempotent()
  @Audited({ action: 'allocation.reassign', entityType: 'CallingRecord', entityIdFrom: 'id' })
  reassign(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.allocation.reassign(actor, id, ReassignRecordBody.parse(raw));
  }

  @Get('distribution')
  @RequirePermission('CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  distribution(@CurrentActor() actor: Actor) {
    return this.allocation.distribution(actor);
  }
}
