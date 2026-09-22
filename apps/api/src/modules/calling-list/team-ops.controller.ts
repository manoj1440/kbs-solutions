import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { CurrentActor, RequirePermission } from '../../common/decorators';

import { TeamOpsService } from './team-ops.service';

const RangeQuery = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });

function range(q: { from?: string; to?: string }) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 7 * 24 * 3600_000);
  if (from > to) throw new Error('from must be before to');
  return { from, to };
}

/** F-313 team operations (Manager team / Admin all). */
@Controller('calling/team')
export class TeamOpsController {
  constructor(private readonly svc: TeamOpsService) {}

  @Get('overview')
  @RequirePermission('CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  overview(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.overview(actor, range(RangeQuery.parse(raw)));
  }

  @Get('telecallers/:id/activity')
  @RequirePermission('CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  activity(@CurrentActor() actor: Actor, @Param('id') id: string, @Query() raw: unknown) {
    return this.svc.activity(actor, id, range(RangeQuery.parse(raw)));
  }
}
