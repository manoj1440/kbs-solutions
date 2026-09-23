import { NotificationListQuery, RegisterPushDeviceBody } from '@kbs/shared';
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CurrentActor, RequirePermission } from '../../common/decorators';

import { NotificationsService } from './notifications.service';

/** F-701 in-app notification centre + push device registration. Every role has NOTIFICATIONS_OWN. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @RequirePermission('NOTIFICATIONS_OWN')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.list(actor, NotificationListQuery.parse(raw));
  }

  @Get('unread-count')
  @RequirePermission('NOTIFICATIONS_OWN')
  unread(@CurrentActor() actor: Actor) {
    return this.svc.unreadCount(actor);
  }

  @Post('read-all')
  @RequirePermission('NOTIFICATIONS_OWN')
  readAll(@CurrentActor() actor: Actor) {
    return this.svc.markAllRead(actor);
  }

  @Post('push-devices')
  @RequirePermission('NOTIFICATIONS_OWN')
  register(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.registerDevice(actor, RegisterPushDeviceBody.parse(raw));
  }

  @Delete('push-devices/:token')
  @RequirePermission('NOTIFICATIONS_OWN')
  unregister(@CurrentActor() actor: Actor, @Param('token') token: string) {
    return this.svc.unregisterDevice(actor, token);
  }

  @Post(':id/read')
  @RequirePermission('NOTIFICATIONS_OWN')
  read(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.markRead(actor, id);
  }

  /** Follow a deep link: marks read and re-checks that the target is still visible to the caller. */
  @Get(':id/target')
  @RequirePermission('NOTIFICATIONS_OWN')
  target(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.target(actor, id);
  }
}
