import { ReplaceQuestionsBody, UpdateModuleBody } from '@kbs/shared';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';

import { TrainingContentService } from './training-content.service';

@Controller('training/modules')
export class TrainingContentController {
  constructor(private readonly content: TrainingContentService) {}

  @Get()
  @RequirePermission('TRAINING_CONTENT_MANAGE', 'TRAINING_PROGRESS_READ_TEAM', 'TRAINING_TAKE')
  list(@CurrentActor() actor: Actor) {
    return this.content.list(actor);
  }

  @Get(':seq')
  @RequirePermission('TRAINING_CONTENT_MANAGE', 'TRAINING_PROGRESS_READ_TEAM')
  get(@CurrentActor() actor: Actor, @Param('seq', ParseIntPipe) seq: number) {
    return this.content.get(actor, seq, { includeAnswers: actor.role === 'ADMIN' });
  }

  @Put(':seq')
  @RequirePermission('TRAINING_CONTENT_MANAGE')
  @Audited({ action: 'training.module.update', entityType: 'TrainingModule', entityIdFrom: 'id' })
  update(@Param('seq', ParseIntPipe) seq: number, @Body() raw: unknown) {
    return this.content.update(seq, UpdateModuleBody.parse(raw));
  }

  @Put(':seq/questions')
  @RequirePermission('TRAINING_CONTENT_MANAGE')
  @Audited({ action: 'training.module.questions', entityType: 'TrainingModule', entityIdFrom: 'moduleId' })
  questions(@Param('seq', ParseIntPipe) seq: number, @Body() raw: unknown) {
    return this.content.replaceQuestions(seq, ReplaceQuestionsBody.parse(raw));
  }

  @Post(':seq/publish')
  @RequirePermission('TRAINING_CONTENT_MANAGE')
  @Audited({ action: 'training.module.publish', entityType: 'TrainingModule', entityIdFrom: 'id' })
  publish(@CurrentActor() actor: Actor, @Param('seq', ParseIntPipe) seq: number) {
    return this.content.publish(actor, seq);
  }
}
