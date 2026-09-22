import { UpdateConfigBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';

import { ConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @RequirePermission('CONFIG_READ')
  list() {
    return this.config.list();
  }

  @Get('launch-gates')
  @RequirePermission('CONFIG_READ')
  launchGates() {
    return this.config.launchGates();
  }

  @Get(':key/history')
  @RequirePermission('CONFIG_READ')
  history(@Param('key') key: string) {
    return this.config.history(key);
  }

  @Put(':key')
  @RequirePermission('CONFIG_MANAGE')
  @Audited({ action: 'config.update', entityType: 'SystemConfig', entityIdFrom: 'params.key' })
  async update(@Param('key') key: string, @Body() raw: unknown, @CurrentActor() actor: Actor) {
    const body = UpdateConfigBody.parse(raw);
    await this.config.update(key, body.value ?? null, body.reason, actor.userId);
    return { key, value: body.value ?? null };
  }
}
