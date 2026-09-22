import { CreatePayoutRateBody, CreatePayoutRuleBody, PayoutRuleListQuery, ReasonBody, UpdatePayoutRuleBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PayoutRulesService } from './payout-rules.service';

/** F-601: Admin-managed payout rules and rates (versioned, per bank). */
@Controller('payouts')
export class PayoutRulesController {
  constructor(private readonly svc: PayoutRulesService) {}

  @Get('rules')
  @RequirePermission('PAYOUT_RULES_MANAGE', 'PAYOUT_LEDGER_ALL', 'PAYOUT_LEDGER_TEAM')
  list(@Query() raw: unknown) {
    return this.svc.list(PayoutRuleListQuery.parse(raw));
  }

  @Get('rules/seen-values')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  seen(@Query('bankId') bankId: string, @Query('field') field = 'cardActivationStatus') {
    return this.svc.seenValues(bankId, field);
  }

  @Get('rules/:id')
  @RequirePermission('PAYOUT_RULES_MANAGE', 'PAYOUT_LEDGER_ALL')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('rules')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Idempotent()
  @Audited({ action: 'payoutRule.create', entityType: 'PayoutRule', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.create(actor, CreatePayoutRuleBody.parse(raw));
  }

  @Patch('rules/:id')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Audited({ action: 'payoutRule.update', entityType: 'PayoutRule', entityIdFrom: 'id' })
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.update(actor, id, UpdatePayoutRuleBody.parse(raw));
  }

  @Post('rules/:id/approve')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Idempotent()
  @Audited({ action: 'payoutRule.approve', entityType: 'PayoutRule', entityIdFrom: 'params.id' })
  approve(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.approve(actor, id, ReasonBody.parse(raw).reason);
  }

  @Post('rules/:id/retire')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Idempotent()
  @Audited({ action: 'payoutRule.retire', entityType: 'PayoutRule', entityIdFrom: 'params.id' })
  retire(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.retire(actor, id, ReasonBody.parse(raw).reason);
  }

  @Post('rules/:id/rates')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Idempotent()
  @Audited({ action: 'payoutRate.create', entityType: 'PayoutRule', entityIdFrom: 'params.id' })
  addRate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.addRate(actor, id, CreatePayoutRateBody.parse(raw));
  }

  @Post('rates/:id/approve')
  @RequirePermission('PAYOUT_RULES_MANAGE')
  @Idempotent()
  @Audited({ action: 'payoutRate.approve', entityType: 'PayoutRate', entityIdFrom: 'params.id' })
  approveRate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.approveRate(actor, id, ReasonBody.parse(raw).reason);
  }
}
