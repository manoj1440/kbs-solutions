import { MisResolveBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { MisPipelineService } from './mis-pipeline.service';

/** F-503 preview, F-504 resolution, F-505 apply. */
@Controller()
export class MisPipelineController {
  constructor(private readonly svc: MisPipelineService) {}

  @Post('mis/batches/:id/preview')
  @RequirePermission('MIS_IMPORT')
  @Audited({ action: 'misBatch.preview', entityType: 'MisImportBatch', entityIdFrom: 'params.id' })
  preview(@Param('id') id: string) {
    return this.svc.preview(id);
  }

  @Post('mis/batches/:id/apply')
  @RequirePermission('MIS_IMPORT')
  @Idempotent()
  @Audited({ action: 'misBatch.apply', entityType: 'MisImportBatch', entityIdFrom: 'params.id' })
  apply(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.apply(actor, id);
  }

  @Post('mis/rows/:id/resolve')
  @RequirePermission('MIS_RESOLVE')
  @Idempotent()
  @Audited({ action: 'misRow.resolve', entityType: 'MisRow', entityIdFrom: 'params.id' })
  resolve(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.resolve(actor, id, MisResolveBody.parse(raw));
  }

  @Get('leads/:id/mis-history')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  history(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.leadHistory(actor, id);
  }
}
