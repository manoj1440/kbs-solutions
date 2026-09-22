import { Module } from '@nestjs/common';

import { MisImportService } from './mis-import.service';
import { MisProfileService } from './mis-profile.service';
import { MisController } from './mis.controller';

@Module({ controllers: [MisController], providers: [MisProfileService, MisImportService], exports: [MisProfileService, MisImportService] })
export class MisModule {}
