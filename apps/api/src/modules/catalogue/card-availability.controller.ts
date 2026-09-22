import { AvailableCardsQuery, BrowseCardsQuery, CreatePublicationBody, ReasonBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequireGates, RequirePermission } from '../../common/decorators';

import { CardAvailabilityService } from './card-availability.service';

/** F-308 availability + Admin card pincode publications. */
@Controller()
export class CardAvailabilityController {
  constructor(private readonly svc: CardAvailabilityService) {}

  /** F-405: Advisor-facing catalogue (published + ADVISOR link), optional pincode annotation. Onboarding gate applies to Advisors. */
  @Get('cards/browse')
  @RequirePermission('CATALOGUE_READ')
  @RequireGates('onboarding')
  browse(@Query() raw: unknown) {
    return this.svc.browse(BrowseCardsQuery.parse(raw));
  }

  /** Generic lookup (Advisor catalogue F-405 and Admin checks). Telecallers use the record-scoped route below. */
  @Get('cards/available')
  @RequirePermission('CATALOGUE_READ')
  @RequireGates('training', 'network')
  available(@Query() raw: unknown) {
    const q = AvailableCardsQuery.parse(raw);
    return this.svc.available(q.pincode, q.channel);
  }

  @Get('calling/records/:id/cards')
  @RequirePermission('CALLING_QUEUE_OWN', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  @RequireGates('training', 'network')
  forRecord(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.forCallingRecord(actor, id);
  }

  @Get('catalogue/cards/:id/publications')
  @RequirePermission('CATALOGUE_MANAGE')
  publications(@Param('id') id: string) {
    return this.svc.listPublications(id);
  }

  @Post('catalogue/cards/:id/publications')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'cardPublication.create', entityType: 'CardPincodePublication', entityIdFrom: 'id' })
  addPublication(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.addPublication(actor, id, CreatePublicationBody.parse(raw));
  }

  @Post('catalogue/publications/:id/end')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'cardPublication.end', entityType: 'CardPincodePublication', entityIdFrom: 'id' })
  endPublication(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.endPublication(id, ReasonBody.parse(raw).reason);
  }
}
