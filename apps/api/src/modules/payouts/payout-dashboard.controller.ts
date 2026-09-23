import { PayoutDashboardQuery, ResolvePayoutExceptionBody } from '@kbs/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PayoutDashboardService } from './payout-dashboard.service';

/** F-606 payout liability / reconciliation dashboard and derived-exception acknowledgements. */
@Controller()
export class PayoutDashboardController {
  constructor(private readonly svc: PayoutDashboardService) {}

  @Get('dashboards/payouts')
  @RequirePermission('DASHBOARD_ADMIN', 'DASHBOARD_MANAGER', 'PAYMENT_QUEUE_READ')
  summary(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.summary(actor, PayoutDashboardQuery.parse(raw));
  }

  @Get('payouts/exceptions')
  @RequirePermission('DASHBOARD_ADMIN', 'DASHBOARD_MANAGER', 'PAYMENT_QUEUE_READ')
  exceptions(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.exceptions(actor, PayoutDashboardQuery.pick({ managerId: true, advisorId: true, bankId: true }).parse(raw));
  }

  @Get('payouts/exceptions/resolutions')
  @RequirePermission('PAYMENT_EXCEPTION_RESOLVE')
  resolutions() {
    return this.svc.resolutions();
  }

  @Post('payouts/exceptions/resolve')
  @RequirePermission('PAYMENT_EXCEPTION_RESOLVE')
  @Idempotent()
  @Audited({ action: 'payoutException.resolve', entityType: 'PayoutException', entityIdFrom: 'subjectId' })
  resolve(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.resolve(actor, ResolvePayoutExceptionBody.parse(raw));
  }
}
