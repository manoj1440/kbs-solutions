import { OnboardingAgentCodeBody, OnboardingBankBody, OnboardingChequeBody, OnboardingConsentBody, OnboardingIdentityCompleteBody, OnboardingPersonalBody, OnboardingReviewBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, Public, RequirePermission } from '../../common/decorators';

import { OnboardingService } from './onboarding.service';

/** F-401 Advisor onboarding (self) + Admin review. Steps are PUT (idempotent, resumable). */
@Controller()
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  /**
   * Where the identity provider (e.g. DigiLocker) sends the Advisor's browser afterwards. It carries no data and records
   * nothing — the result is read from the provider when the Advisor taps "I have completed verification" in the app.
   */
  @Public()
  @Get('onboarding/identity/return')
  identityReturn(@Res() res: Response) {
    res
      .status(200)
      .type('html')
      .set('Cache-Control', 'no-store')
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KBS Solutions</title>' +
          '<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F2EEE8;color:#171717}main{max-width:22rem;padding:2rem;text-align:center}h1{font-size:1.25rem;font-weight:600}p{color:#525252;line-height:1.5}</style></head>' +
          '<body><main><h1>Verification step finished</h1><p>Return to the KBS Solutions app and tap <strong>I have completed verification</strong>.</p></main></body></html>',
      );
  }

  @Get('onboarding/me')
  @RequirePermission('ONBOARDING_SELF')
  me(@CurrentActor() actor: Actor) {
    return this.svc.view(actor);
  }

  @Get('me/profile')
  @RequirePermission('ONBOARDING_SELF')
  profile(@CurrentActor() actor: Actor) {
    return this.svc.profileView(actor);
  }

  @Put('onboarding/me/personal')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.personal', entityType: 'User' })
  personal(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.personal(actor, OnboardingPersonalBody.parse(raw));
  }

  @Put('onboarding/me/consent')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.consent', entityType: 'User' })
  consent(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.consent(actor, OnboardingConsentBody.parse(raw));
  }

  @Post('onboarding/me/identity/start')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.identityStart', entityType: 'User' })
  identityStart(@CurrentActor() actor: Actor) {
    return this.svc.identityStart(actor);
  }

  @Post('onboarding/me/identity/complete')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.identityComplete', entityType: 'User' })
  identityComplete(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.identityComplete(actor, OnboardingIdentityCompleteBody.parse(raw));
  }

  @Put('onboarding/me/bank')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.bank', entityType: 'User' })
  bank(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.bank(actor, OnboardingBankBody.parse(raw));
  }

  @Put('onboarding/me/cheque')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.cheque', entityType: 'User' })
  cheque(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.cheque(actor, OnboardingChequeBody.parse(raw));
  }

  @Put('onboarding/me/agent-code')
  @RequirePermission('ONBOARDING_SELF')
  @Audited({ action: 'onboarding.agentCode', entityType: 'User' })
  agentCode(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.agentCode(actor, OnboardingAgentCodeBody.parse(raw ?? {}));
  }

  @Post('onboarding/me/submit')
  @RequirePermission('ONBOARDING_SELF')
  @Idempotent()
  @Audited({ action: 'onboarding.submit', entityType: 'User' })
  submit(@CurrentActor() actor: Actor) {
    return this.svc.submit(actor);
  }

  // ── Admin review ──
  @Get('onboarding/review')
  @RequirePermission('ONBOARDING_REVIEW')
  queue() {
    return this.svc.reviewQueue();
  }

  @Get('onboarding/review/:userId')
  @RequirePermission('ONBOARDING_REVIEW')
  @Audited({ action: 'onboarding.reviewView', entityType: 'User', entityIdFrom: 'userId' })
  detail(@CurrentActor() actor: Actor, @Param('userId') userId: string, @Query('reveal') reveal?: string) {
    return this.svc.reviewDetail(actor, userId, reveal === 'bank' ? 'bank' : undefined);
  }

  @Post('onboarding/review/:userId')
  @RequirePermission('ONBOARDING_REVIEW')
  @Idempotent()
  @Audited({ action: 'onboarding.review', entityType: 'User', entityIdFrom: 'userId' })
  review(@CurrentActor() actor: Actor, @Param('userId') userId: string, @Body() raw: unknown) {
    return this.svc.review(actor, userId, OnboardingReviewBody.parse(raw));
  }
}
