import { DataRequestCreateBody, DataRequestListQuery, DataRequestUpdateBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PrivacyService } from './privacy.service';

const IdParam = z.string().uuid();

/**
 * F-908 data-principal rights. No `@RequireGates`: a pending Advisor, a Telecaller outside the office network or one
 * whose training lapsed must still be able to ask for their data or for deletion.
 */
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly svc: PrivacyService) {}

  @Post('requests')
  @RequirePermission('PRIVACY_REQUEST_CREATE')
  @Idempotent()
  @Audited({ action: 'privacy.request.create', entityType: 'DataRequest', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.create(actor, DataRequestCreateBody.parse(raw));
  }

  @Get('requests/mine')
  @RequirePermission('PRIVACY_REQUEST_CREATE')
  mine(@CurrentActor() actor: Actor) {
    return this.svc.mine(actor);
  }

  /** The caller's own data as JSON (masked). Audited: every download leaves a trace. */
  @Get('me/export')
  @RequirePermission('PRIVACY_REQUEST_CREATE')
  @Audited({ action: 'privacy.export', entityType: 'User' })
  export(@CurrentActor() actor: Actor) {
    return this.svc.exportMine(actor);
  }

  @Get('requests')
  @RequirePermission('PRIVACY_REQUEST_MANAGE')
  list(@Query() raw: unknown) {
    return this.svc.list(DataRequestListQuery.parse(raw));
  }

  @Get('requests/:id')
  @RequirePermission('PRIVACY_REQUEST_MANAGE')
  get(@Param('id') id: string) {
    return this.svc.get(IdParam.parse(id));
  }

  @Patch('requests/:id')
  @RequirePermission('PRIVACY_REQUEST_MANAGE')
  @Audited({ action: 'privacy.request.update', entityType: 'DataRequest', entityIdFrom: 'params.id' })
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.update(actor, IdParam.parse(id), DataRequestUpdateBody.parse(raw));
  }
}
