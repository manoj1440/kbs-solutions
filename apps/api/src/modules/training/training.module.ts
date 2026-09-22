import { Module } from '@nestjs/common';

import { TrainingContentController } from './training-content.controller';
import { TrainingContentService } from './training-content.service';

@Module({ controllers: [TrainingContentController], providers: [TrainingContentService], exports: [TrainingContentService] })
export class TrainingModule {}
