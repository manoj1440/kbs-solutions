import { Module } from '@nestjs/common';

import { PayoutsModule } from '../payouts/payouts.module';

import { DataPurgeService } from './data-purge.service';
import { FollowUpDueService } from './follow-up-due.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({ imports: [PayoutsModule], controllers: [MaintenanceController], providers: [MaintenanceProcessor, FollowUpDueService, DataPurgeService], exports: [MaintenanceProcessor, FollowUpDueService, DataPurgeService] })
export class MaintenanceModule {}
