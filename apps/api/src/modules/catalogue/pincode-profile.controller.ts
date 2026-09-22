import { CreatePincodeBatchBody, PaginationQuery, UpdatePincodeProfileBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PincodeProfileService } from './pincode-profile.service';

const RowsQuery = PaginationQuery.extend({ pincode: z.string().regex(/^\d{6}$/).optional() });

/** F-404 bank pincode profiles + batch import + raw-row explorer. */
@Controller()
export class PincodeProfileController {
  constructor(private readonly svc: PincodeProfileService) {}

  @Get('pincode-profiles')
  @RequirePermission('PINCODE_PROFILE_MANAGE', 'CATALOGUE_READ')
  list() {
    return this.svc.list();
  }

  @Get('pincode-profiles/:id')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Patch('pincode-profiles/:id')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  @Audited({ action: 'pincodeProfile.update', entityType: 'BankPincodeProfile', entityIdFrom: 'id' })
  update(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.update(id, UpdatePincodeProfileBody.parse(raw));
  }

  @Post('pincode-profiles/:id/approve')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  @Idempotent()
  @Audited({ action: 'pincodeProfile.approve', entityType: 'BankPincodeProfile', entityIdFrom: 'id' })
  approve(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.approve(actor, id);
  }

  @Post('pincode-profiles/:id/batches')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  @Idempotent()
  @Audited({ action: 'pincodeBatch.create', entityType: 'BankPincodeBatch', entityIdFrom: 'id' })
  createBatch(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.createBatch(actor, id, CreatePincodeBatchBody.parse(raw));
  }

  @Get('pincode-batches/:id')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  batch(@Param('id') id: string) {
    return this.svc.batch(id);
  }

  @Post('pincode-batches/:id/confirm')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  @Idempotent()
  @Audited({ action: 'pincodeBatch.confirm', entityType: 'BankPincodeBatch', entityIdFrom: 'id' })
  confirm(@Param('id') id: string) {
    return this.svc.confirmBatch(id);
  }

  /** Raw view of imported rows — audited read (REQ-07 §7.3 "row explorer with raw view (audited)"). */
  @Get('pincode-batches/:id/rows')
  @RequirePermission('PINCODE_PROFILE_MANAGE')
  @Audited({ action: 'pincodeBatch.rowsViewed', entityType: 'BankPincodeBatch' })
  rows(@Param('id') id: string, @Query() raw: unknown) {
    const q = RowsQuery.parse(raw);
    return this.svc.rows(id, q.page, q.pageSize, q.pincode);
  }

  @Get('sourceability/:pincode')
  @RequirePermission('CATALOGUE_READ')
  sourceability(@Param('pincode') pincode: string) {
    return this.svc.sourceability(pincode);
  }
}
