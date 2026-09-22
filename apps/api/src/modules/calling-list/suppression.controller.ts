import { PaginationQuery, ReasonBody, SuppressionReason } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { SuppressionService } from './suppression.service';

const AddBody = z.object({ mobile: z.string().min(10).max(16), reason: z.enum(['CUSTOMER_REQUEST', 'COMPLIANCE', 'DND_LIST']).default('COMPLIANCE') });
const ImportBody = z.object({ fileId: z.string().uuid() });
const ListQuery = PaginationQuery.extend({ includeLifted: z.coerce.boolean().optional() });

@Controller('suppressions')
export class SuppressionController {
  constructor(private readonly svc: SuppressionService) {}

  @Get()
  @RequirePermission('SUPPRESSION_MANAGE')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    const q = ListQuery.parse(raw);
    return this.svc.list(actor, q.page, q.pageSize, q.includeLifted);
  }

  @Post()
  @RequirePermission('SUPPRESSION_MANAGE')
  @Idempotent()
  @Audited({ action: 'suppression.add', entityType: 'ContactSuppression', entityIdFrom: 'id' })
  add(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    const b = AddBody.parse(raw);
    return this.svc.add(actor, b.mobile, b.reason as SuppressionReason);
  }

  @Post('import')
  @RequirePermission('SUPPRESSION_MANAGE')
  @Idempotent()
  @Audited({ action: 'suppression.import', entityType: 'StoredFile' })
  importDnd(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.importDnd(actor, ImportBody.parse(raw).fileId);
  }

  @Post(':id/lift')
  @RequirePermission('SUPPRESSION_MANAGE')
  @Audited({ action: 'suppression.lift', entityType: 'ContactSuppression', entityIdFrom: 'params.id' })
  lift(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.lift(actor, id, ReasonBody.parse(raw).reason);
  }
}
