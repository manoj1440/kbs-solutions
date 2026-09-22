import { Module } from '@nestjs/common';

import { MisImportService } from './mis-import.service';
import { MisPipelineController } from './mis-pipeline.controller';
import { MisPipelineService } from './mis-pipeline.service';
import { MisProfileService } from './mis-profile.service';
import { MisController } from './mis.controller';

@Module({ controllers: [MisController, MisPipelineController], providers: [MisProfileService, MisImportService, MisPipelineService], exports: [MisProfileService, MisImportService, MisPipelineService] })
export class MisModule {}
