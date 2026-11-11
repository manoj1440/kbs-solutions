import { Module } from '@nestjs/common';

import { PayoutsModule } from '../payouts/payouts.module';

import { FollowUpDueService } from './follow-up-due.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({ imports: [PayoutsModule], controllers: [MaintenanceController], providers: [MaintenanceProcessor, FollowUpDueService], exports: [MaintenanceProcessor, FollowUpDueService] })
export class MaintenanceModule {}
