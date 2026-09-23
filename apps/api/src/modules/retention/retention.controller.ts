import { LegalHoldBody, LegalHoldListQuery, RetentionExecuteBody } from '@kbs/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { RetentionService } from './retention.service';

/** F-904 retention: dry-run plan, fail-closed execution, legal hold. Admin only (REQ-21 §21.5 "authorized mechanism"). */
@Controller('retention')
export class RetentionController {
  constructor(private readonly svc: RetentionService) {}

  @Get('plan')
  @RequirePermission('CONFIG_MANAGE')
  plan() {
    return this.svc.plan();
  }

  @Post('execute')
  @RequirePermission('CONFIG_MANAGE')
  @Idempotent()
  @Audited({ action: 'retention.execute', entityType: 'Retention' })
  execute(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.execute(actor, RetentionExecuteBody.parse(raw));
  }

  @Get('legal-holds')
  @RequirePermission('CONFIG_MANAGE')
  holds(@Query() raw: unknown) {
    return this.svc.listHolds(LegalHoldListQuery.parse(raw).subject);
  }

  @Post('legal-holds')
  @RequirePermission('CONFIG_MANAGE')
  @Audited({ action: 'legalHold.set', entityType: 'LegalHold', entityIdFrom: 'id' })
  setHold(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.setLegalHold(actor, LegalHoldBody.parse(raw));
  }
}
