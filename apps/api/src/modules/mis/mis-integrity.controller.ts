import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';

import { RequirePermission } from '../../common/decorators';

import { MisIntegrityService } from './mis-integrity.service';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SummaryQuery = z.object({ bankId: z.string().uuid().optional(), from: day.optional(), to: day.optional() });
const QuarantineQuery = z.object({ bankId: z.string().uuid().optional(), state: z.enum(['UNMATCHED', 'CONFLICT']).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(50) });

/** F-507: MIS integrity & freshness dashboard and the cross-batch quarantine list. */
@Controller('dashboards/mis-integrity')
export class MisIntegrityController {
  constructor(private readonly svc: MisIntegrityService) {}

  @Get()
  @RequirePermission('DASHBOARD_ADMIN')
  summary(@Query() raw: unknown) {
    return this.svc.summary(SummaryQuery.parse(raw));
  }

  @Get('quarantine')
  @RequirePermission('MIS_RESOLVE')
  quarantine(@Query() raw: unknown) {
    return this.svc.quarantine(QuarantineQuery.parse(raw));
  }
}
