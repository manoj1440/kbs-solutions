import { AttachPaymentProofBody, CorrectPaymentBody, PaymentCorrectionDecisionBody, PaymentExceptionResolveBody, PaymentFlagBody, RecordPaymentBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { PaymentsService } from './payments.service';

/**
 * F-605 Accounts workspace (REQ-17 §17.6–§17.7, REQ-18). Records transfers executed outside KBS —
 * there is deliberately no endpoint that moves money.
 */
@Controller('payouts')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Get('payments/queues')
  @RequirePermission('PAYMENT_QUEUE_READ')
  queues() {
    return this.svc.queues();
  }

  @Get('requests/:id/payee')
  @RequirePermission('PAYMENT_QUEUE_READ')
  payee(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('reveal') reveal?: string) {
    return this.svc.payee(actor, id, reveal === 'bank');
  }

  @Post('requests/:id/payment')
  @RequirePermission('PAYMENT_RECORD')
  @Idempotent()
  @Audited({ action: 'payment.record', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  record(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.record(actor, id, RecordPaymentBody.parse(raw));
  }

  @Post('requests/:id/payment/proof')
  @RequirePermission('PAYMENT_RECORD')
  @Idempotent()
  @Audited({ action: 'payment.proof', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  proof(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.attachProof(actor, id, AttachPaymentProofBody.parse(raw));
  }

  @Post('requests/:id/payment/correct')
  @RequirePermission('PAYMENT_RECORD')
  @Idempotent()
  @Audited({ action: 'payment.correct', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  correct(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.correct(actor, id, CorrectPaymentBody.parse(raw));
  }

  @Post('requests/:id/payment/correction-decision')
  @RequirePermission('PAYMENT_EXCEPTION_RESOLVE')
  @Idempotent()
  @Audited({ action: 'payment.correctionDecision', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  decideCorrection(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.decideCorrection(actor, id, PaymentCorrectionDecisionBody.parse(raw));
  }

  @Post('requests/:id/payment/flag')
  @RequirePermission('PAYMENT_EXCEPTION_RESOLVE')
  @Idempotent()
  @Audited({ action: 'payment.flag', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  flag(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.flag(actor, id, PaymentFlagBody.parse(raw).reason);
  }

  @Post('requests/:id/payment/resolve')
  @RequirePermission('PAYMENT_EXCEPTION_RESOLVE')
  @Idempotent()
  @Audited({ action: 'payment.resolve', entityType: 'PayoutRequest', entityIdFrom: 'params.id' })
  resolve(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.resolve(actor, id, PaymentExceptionResolveBody.parse(raw).reason);
  }
}
