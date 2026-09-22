import type { Gates } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AccessPolicyService } from '../access-policy/access-policy.service';

/**
 * F-111: gates computed from persisted state at request time (ADR-004). Jobs only materialise
 * side effects; they are never the source of truth for whether access is allowed.
 */
@Injectable()
export class GatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  async compute(actor: Pick<Actor, 'userId' | 'role' | 'status'>, ip: string): Promise<Gates> {
    const [training, network, onboarding] = await Promise.all([this.training(actor), this.accessPolicy.evaluate(actor, ip), this.onboarding(actor)]);
    const active = actor.status === 'ACTIVE' || actor.status === 'PENDING_ONBOARDING';
    return {
      account: { active, reason: active ? null : actor.status },
      training,
      network: { required: network.required, allowed: network.allowed, reason: network.required ? network.reason : null },
      onboarding,
    };
  }

  private async training(actor: Pick<Actor, 'userId' | 'role'>): Promise<Gates['training']> {
    if (actor.role !== 'TELECALLER') return { required: false, passed: true, status: null, deadlineAt: null, currentModuleSequence: null, reason: null };
    const e = await this.prisma.client.trainingEnrollment.findUnique({ where: { telecallerUserId: actor.userId } });
    if (!e) return { required: true, passed: false, status: 'NOT_STARTED', deadlineAt: null, currentModuleSequence: 1, reason: 'NOT_ENROLLED' };
    const now = Date.now();
    const passed = e.status === 'PASSED';
    // Lazy evaluation: an elapsed deadline blocks even if the sweep job has not run yet.
    const deadlinePassed = !passed && e.deadlineAt !== null && e.deadlineAt.getTime() < now;
    const reactivatedWithoutWindow = e.status === 'REACTIVATED_IN_PROGRESS' && e.deadlineAt === null;
    let reason: string | null = null;
    if (!passed) {
      if (e.status === 'EXPIRED_DEACTIVATED' || deadlinePassed) reason = 'DEADLINE_PASSED';
      else if (reactivatedWithoutWindow) reason = 'REACTIVATION_WINDOW_NOT_CONFIGURED';
      else reason = 'IN_PROGRESS';
    }
    return {
      required: true,
      passed: passed && !deadlinePassed,
      status: deadlinePassed && e.status !== 'EXPIRED_DEACTIVATED' ? 'EXPIRED_DEACTIVATED' : e.status,
      deadlineAt: e.deadlineAt?.toISOString() ?? null,
      currentModuleSequence: e.currentModuleSequence,
      reason,
    };
  }

  private async onboarding(actor: Pick<Actor, 'userId' | 'role'>): Promise<Gates['onboarding']> {
    if (actor.role !== 'ADVISOR') return { required: false, complete: true, step: null };
    const p = await this.prisma.client.advisorProfile.findUnique({ where: { userId: actor.userId }, select: { onboardingStep: true } });
    const step = p?.onboardingStep ?? 'PERSONAL';
    return { required: true, complete: step === 'COMPLETE', step };
  }
}
