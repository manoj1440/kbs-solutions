import { BankReferenceBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { InterestsService } from './interests.service';

const ListQuery = z.object({ callingRecordId: z.string().uuid().optional(), telecallerUserId: z.string().uuid().optional() });
const RangeQuery = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });

/** A21: Telecaller calling interests (their "leads"), the bank reference that lets MIS reach them, and the Telecaller's own performance. */
@Controller('calling')
export class InterestsController {
  constructor(private readonly svc: InterestsService) {}

  @Get('interests')
  @RequirePermission('CALLING_QUEUE_OWN', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.list(actor, ListQuery.parse(raw));
  }

  @Post('interests/:id/bank-reference')
  @RequirePermission('CALL_OUTCOME_RECORD', 'CALLING_RECORDS_READ_ALL')
  @Idempotent()
  @Audited({ action: 'callingInterest.bankReference', entityType: 'CallingInterest', entityIdFrom: 'id' })
  setBankReference(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.setBankReference(actor, id, BankReferenceBody.parse(raw));
  }

  @Get('me/performance')
  @RequirePermission('CALLING_QUEUE_OWN')
  myPerformance(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    const q = RangeQuery.parse(raw);
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 24 * 3600_000);
    return this.svc.myPerformance(actor, { from, to });
  }
}
