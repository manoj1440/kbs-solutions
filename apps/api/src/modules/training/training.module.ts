import { Module } from '@nestjs/common';

import { TrainingContentController } from './training-content.controller';
import { TrainingContentService } from './training-content.service';
import { TrainingExpiryService } from './training-expiry.service';
import { TrainingLearnerController } from './training-learner.controller';
import { TrainingLearnerService } from './training-learner.service';
import { TrainingTeamController } from './training-team.controller';
import { TrainingTeamService } from './training-team.service';
import { TrainingProcessor } from './training.processor';

@Module({
  controllers: [TrainingContentController, TrainingLearnerController, TrainingTeamController],
  providers: [TrainingContentService, TrainingLearnerService, TrainingExpiryService, TrainingTeamService, TrainingProcessor],
  exports: [TrainingContentService, TrainingLearnerService, TrainingExpiryService, TrainingTeamService],
})
export class TrainingModule {}
