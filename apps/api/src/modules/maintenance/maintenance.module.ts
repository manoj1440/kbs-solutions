import { Module } from '@nestjs/common';

import { PayoutsModule } from '../payouts/payouts.module';

import { MaintenanceController } from './maintenance.controller';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({ imports: [PayoutsModule], controllers: [MaintenanceController], providers: [MaintenanceProcessor], exports: [MaintenanceProcessor] })
export class MaintenanceModule {}
