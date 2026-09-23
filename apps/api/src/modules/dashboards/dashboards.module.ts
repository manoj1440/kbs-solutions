import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardsController } from './dashboards.controller';

/** F-702/F-703 dashboards — one metric engine for every role (DASH-02). */
@Module({ imports: [UsersModule], controllers: [DashboardsController], providers: [DashboardMetricsService], exports: [DashboardMetricsService] })
export class DashboardsModule {}
