import { PaginationQuery } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';

import { AccessPolicyService } from './access-policy.service';

const AddNetworkBody = z.object({ label: z.string().min(2).max(80), cidr: z.string().min(7).max(64), reason: z.string().min(3).max(500) });
const ActiveBody = z.object({ active: z.boolean(), reason: z.string().min(3).max(500) });
const GrantWfhBody = z.object({
  telecallerUserId: z.string().uuid(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  reason: z.string().min(3).max(500),
});
const ReasonBody = z.object({ reason: z.string().min(3).max(500) });
const EventsQuery = PaginationQuery.extend({ userId: z.string().uuid().optional(), outcome: z.enum(['DENIED', 'ALLOWED_OFFICE', 'ALLOWED_WFH']).optional() });

@Controller('access-policy')
export class AccessPolicyController {
  constructor(private readonly svc: AccessPolicyService) {}

  @Get('networks')
  @RequirePermission('NETWORK_POLICY_MANAGE')
  listNetworks() {
    return this.svc.listNetworks();
  }

  @Post('networks')
  @RequirePermission('NETWORK_POLICY_MANAGE')
  @Audited({ action: 'network.add', entityType: 'OfficeNetwork', entityIdFrom: 'id' })
  addNetwork(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    const b = AddNetworkBody.parse(raw);
    return this.svc.addNetwork(actor, b);
  }

  @Post('networks/:id/active')
  @RequirePermission('NETWORK_POLICY_MANAGE')
  @Audited({ action: 'network.setActive', entityType: 'OfficeNetwork', entityIdFrom: 'params.id' })
  setActive(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.setNetworkActive(id, ActiveBody.parse(raw).active);
  }

  @Get('wfh')
  @RequirePermission('WFH_GRANT_TEAM', 'WFH_GRANT_ANY')
  listWfh(@CurrentActor() actor: Actor) {
    return this.svc.listWfh(actor);
  }

  @Post('wfh')
  @RequirePermission('WFH_GRANT_TEAM', 'WFH_GRANT_ANY')
  @Audited({ action: 'wfh.grant', entityType: 'WfhException', entityIdFrom: 'id' })
  grant(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    const b = GrantWfhBody.parse(raw);
    return this.svc.grantWfh(actor, { telecallerUserId: b.telecallerUserId, startsAt: b.startsAt ?? new Date(), endsAt: b.endsAt ?? null, reason: b.reason });
  }

  @Post('wfh/:id/revoke')
  @RequirePermission('WFH_GRANT_TEAM', 'WFH_GRANT_ANY')
  @Audited({ action: 'wfh.revoke', entityType: 'WfhException', entityIdFrom: 'params.id' })
  revoke(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.revokeWfh(actor, id, ReasonBody.parse(raw).reason);
  }

  /** REQ-09 §9.1 / REQ-16 §16.2: who, where from, outcome. Admin: everyone; Manager: own Telecallers. */
  @Get('events')
  @RequirePermission('WFH_GRANT_TEAM', 'WFH_GRANT_ANY', 'NETWORK_POLICY_MANAGE')
  events(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.listEvents(actor, EventsQuery.parse(raw));
  }
}
