import { Module } from '@nestjs/common';

import { TrainingContentController } from './training-content.controller';
import { TrainingContentService } from './training-content.service';
import { TrainingLearnerController } from './training-learner.controller';
import { TrainingLearnerService } from './training-learner.service';

@Module({
  controllers: [TrainingContentController, TrainingLearnerController],
  providers: [TrainingContentService, TrainingLearnerService],
  exports: [TrainingContentService, TrainingLearnerService],
})
export class TrainingModule {}
