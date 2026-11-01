import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';

import { TrainingContentController } from './training-content.controller';
import { TrainingContentService } from './training-content.service';
import { TrainingExpiryService } from './training-expiry.service';
import { TrainingLearnerController } from './training-learner.controller';
import { TrainingLearnerService } from './training-learner.service';
import { TrainingTeamController } from './training-team.controller';
import { TrainingTeamService } from './training-team.service';
import { TrainingProcessor } from './training.processor';

@Module({
  imports: [CallingListModule],
  controllers: [TrainingContentController, TrainingLearnerController, TrainingTeamController],
  providers: [TrainingContentService, TrainingLearnerService, TrainingExpiryService, TrainingTeamService, TrainingProcessor],
  exports: [TrainingContentService, TrainingLearnerService, TrainingExpiryService, TrainingTeamService],
})
export class TrainingModule {}
