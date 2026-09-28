import { CreateMisBatchBody, MisApplicationsQuery, MisBatchListQuery, MisRowsQuery, ReasonBody, UpdateMisProfileBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { MisImportService } from './mis-import.service';
import { MisProfileService } from './mis-profile.service';

const AckBody = z.object({ values: z.record(z.string(), z.array(z.string())), reason: z.string().min(3).max(500) });

/** F-501 profiles + F-502 upload/parse/map. Matching/preview/apply live in mis-pipeline.controller (F-503–F-505). */
@Controller('mis')
export class MisController {
  constructor(
    private readonly profiles: MisProfileService,
    private readonly imports: MisImportService,
  ) {}

  @Get('profiles')
  @RequirePermission('MIS_PROFILE_MANAGE', 'MIS_IMPORT')
  profilesList(@Query('bankId') bankId?: string) {
    return this.profiles.list(bankId || undefined);
  }

  @Get('profiles/:id')
  @RequirePermission('MIS_PROFILE_MANAGE', 'MIS_IMPORT')
  profile(@Param('id') id: string) {
    return this.profiles.get(id);
  }

  @Patch('profiles/:id')
  @RequirePermission('MIS_PROFILE_MANAGE')
  @Audited({ action: 'misProfile.update', entityType: 'MisImportProfile', entityIdFrom: 'id' })
  updateProfile(@Param('id') id: string, @Body() raw: unknown) {
    return this.profiles.update(id, UpdateMisProfileBody.parse(raw));
  }

  @Post('profiles/:id/approve')
  @RequirePermission('MIS_PROFILE_MANAGE')
  @Idempotent()
  @Audited({ action: 'misProfile.approve', entityType: 'MisImportProfile', entityIdFrom: 'id' })
  approve(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.profiles.approve(actor, id, ReasonBody.parse(raw).reason);
  }

  @Post('profiles/:id/known-values')
  @RequirePermission('MIS_PROFILE_MANAGE')
  @Audited({ action: 'misProfile.acknowledgeValues', entityType: 'MisImportProfile', entityIdFrom: 'id' })
  ack(@Param('id') id: string, @Body() raw: unknown) {
    const b = AckBody.parse(raw);
    return this.profiles.acknowledgeValues(id, b.values, b.reason);
  }

  @Get('batches')
  @RequirePermission('MIS_IMPORT')
  batches(@Query() raw: unknown) {
    return this.imports.list(MisBatchListQuery.parse(raw));
  }

  /** F-809: cumulative applications list — the business view of what banks have reported. */
  @Get('applications')
  @RequirePermission('MIS_IMPORT')
  applications(@Query() raw: unknown) {
    return this.imports.applications(MisApplicationsQuery.parse(raw));
  }

  @Get('applications/summary')
  @RequirePermission('MIS_IMPORT')
  applicationsSummary() {
    return this.imports.applicationsSummary();
  }

  @Post('batches')
  @RequirePermission('MIS_IMPORT')
  @Idempotent()
  @Audited({ action: 'misBatch.create', entityType: 'MisImportBatch', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.imports.create(actor, CreateMisBatchBody.parse(raw));
  }

  @Get('batches/:id')
  @RequirePermission('MIS_IMPORT')
  batch(@Param('id') id: string) {
    return this.imports.get(id);
  }

  @Get('batches/:id/rows')
  @RequirePermission('MIS_IMPORT')
  rows(@CurrentActor() actor: Actor, @Param('id') id: string, @Query() raw: unknown) {
    return this.imports.rows(actor, id, MisRowsQuery.parse(raw));
  }

  @Post('batches/:id/reject')
  @RequirePermission('MIS_IMPORT')
  @Idempotent()
  @Audited({ action: 'misBatch.reject', entityType: 'MisImportBatch', entityIdFrom: 'id' })
  reject(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.imports.reject(actor, id, ReasonBody.parse(raw).reason);
  }
}
