import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AccessPolicyService } from '../../modules/access-policy/access-policy.service';
import { GatesService } from '../../modules/gates/gates.service';
import type { Actor } from '../actor';
import { GATES_KEY, type GateName } from '../decorators';
import { AppError } from '../errors/app-error';
import { RequestContextStore } from '../request-context';

/** F-111: enforces training / network / onboarding gates declared with @RequireGates (INV-09: never Advisors for network). */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly gates: GatesService,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<GateName[] | undefined>(GATES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const actor = req.actor;
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Please log in.');
    const ip = RequestContextStore.get()?.ip ?? '0.0.0.0';
    const g = await this.gates.compute(actor, ip);

    if (required.includes('training') && g.training.required && !g.training.passed) {
      const reason = g.training.reason;
      const msg =
        reason === 'DEADLINE_PASSED'
          ? 'Your training window has ended. Ask your Manager to reactivate your training.'
          : reason === 'REACTIVATION_WINDOW_NOT_CONFIGURED'
            ? 'Training was reactivated but the new window is not configured yet. Contact the Admin.'
            : `Complete Module ${g.training.currentModuleSequence ?? 1} to continue.`;
      throw new AppError('GATE_TRAINING_BLOCKED', msg, { training: g.training }, reason === 'IN_PROGRESS' ? 'COMPLETE_TRAINING' : reason === 'DEADLINE_PASSED' ? 'CONTACT_MANAGER' : 'CONTACT_ADMIN');
    }
    if (required.includes('network') && g.network.required) {
      const ev = await this.accessPolicy.evaluate(actor, ip);
      await this.accessPolicy.recordEvent(actor.userId, ip, ev, `${req.method} ${req.path}`, req.header('x-network-ssid-hint'));
      if (!ev.allowed) {
        throw new AppError(
          'GATE_NETWORK_BLOCKED',
          ev.reason === 'ALLOWLIST_EMPTY' ? 'Office network is not configured yet. Contact the Admin.' : 'Connect to the office Wi-Fi (or ask your Manager for a work-from-home exception).',
          { network: g.network },
          ev.reason === 'ALLOWLIST_EMPTY' ? 'CONTACT_ADMIN' : 'USE_OFFICE_WIFI',
        );
      }
    }
    if (required.includes('onboarding') && g.onboarding.required && !g.onboarding.complete) {
      throw new AppError('GATE_ONBOARDING_INCOMPLETE', 'Finish your onboarding to continue.', { onboarding: g.onboarding }, 'CONTINUE_ONBOARDING');
    }
    return true;
  }
}
