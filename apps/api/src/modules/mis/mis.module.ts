import { Module } from '@nestjs/common';

import { PayoutsModule } from '../payouts/payouts.module';

import { MisImportService } from './mis-import.service';
import { MisIntegrityController } from './mis-integrity.controller';
import { MisIntegrityService } from './mis-integrity.service';
import { MisPipelineController } from './mis-pipeline.controller';
import { MisPipelineService } from './mis-pipeline.service';
import { MisProfileService } from './mis-profile.service';
import { MisController } from './mis.controller';

@Module({ imports: [PayoutsModule], controllers: [MisController, MisPipelineController, MisIntegrityController], providers: [MisProfileService, MisImportService, MisPipelineService, MisIntegrityService], exports: [MisProfileService, MisImportService, MisPipelineService, MisIntegrityService] })
export class MisModule {}
