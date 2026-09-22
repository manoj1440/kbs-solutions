import { CreateFollowUpTaskBody, PendingActionsQuery, RemarkBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PendingActionsService } from './pending-actions.service';

/** F-409: pending actions, follow-up tasks and lead operational remarks. */
@Controller()
export class PendingActionsController {
  constructor(private readonly svc: PendingActionsService) {}

  @Get('pending-actions')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.list(actor, PendingActionsQuery.parse(raw));
  }

  @Post('leads/:id/follow-ups')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  @Idempotent()
  @Audited({ action: 'followUp.create', entityType: 'FollowUpTask', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.createFollowUp(actor, id, CreateFollowUpTaskBody.parse(raw));
  }

  @Post('follow-ups/:id/done')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  @Idempotent()
  @Audited({ action: 'followUp.done', entityType: 'FollowUpTask', entityIdFrom: 'params.id' })
  done(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.completeFollowUp(actor, id);
  }

  @Get('leads/:id/remarks')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  remarks(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.listRemarks(actor, id);
  }

  @Post('leads/:id/remarks')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  @Idempotent()
  @Audited({ action: 'leadRemark.add', entityType: 'OperationalRemark', entityIdFrom: 'id' })
  addRemark(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.addRemark(actor, id, RemarkBody.parse(raw));
  }
}
