import { CardBody, CreateBankBody, CreateCrosswalkBody, CreateLinkBody, PublishCardBody, ReasonBody, UpdateBankBody, UpdateCardBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { CatalogueService } from './catalogue.service';

const CardsQuery = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'RETIRED']).optional(), bankId: z.string().uuid().optional() });
const BanksQuery = z.object({ includeInactive: z.coerce.boolean().optional() });

/** F-403 catalogue administration. Reads are open to every role (CATALOGUE_READ); writes need CATALOGUE_MANAGE. */
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly svc: CatalogueService) {}

  @Get('banks')
  @RequirePermission('CATALOGUE_READ')
  banks(@Query() raw: unknown) {
    return this.svc.listBanks(BanksQuery.parse(raw).includeInactive);
  }

  @Post('banks')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'bank.create', entityType: 'Bank', entityIdFrom: 'id' })
  createBank(@Body() raw: unknown) {
    return this.svc.createBank(CreateBankBody.parse(raw));
  }

  @Patch('banks/:id')
  @RequirePermission('CATALOGUE_MANAGE')
  @Audited({ action: 'bank.update', entityType: 'Bank', entityIdFrom: 'id' })
  updateBank(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.updateBank(id, UpdateBankBody.parse(raw));
  }

  @Get('categories')
  @RequirePermission('CATALOGUE_READ')
  categories() {
    return this.svc.listCategories();
  }

  @Get('cards')
  @RequirePermission('CATALOGUE_READ')
  cards(@Query() raw: unknown) {
    return this.svc.listCards(CardsQuery.parse(raw));
  }

  @Post('cards')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'card.create', entityType: 'CreditCard', entityIdFrom: 'id' })
  createCard(@Body() raw: unknown) {
    return this.svc.createCard(CardBody.parse(raw));
  }

  @Get('cards/:id')
  @RequirePermission('CATALOGUE_READ')
  card(@Param('id') id: string) {
    return this.svc.getCard(id);
  }

  @Patch('cards/:id')
  @RequirePermission('CATALOGUE_MANAGE')
  @Audited({ action: 'card.update', entityType: 'CreditCard', entityIdFrom: 'id' })
  updateCard(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.updateCard(id, UpdateCardBody.parse(raw));
  }

  @Post('cards/:id/publish')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'card.publish', entityType: 'CreditCard', entityIdFrom: 'id' })
  publish(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.publishCard(actor, id, PublishCardBody.parse(raw ?? {}));
  }

  @Post('cards/:id/retire')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'card.retire', entityType: 'CreditCard', entityIdFrom: 'id' })
  retire(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.retireCard(id, ReasonBody.parse(raw).reason);
  }

  @Post('cards/:id/links')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'applicationLink.create', entityType: 'ApplicationLink', entityIdFrom: 'id' })
  addLink(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.addLink(actor, id, CreateLinkBody.parse(raw));
  }

  @Post('links/:id/end')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'applicationLink.end', entityType: 'ApplicationLink', entityIdFrom: 'id' })
  endLink(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.endLink(id, ReasonBody.parse(raw).reason);
  }

  @Get('crosswalks')
  @RequirePermission('CATALOGUE_READ')
  crosswalks(@Query('bankId') bankId?: string) {
    return this.svc.listCrosswalks(bankId || undefined);
  }

  @Post('crosswalks')
  @RequirePermission('CATALOGUE_MANAGE')
  @Idempotent()
  @Audited({ action: 'crosswalk.upsert', entityType: 'ProductCodeCrosswalk', entityIdFrom: 'id' })
  upsertCrosswalk(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.upsertCrosswalk(actor, CreateCrosswalkBody.parse(raw));
  }
}
