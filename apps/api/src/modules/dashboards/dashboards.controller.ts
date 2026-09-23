import { DashboardQuery } from '@kbs/shared';
import { Controller, Get, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CurrentActor, RequirePermission } from '../../common/decorators';

import { AdminDashboardsService } from './admin-dashboards.service';
import { DashboardMetricsService } from './dashboard-metrics.service';

/** F-702 Manager dashboard (REQ-15 §15.2). Admin may pass managerId to see exactly what that Manager sees (DASH-02). */
@Controller('dashboards')
export class DashboardsController {
  constructor(
    private readonly metrics: DashboardMetricsService,
    private readonly admin: AdminDashboardsService,
  ) {}

  @Get('manager')
  @RequirePermission('DASHBOARD_MANAGER')
  async manager(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    const q = DashboardQuery.parse(raw);
    return this.metrics.compute(await this.metrics.scope(actor, q), q);
  }

  // ── F-703 Admin dashboards ──
  @Get('admin/executive')
  @RequirePermission('DASHBOARD_ADMIN')
  executive(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.admin.executive(actor, DashboardQuery.parse(raw));
  }

  @Get('admin/telecallers')
  @RequirePermission('DASHBOARD_ADMIN')
  telecallers(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.admin.telecallers(actor, DashboardQuery.parse(raw));
  }

  @Get('admin/managers')
  @RequirePermission('DASHBOARD_ADMIN')
  managers(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.admin.managers(actor, DashboardQuery.parse(raw));
  }

  @Get('admin/advisors')
  @RequirePermission('DASHBOARD_ADMIN')
  advisors(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.admin.advisors(actor, DashboardQuery.parse(raw));
  }

  @Get('admin/bank-card-mix')
  @RequirePermission('DASHBOARD_ADMIN')
  bankCardMix(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.admin.bankCardMix(actor, DashboardQuery.parse(raw));
  }
}
