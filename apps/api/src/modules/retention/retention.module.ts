import { Module } from '@nestjs/common';

import { MaintenanceModule } from '../maintenance/maintenance.module';

import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

@Module({ imports: [MaintenanceModule], controllers: [RetentionController], providers: [RetentionService], exports: [RetentionService] })
export class RetentionModule {}
