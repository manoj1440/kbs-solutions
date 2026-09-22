import { ShareBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, Public, RequireGates, RequirePermission } from '../../common/decorators';

import { SharingService } from './sharing.service';

const DeliveryBody = z.object({ providerMessageId: z.string().min(1), status: z.enum(['SENT', 'DELIVERED', 'FAILED']) });

/** F-311 WhatsApp sharing (hand-off or business API) + redirect resolver. */
@Controller()
export class SharingController {
  constructor(private readonly svc: SharingService) {}

  @Post('share')
  @RequirePermission('SHARE_SEND')
  @RequireGates('training', 'network', 'onboarding')
  @Idempotent()
  @Audited({ action: 'share.send', entityType: 'ShareAction', entityIdFrom: 'shareActionId' })
  share(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.share(actor, ShareBody.parse(raw));
  }

  @Get('calling/records/:id/shares')
  @RequirePermission('CALLING_QUEUE_OWN', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  shares(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.svc.listForRecord(actor, id);
  }

  /** Customer-facing redirect for PDFs / ID cards shared over WhatsApp. */
  @Public()
  @Get('r/:token')
  async redirect(@Param('token') token: string, @Res() res: Response) {
    const url = await this.svc.resolveRedirect(token);
    res.redirect(302, url);
  }

  @Public()
  @Post('webhooks/whatsapp/delivery')
  delivery(@Body() raw: unknown) {
    const b = DeliveryBody.parse(raw);
    return this.svc.applyDelivery(b.providerMessageId, b.status);
  }
}
