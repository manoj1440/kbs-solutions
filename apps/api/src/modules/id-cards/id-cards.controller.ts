import { ReasonBody } from '@kbs/shared';
import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, Public, RequirePermission } from '../../common/decorators';

import { IdCardsService } from './id-cards.service';

/** F-312 official ID card. */
@Controller()
export class IdCardsController {
  constructor(private readonly svc: IdCardsService) {}

  @Get('id-cards/me')
  @RequirePermission('SHARE_SEND')
  me(@CurrentActor() actor: Actor) {
    return this.svc.get(actor, actor.userId);
  }

  @Get('id-cards/me.svg')
  @RequirePermission('SHARE_SEND')
  @Header('content-type', 'image/svg+xml')
  async meSvg(@CurrentActor() actor: Actor) {
    const c = await this.svc.get(actor, actor.userId);
    return c.svg ?? '<svg xmlns="http://www.w3.org/2000/svg"/>';
  }

  @Get('users/:id/id-card')
  @RequirePermission('USER_READ_TEAM', 'USER_READ_ALL')
  @Audited({ action: 'idCard.view', entityType: 'User', entityIdFrom: 'id' })
  forUser(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.get(actor, id);
  }

  @Post('users/:id/id-card/regenerate')
  @RequirePermission('USER_READ_TEAM', 'USER_READ_ALL')
  @Idempotent()
  @Audited({ action: 'idCard.regenerate', entityType: 'User', entityIdFrom: 'id' })
  regenerate(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.regenerate(actor, id, ReasonBody.parse(raw).reason);
  }

  /** Public verification page data — name, code, validity only. */
  @Public()
  @Get('verify/:publicRef')
  verify(@Param('publicRef') ref: string) {
    return this.svc.verify(ref);
  }
}
