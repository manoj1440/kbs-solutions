import { PaginationQuery } from '@kbs/shared';
import { Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CurrentActor, RequirePermission } from '../../common/decorators';

import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @RequirePermission('NOTIFICATIONS_OWN')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    const q = PaginationQuery.parse(raw);
    return this.svc.list(actor, q.page, q.pageSize);
  }

  @Post(':id/read')
  @RequirePermission('NOTIFICATIONS_OWN')
  read(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.markRead(actor, id);
  }
}
