import { BankReferenceBody, CreateLeadDraftBody, LeadDeclarationsBody, LeadDetailsBody, LeadEmploymentBody, LeadIncomeBody, LeadListQuery, LeadMobileBody, LeadPanBody, LeadPincodeBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequireGates, RequirePermission } from '../../common/decorators';

import { LeadsService } from './leads.service';

/** F-406 drafts + submit, F-407 link initiation + bank reference, lead reads (scoped). */
@Controller('leads')
export class LeadsController {
  constructor(private readonly svc: LeadsService) {}

  @Get('declarations')
  @RequirePermission('LEAD_CREATE', 'LEAD_READ_ALL')
  declarations() {
    return this.svc.declarations();
  }

  @Get('drafts')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  drafts(@CurrentActor() actor: Actor) {
    return this.svc.listDrafts(actor);
  }

  @Post('drafts')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  @Idempotent()
  @Audited({ action: 'leadDraft.create', entityType: 'LeadDraft', entityIdFrom: 'id' })
  createDraft(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.createDraft(actor, CreateLeadDraftBody.parse(raw).cardId);
  }

  @Get('drafts/:id')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  draft(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.viewDraft(actor, id);
  }

  @Patch('drafts/:id/mobile')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  mobile(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepMobile(actor, id, LeadMobileBody.parse(raw));
  }

  @Patch('drafts/:id/details')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  details(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepDetails(actor, id, LeadDetailsBody.parse(raw));
  }

  @Patch('drafts/:id/pan')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  @Audited({ action: 'leadDraft.pan', entityType: 'LeadDraft', entityIdFrom: 'id' })
  pan(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepPan(actor, id, LeadPanBody.parse(raw));
  }

  @Patch('drafts/:id/pincode')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  pincode(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepPincode(actor, id, LeadPincodeBody.parse(raw));
  }

  @Patch('drafts/:id/employment')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  employment(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepEmployment(actor, id, LeadEmploymentBody.parse(raw));
  }

  @Patch('drafts/:id/income')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  income(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepIncome(actor, id, LeadIncomeBody.parse(raw));
  }

  @Patch('drafts/:id/declarations')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  @Audited({ action: 'leadDraft.declarations', entityType: 'LeadDraft', entityIdFrom: 'id' })
  declarationsStep(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.stepDeclarations(actor, id, LeadDeclarationsBody.parse(raw));
  }

  @Post('drafts/:id/submit')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  @Idempotent()
  @Audited({ action: 'lead.create', entityType: 'Lead', entityIdFrom: 'id' })
  submit(@CurrentActor() actor: Actor, @Param('id') id: string, @Req() req: Request) {
    return this.svc.submit(actor, id, req.header('idempotency-key') as string);
  }

  @Get('filters')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  filters(@CurrentActor() actor: Actor) {
    return this.svc.filterOptions(actor);
  }

  @Get()
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  list(@CurrentActor() actor: Actor, @Query() raw: unknown) {
    return this.svc.list(actor, LeadListQuery.parse(raw));
  }

  @Get(':id')
  @RequirePermission('LEAD_READ_OWN', 'LEAD_READ_TEAM', 'LEAD_READ_ALL')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.detail(actor, id);
  }

  @Post(':id/link/share')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  @Idempotent()
  @Audited({ action: 'lead.linkShare', entityType: 'LeadLinkInitiation', entityIdFrom: 'id' })
  linkShare(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.linkInitiation(actor, id, 'SHARED');
  }

  @Post(':id/link/open')
  @RequirePermission('LEAD_CREATE')
  @RequireGates('onboarding')
  @Idempotent()
  @Audited({ action: 'lead.linkOpen', entityType: 'LeadLinkInitiation', entityIdFrom: 'id' })
  linkOpen(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.linkInitiation(actor, id, 'OPENED');
  }

  @Post(':id/bank-reference')
  @RequirePermission('LEAD_BANK_REFERENCE_ENTER')
  @Idempotent()
  @Audited({ action: 'lead.bankReference', entityType: 'Lead', entityIdFrom: 'id' })
  bankReference(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.setBankReference(actor, id, BankReferenceBody.parse(raw));
  }
}
