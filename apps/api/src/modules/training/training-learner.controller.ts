import { SubmitAttemptBody, VideoProgressBody } from '@kbs/shared';
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';

import { TrainingLearnerService } from './training-learner.service';

@Controller('training')
export class TrainingLearnerController {
  constructor(private readonly learner: TrainingLearnerService) {}

  @Get('me')
  @RequirePermission('TRAINING_TAKE')
  me(@CurrentActor() actor: Actor) {
    return this.learner.me(actor);
  }

  @Post('modules/:seq/video-progress')
  @RequirePermission('TRAINING_TAKE')
  video(@CurrentActor() actor: Actor, @Param('seq', ParseIntPipe) seq: number, @Body() raw: unknown) {
    return this.learner.videoProgress(actor, seq, VideoProgressBody.parse(raw));
  }

  @Post('modules/:seq/attempts')
  @RequirePermission('TRAINING_TAKE')
  @Audited({ action: 'training.attempt.start', entityType: 'TrainingAttempt', entityIdFrom: 'attemptId' })
  start(@CurrentActor() actor: Actor, @Param('seq', ParseIntPipe) seq: number) {
    return this.learner.startAttempt(actor, seq);
  }

  @Post('attempts/:id/submit')
  @RequirePermission('TRAINING_TAKE')
  @Audited({ action: 'training.attempt.submit', entityType: 'TrainingAttempt', entityIdFrom: 'params.id' })
  submit(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.learner.submitAttempt(actor, id, SubmitAttemptBody.parse(raw));
  }
}
