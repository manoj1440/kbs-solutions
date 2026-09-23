import { DashboardQuery } from '@kbs/shared';
import { Controller, Get, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CurrentActor, RequirePermission } from '../../common/decorators';

import { DashboardMetricsService } from './dashboard-metrics.service';

/** F-702 Manager dashboard (REQ-15 §15.2). Admin may pass managerId to see exactly what that Manager sees (DASH-02). */
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly metrics: DashboardMetricsService) {}

  @Get('manager')
  @RequirePermission('DASHBOARD_MANAGER')
  async manager(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    const q = DashboardQuery.parse(raw);
    return this.metrics.compute(await this.metrics.scope(actor, q), q);
  }
}
