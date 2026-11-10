import { type BankReferenceBody, maskMobile } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';

import { countStages, emptyStageCounts, interestStage, STAGE_SELECT } from './interest-stage';
import { type DateRange, TeamOpsService } from './team-ops.service';

const include = {
  card: { select: { id: true, name: true, bank: { select: { id: true, code: true, displayName: true } } } },
  callingRecord: { select: { id: true, fullName: true, mobile: true } },
  telecaller: { select: { id: true, fullName: true } },
  bankStatus: true,
} as const;

/**
 * A21: a Telecaller "lead" is a `CallingInterest` (B6). After the customer applies, the Telecaller types the bank application
 * number; MIS apply then matches it exactly (INV-08) and writes `CallingBankStatus` (INV-01). Nothing here touches payouts (INV-05).
 */
@Injectable()
export class InterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamOps: TeamOpsService,
  ) {}

  private scopeWhere(actor: Actor) {
    if (actor.role === 'ADMIN') return {};
    if (actor.role === 'MANAGER') return { telecallerUserId: { in: actor.teamUserIds } };
    return { telecallerUserId: actor.userId };
  }

  private view(i: Awaited<ReturnType<typeof this.load>>[number]) {
    const s = i.bankStatus;
    return {
      id: i.id,
      at: i.at.toISOString(),
      telecaller: i.telecaller,
      customer: { id: i.callingRecord.id, fullName: i.callingRecord.fullName, mobileMasked: maskMobile(i.callingRecord.mobile) },
      card: { id: i.card.id, name: i.card.name },
      bank: i.card.bank,
      reference: i.bankReferenceValue ? { kind: i.bankReferenceKind, value: i.bankReferenceValue, enteredAt: i.bankReferenceAt?.toISOString() ?? null, verified: i.bankReferenceVerified } : null,
      stage: interestStage(i),
      // bank values exactly as the MIS reported them; null = not reported (INV-02)
      bankStatus: s
        ? { provenance: 'BANK_MIS' as const, asOf: s.lastMatchedAt.toISOString(), applicationNo: s.applicationNo, currentStage: s.currentStage, finalDecision: s.finalDecision, cardActivationStatus: s.cardActivationStatus, finalDecisionDate: s.finalDecisionDate?.toISOString() ?? null }
        : null,
    };
  }

  private load(where: object, take = 200) {
    return this.prisma.client.callingInterest.findMany({ where, include, orderBy: { at: 'desc' }, take });
  }

  async list(actor: Actor, q: { callingRecordId?: string; telecallerUserId?: string }) {
    const rows = await this.load({ ...this.scopeWhere(actor), ...(q.callingRecordId ? { callingRecordId: q.callingRecordId } : {}), ...(q.telecallerUserId ? { telecallerUserId: q.telecallerUserId } : {}) });
    return rows.map((r) => this.view(r));
  }

  async setBankReference(actor: Actor, id: string, body: BankReferenceBody) {
    const i = await this.prisma.client.callingInterest.findFirst({ where: { id, ...this.scopeWhere(actor) }, include: { card: { select: { bankId: true } } } });
    if (!i || (actor.role !== 'ADMIN' && i.telecallerUserId !== actor.userId)) throw AppError.notFound('Interest');
    const value = body.referenceValue.trim(); // ends only — case and leading zeros preserved (REQ-13 §13.5)
    if (!value) throw new AppError('VALIDATION_FAILED', 'Reference cannot be blank.');
    if (i.bankReferenceVerified && actor.role !== 'ADMIN') throw new AppError('CONFLICT', 'This reference was verified by the bank MIS and can only be changed by the Admin.');
    if (i.bankReferenceKind === body.referenceKind && i.bankReferenceValue === value) return this.get(actor, id);
    const bankId = i.card.bankId;
    const [otherInterest, lead] = await Promise.all([
      this.prisma.client.callingInterest.count({ where: { bankReferenceBankId: bankId, bankReferenceKind: body.referenceKind, bankReferenceValue: value, id: { not: id } } }),
      this.prisma.client.bankApplicationLinkage.count({ where: { bankId, referenceKind: body.referenceKind, referenceValue: value } }),
    ]);
    if (otherInterest || lead) throw new AppError('CONFLICT', 'This reference is already linked to another customer; contact Admin.');
    await this.prisma.client.callingInterest.update({ where: { id }, data: { bankReferenceBankId: bankId, bankReferenceKind: body.referenceKind, bankReferenceValue: value, bankReferenceAt: new Date(), bankReferenceVerified: false } });
    RequestContextStore.audit({ entityId: id, before: i.bankReferenceValue ? { kind: i.bankReferenceKind, value: i.bankReferenceValue } : undefined, after: { kind: body.referenceKind, value } });
    return this.get(actor, id);
  }

  async get(actor: Actor, id: string) {
    const [row] = await this.load({ id, ...this.scopeWhere(actor) }, 1);
    if (!row) throw AppError.notFound('Interest');
    return this.view(row);
  }

  /** The Telecaller's own performance: the same evidence counts Managers see, plus where their interests stand with the bank. */
  async myPerformance(actor: Actor, range: DateRange) {
    const overview = await this.teamOps.overview(actor, range);
    const me = overview.telecallers[0];
    if (!me) throw AppError.notFound('Telecaller');
    // all-time: an application keeps moving after the period ends
    const counts = countStages(await this.prisma.client.callingInterest.findMany({ where: { telecallerUserId: actor.userId }, select: STAGE_SELECT })).get(actor.userId);
    const IST_MS = 330 * 60_000; // India has no DST
    const today = new Date(Math.floor((Date.now() + IST_MS) / 86_400_000) * 86_400_000 - IST_MS);
    const todayOverview = await this.teamOps.overview(actor, { from: today, to: new Date() });
    const t = todayOverview.telecallers[0];
    return {
      range: overview.range,
      queueSize: me.queueSize,
      followUpsDue: me.followUpsDue,
      today: { attempts: t?.attempts ?? 0, connected: t?.connected ?? 0, talkTimeSec: t?.talkTimeSec ?? 0, interests: t?.interests ?? 0 },
      period: { attempts: me.attempts, connected: me.connected, talkTimeSec: me.talkTimeSec, outcomes: me.outcomes, shares: me.shares, interests: me.interests },
      applications: counts ?? emptyStageCounts(),
    };
  }
}
