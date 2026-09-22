import { CreatePayoutRequestBody, PayoutApprovalBody, PayoutRequestListQuery, ReasonBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PayoutRequestsService } from './payout-requests.service';

/** F-603 ledger + requests, F-604 dual approval. */
@Controller('payouts')
export class PayoutRequestsController {
  constructor(private readonly svc: PayoutRequestsService) {}

  @Get('me/ledger')
  @RequirePermission('PAYOUT_LEDGER_OWN')
  myLedger(@CurrentActor() actor: Actor) {
    return this.svc.ledger(actor);
  }

  @Get('ledger/:advisorId')
  @RequirePermission('PAYOUT_LEDGER_TEAM', 'PAYOUT_LEDGER_ALL', 'PAYMENT_QUEUE_READ')
  ledgerOf(@CurrentActor() actor: Actor, @Param('advisorId') advisorId: string) {
    return this.svc.ledger(actor, advisorId);
  }

  @Get('requests')
  @RequirePermission('PAYOUT_LEDGER_OWN', 'PAYOUT_LEDGER_TEAM', 'PAYOUT_LEDGER_ALL', 'PAYMENT_QUEUE_READ')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.list(actor, PayoutRequestListQuery.parse(raw));
  }

  @Post('requests')
  @RequirePermission('PAYOUT_REQUEST')
  @Idempotent()
  @Audited({ action: 'payoutRequest.create', entityType: 'PayoutRequest', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown, @Req() req: Request) {
    return this.svc.create(actor, CreatePayoutRequestBody.parse(raw), req.header('idempotency-key') as string);
  }

  @Get('requests/:id')
  @RequirePermission('PAYOUT_LEDGER_OWN', 'PAYOUT_LEDGER_TEAM', 'PAYOUT_LEDGER_ALL', 'PAYMENT_QUEUE_READ')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.get(actor, id);
  }

  @Post('requests/:id/approvals')
  @RequirePermission('PAYOUT_APPROVE_MANAGER', 'PAYOUT_APPROVE_ADMIN')
  @Idempotent()
  @Audited({ action: 'payoutRequest.decide', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  decide(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.decide(actor, id, PayoutApprovalBody.parse(raw));
  }

  @Post('requests/:id/cancel')
  @RequirePermission('PAYOUT_REQUEST', 'PAYOUT_CANCEL_ANY')
  @Idempotent()
  @Audited({ action: 'payoutRequest.cancel', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  cancel(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.cancel(actor, id, ReasonBody.parse(raw).reason);
  }
}
