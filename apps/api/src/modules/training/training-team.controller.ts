import { ReasonBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';

import { TrainingExpiryService } from './training-expiry.service';
import { TrainingTeamService } from './training-team.service';

@Controller()
export class TrainingTeamController {
  constructor(
    private readonly team: TrainingTeamService,
    private readonly expiry: TrainingExpiryService,
  ) {}

  @Get('training/team')
  @RequirePermission('TRAINING_PROGRESS_READ_TEAM', 'TRAINING_PROGRESS_READ_ALL')
  list(@CurrentActor() actor: Actor, @Query('managerId') managerId?: string) {
    return this.team.team(actor, managerId);
  }

  @Get('telecallers/:id/training')
  @RequirePermission('TRAINING_PROGRESS_READ_TEAM', 'TRAINING_PROGRESS_READ_ALL')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.team.detail(actor, id);
  }

  @Post('telecallers/:id/training/reactivate')
  @RequirePermission('TELECALLER_REACTIVATE_TRAINING')
  @Audited({ action: 'training.reactivate', entityType: 'User', entityIdFrom: 'params.id' })
  reactivate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.expiry.reactivate(actor, id, ReasonBody.parse(raw).reason);
  }

  /** Admin-triggered sweep (the same job runs every 5 minutes in worker mode). */
  @Post('training/sweep')
  @RequirePermission('TRAINING_CONTENT_MANAGE')
  @Audited({ action: 'training.sweep' })
  sweep() {
    return this.expiry.sweep();
  }
}
