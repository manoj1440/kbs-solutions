import { Module } from '@nestjs/common';

import { MaintenanceModule } from '../maintenance/maintenance.module';
import { PayoutsModule } from '../payouts/payouts.module';

import { MisImportService } from './mis-import.service';
import { MisIntegrityController } from './mis-integrity.controller';
import { MisIntegrityService } from './mis-integrity.service';
import { MisJobsService } from './mis-jobs.service';
import { MisPipelineController } from './mis-pipeline.controller';
import { MisPipelineService } from './mis-pipeline.service';
import { MisProfileService } from './mis-profile.service';
import { MisController } from './mis.controller';

@Module({ imports: [PayoutsModule, MaintenanceModule], controllers: [MisController, MisPipelineController, MisIntegrityController], providers: [MisProfileService, MisImportService, MisPipelineService, MisIntegrityService, MisJobsService], exports: [MisProfileService, MisImportService, MisPipelineService, MisIntegrityService] })
export class MisModule {}
