import { CreateTelecallerBody, CreateUserBody, LifecycleBody, UserListQuery } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermission('USER_READ_ALL', 'USER_READ_TEAM')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.users.list(actor, UserListQuery.parse(raw));
  }

  @Get('users/:id')
  @RequirePermission('USER_READ_ALL', 'USER_READ_TEAM')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.users.getForActor(actor, id);
  }

  @Post('users')
  @RequirePermission('USER_CREATE_MANAGER', 'USER_CREATE_ACCOUNTS')
  @Idempotent()
  @Audited({ action: 'users.create', entityType: 'User', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.users.createByAdmin(actor, CreateUserBody.parse(raw));
  }

  @Post('telecallers')
  @RequirePermission('TELECALLER_CREATE')
  @Idempotent()
  @Audited({ action: 'telecallers.create', entityType: 'User', entityIdFrom: 'id' })
  createTelecaller(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.users.createTelecaller(actor, CreateTelecallerBody.parse(raw));
  }

  @Post('users/:id/deactivate')
  @RequirePermission('USER_DEACTIVATE_ANY', 'USER_DEACTIVATE_TEAM_TELECALLER')
  @Audited({ action: 'users.deactivate', entityType: 'User', entityIdFrom: 'params.id' })
  deactivate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.users.deactivate(actor, id, LifecycleBody.parse(raw).reason);
  }

  @Post('users/:id/reactivate')
  @RequirePermission('USER_DEACTIVATE_ANY')
  @Audited({ action: 'users.reactivate', entityType: 'User', entityIdFrom: 'params.id' })
  reactivate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.users.reactivate(actor, id, LifecycleBody.parse(raw).reason);
  }

  @Post('users/:id/sessions/revoke')
  @RequirePermission('USER_SESSIONS_REVOKE')
  @Audited({ action: 'users.sessions.revoke', entityType: 'User', entityIdFrom: 'params.id' })
  revoke(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.users.revokeSessions(actor, id, LifecycleBody.parse(raw).reason);
  }
}
