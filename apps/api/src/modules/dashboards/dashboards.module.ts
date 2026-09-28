import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';
import { LeadsModule } from '../leads/leads.module';
import { MisModule } from '../mis/mis.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { UsersModule } from '../users/users.module';

import { AdminDashboardsService } from './admin-dashboards.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardsController } from './dashboards.controller';

/** F-702/F-703 dashboards — one metric engine for every role (DASH-02). */
@Module({ imports: [UsersModule, PayoutsModule, CallingListModule, MisModule, LeadsModule], controllers: [DashboardsController], providers: [DashboardMetricsService, AdminDashboardsService], exports: [DashboardMetricsService] })
export class DashboardsModule {}
