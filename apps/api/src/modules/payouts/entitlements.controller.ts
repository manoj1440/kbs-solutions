import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PayoutEligibilityService } from './eligibility.service';

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  state: z.enum(['PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED', 'PAID', 'UNDER_REVIEW', 'VOID']).optional(),
  advisorId: z.string().uuid().optional(),
  bankId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
});

/** F-602: entitlement ledger reads and Admin re-evaluation. */
@Controller('payouts')
export class EntitlementsController {
  constructor(private readonly svc: PayoutEligibilityService) {}

  @Get('entitlements')
  @RequirePermission('PAYOUT_LEDGER_OWN', 'PAYOUT_LEDGER_TEAM', 'PAYOUT_LEDGER_ALL', 'PAYMENT_QUEUE_READ')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.list(actor, ListQuery.parse(raw));
  }

  @Get('entitlements/:id/events')
  @RequirePermission('PAYOUT_LEDGER_OWN', 'PAYOUT_LEDGER_TEAM', 'PAYOUT_LEDGER_ALL', 'PAYMENT_QUEUE_READ')
  events(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.events(actor, id);
  }

  @Post('evaluate')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Idempotent()
  @Audited({ action: 'payouts.reevaluate', entityType: 'Bank', entityIdFrom: 'id' })
  reevaluate(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    const { bankId } = z.object({ bankId: z.string().uuid() }).parse(raw);
    return this.svc.reevaluateBank(actor, bankId).then((r) => ({ id: bankId, ...r }));
  }
}
