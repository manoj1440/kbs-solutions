import { ApplyAgentCodeBody, CreateAgentCodeBody, ReassignReportingBody, ReasonBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission, RequireGates } from '../../common/decorators';

import { AgentCodesService } from './agent-codes.service';

@Controller()
export class AgentCodesController {
  constructor(private readonly svc: AgentCodesService) {}

  @Get('agent-codes')
  @RequirePermission('AGENT_CODE_MANAGE', 'USER_READ_TEAM', 'AGENT_CODE_SELF')
  list(@CurrentActor() actor: Actor) {
    return this.svc.list(actor);
  }

  @Post('agent-codes')
  @RequirePermission('AGENT_CODE_MANAGE')
  @Idempotent()
  @Audited({ action: 'agentCode.create', entityType: 'AgentCode', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.create(actor, CreateAgentCodeBody.parse(raw));
  }

  /** F-824: an approved Advisor's own code (created on first ask, the same one afterwards). */
  @Post('me/agent-codes')
  @RequirePermission('AGENT_CODE_SELF')
  @RequireGates('onboarding')
  @Audited({ action: 'agentCode.createOwn', entityType: 'AgentCode', entityIdFrom: 'id' })
  createOwn(@CurrentActor() actor: Actor) {
    return this.svc.createOwn(actor);
  }

  /** F-824: the Advisors who signed up with the caller's code. */
  @Get('me/team')
  @RequirePermission('AGENT_CODE_SELF')
  myTeam(@CurrentActor() actor: Actor) {
    return this.svc.myTeam(actor);
  }

  @Post('agent-codes/:id/revoke')
  @RequirePermission('AGENT_CODE_MANAGE')
  @Audited({ action: 'agentCode.revoke', entityType: 'AgentCode', entityIdFrom: 'params.id' })
  revoke(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.revoke(id, ReasonBody.parse(raw).reason);
  }

  @Get('agent-codes/validate')
  @RequirePermission('ONBOARDING_SELF')
  validate(@Query('code') code: string) {
    return this.svc.validate(code ?? '');
  }

  @Post('me/agent-code')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'hierarchy.applyCode', entityType: 'User' })
  apply(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.apply(actor, ApplyAgentCodeBody.parse(raw));
  }

  @Get('hierarchy/pending')
  @RequirePermission('HIERARCHY_APPROVE_CODE_CHANGE')
  pending() {
    return this.svc.listPending();
  }

  @Post('hierarchy/pending/:id/approve')
  @RequirePermission('HIERARCHY_APPROVE_CODE_CHANGE')
  @Audited({ action: 'hierarchy.approve', entityType: 'ReportingAssignment', entityIdFrom: 'params.id' })
  approve(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.decidePending(actor, id, 'APPROVED', ReasonBody.parse(raw).reason);
  }

  @Post('hierarchy/pending/:id/reject')
  @RequirePermission('HIERARCHY_APPROVE_CODE_CHANGE')
  @Audited({ action: 'hierarchy.reject', entityType: 'ReportingAssignment', entityIdFrom: 'params.id' })
  reject(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.decidePending(actor, id, 'REJECTED', ReasonBody.parse(raw).reason);
  }

  @Post('users/:id/reporting')
  @RequirePermission('HIERARCHY_REASSIGN')
  @Audited({ action: 'hierarchy.reassign', entityType: 'User', entityIdFrom: 'params.id' })
  reassign(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.reassign(actor, id, ReassignReportingBody.parse(raw));
  }

  @Get('users/:id/reporting-history')
  @RequirePermission('USER_READ_ALL', 'USER_READ_TEAM', 'ONBOARDING_SELF')
  history(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.history(actor, id);
  }
}
