import { OversightCallsQuery, OversightSharesQuery, OversightSummaryQuery } from '@kbs/shared';
import { Controller, Get, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CurrentActor, RequirePermission } from '../../common/decorators';

import { OversightService } from './oversight.service';

/** F-314 org-wide telephony / WhatsApp delivery / recording oversight (Admin all, Manager own team). Read-only. */
@Controller('calling/oversight')
export class OversightController {
  constructor(private readonly svc: OversightService) {}

  @Get('summary')
  @RequirePermission('CALLING_RECORDS_READ_ALL', 'CALLING_RECORDS_READ_TEAM')
  summary(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.summary(actor, OversightSummaryQuery.parse(raw));
  }

  @Get('calls')
  @RequirePermission('CALLING_RECORDS_READ_ALL', 'CALLING_RECORDS_READ_TEAM')
  calls(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.calls(actor, OversightCallsQuery.parse(raw));
  }

  @Get('shares')
  @RequirePermission('CALLING_RECORDS_READ_ALL', 'CALLING_RECORDS_READ_TEAM')
  shares(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.shares(actor, OversightSharesQuery.parse(raw));
  }
}
