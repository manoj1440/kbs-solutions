import { timingSafeEqual } from 'node:crypto';

import { ShareBody } from '@kbs/shared';
import { Body, Controller, Get, Headers, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, Public, RequireGates, RequirePermission } from '../../common/decorators';
import { AppError } from '../../common/errors/app-error';
import { ENV, type Env } from '../../config/env';
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from '../../providers/ports';

import { SharingService } from './sharing.service';

const DeliveryBody = z.object({ providerMessageId: z.string().min(1), status: z.enum(['SENT', 'DELIVERED', 'FAILED']) });

/** F-311 WhatsApp sharing (hand-off or business API) + redirect resolver. */
@Controller()
export class SharingController {
  constructor(
    private readonly svc: SharingService,
    @Inject(ENV) private readonly env: Pick<Env, 'WHATSAPP_WEBHOOK_TOKEN'>,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: Pick<WhatsAppProvider, 'mode'>,
  ) {}

  @Post('share')
  @RequirePermission('SHARE_SEND')
  @RequireGates('training', 'network', 'onboarding')
  @Idempotent()
  @Audited({ action: 'share.send', entityType: 'ShareAction', entityIdFrom: 'shareActionId' })
  share(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.share(actor, ShareBody.parse(raw));
  }

  @Get('calling/records/:id/shares')
  @RequireGates('training', 'network') // REQ-09 §9.1: every Telecaller customer action needs the office network / WFH (no-op for other roles)
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

  /**
   * F-908 S10: the provider proves itself with `x-kbs-webhook-token` (= WHATSAPP_WEBHOOK_TOKEN). With the hand-off
   * provider, or no secret configured, the webhook does not exist (404) — nobody can forge delivery statuses.
   */
  @Public()
  @Post('webhooks/whatsapp/delivery')
  delivery(@Headers('x-kbs-webhook-token') token: string | undefined, @Body() raw: unknown) {
    const secret = this.env.WHATSAPP_WEBHOOK_TOKEN;
    if (this.whatsapp.mode !== 'BUSINESS_API' || !secret) throw AppError.notFound('Route');
    const a = Buffer.from(token ?? '');
    const b2 = Buffer.from(secret);
    if (a.length !== b2.length || !timingSafeEqual(a, b2)) throw new AppError('AUTH_REQUIRED', 'Webhook token missing or wrong.');
    const b = DeliveryBody.parse(raw);
    return this.svc.applyDelivery(b.providerMessageId, b.status);
  }
}
