import type { RecordOutcomeBody, RemarkBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SuppressionService } from '../calling-list/suppression.service';
import { ConfigService } from '../config/config.service';

type InteractionStatus = 'UNTOUCHED' | 'FOLLOW_UP' | 'INTERESTED' | 'LINK_SHARED' | 'DECLINED' | 'COMPLETED' | 'UNREACHABLE';

/** Outcome kind → calling-record effect (REQ-08 §8.6). None of these is a bank stage (INV-05). */
const EFFECT: Record<RecordOutcomeBody['outcome'], { status: InteractionStatus; hide: boolean }> = {
  NO_ANSWER_OR_FAILED: { status: 'UNREACHABLE', hide: false },
  CONNECTED_INTERESTED: { status: 'INTERESTED', hide: false },
  CONNECTED_LINK_OR_PDF_SHARED: { status: 'LINK_SHARED', hide: false },
  FOLLOW_UP: { status: 'FOLLOW_UP', hide: false },
  DECLINED: { status: 'DECLINED', hide: true },
  COMPLETED_NO_FURTHER: { status: 'COMPLETED', hide: true },
};

/** F-310: call outcomes, operational remarks (append-only edit history), calling interest, collision flag. */
@Injectable()
export class OutcomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly suppression: SuppressionService,
  ) {}

  async record(actor: Actor, callingRecordId: string, body: RecordOutcomeBody) {
    const r = await this.prisma.client.callingRecord.findUnique({ where: { id: callingRecordId } });
    if (!r) throw AppError.notFound('Record');
    if (r.assignedTelecallerUserId !== actor.userId) throw new AppError('RBAC_FORBIDDEN', 'This customer is not assigned to you.');
    if (r.hiddenAt && !body.doNotContact) throw new AppError('CONFLICT', 'This record is hidden; outcomes are closed.');
    const remarks = body.remarks?.trim() || null;
    if (body.outcome === 'FOLLOW_UP') {
      if (!body.followUpAt) throw new AppError('VALIDATION_FAILED', 'A follow-up date/time is required.');
      if (new Date(body.followUpAt).getTime() < Date.now() - 60_000) throw new AppError('VALIDATION_FAILED', 'Follow-up must be in the future.');
      if (this.config.getBool('calling.requireReasonForFollowUp') && !remarks) throw new AppError('VALIDATION_FAILED', 'Add a note explaining the follow-up.');
    }
    if (body.outcome === 'DECLINED' && this.config.getBool('calling.requireReasonForDecline') && !remarks) throw new AppError('VALIDATION_FAILED', 'Add a note explaining the decline.');
    if (body.callAttemptId) {
      const a = await this.prisma.client.callAttempt.findUnique({ where: { id: body.callAttemptId }, select: { callingRecordId: true, telecallerUserId: true } });
      if (!a || a.callingRecordId !== callingRecordId || a.telecallerUserId !== actor.userId) throw new AppError('VALIDATION_FAILED', 'callAttemptId does not belong to this record.');
    }
    let card: { id: string; status: string } | null = null;
    if (body.selectedCardId) {
      card = await this.prisma.client.creditCard.findUnique({ where: { id: body.selectedCardId }, select: { id: true, status: true } });
      if (!card || card.status !== 'PUBLISHED') throw new AppError('VALIDATION_FAILED', 'Selected card is not a published catalogue card.');
    }

    const effect = EFFECT[body.outcome];
    const now = new Date();
    const outcome = await this.prisma.client.$transaction(async (tx) => {
      const o = await tx.callOutcome.create({
        data: { callingRecordId, callAttemptId: body.callAttemptId ?? null, telecallerUserId: actor.userId, outcome: body.outcome, remarks, followUpAt: body.outcome === 'FOLLOW_UP' && body.followUpAt ? new Date(body.followUpAt) : null, selectedCardId: card?.id ?? null, doNotContact: Boolean(body.doNotContact) },
      });
      await tx.callingRecord.update({
        where: { id: callingRecordId },
        data: {
          interactionStatus: effect.status,
          nextFollowUpAt: body.outcome === 'FOLLOW_UP' ? new Date(body.followUpAt as string) : null,
          ...(effect.hide ? { hiddenAt: now, hiddenReason: body.outcome } : {}),
        },
      });
      // operational interest (never an entitlement, INV-05)
      let interestId: string | null = null;
      if (card && (body.outcome === 'CONNECTED_INTERESTED' || body.outcome === 'CONNECTED_LINK_OR_PDF_SHARED')) {
        const i = await tx.callingInterest.create({ data: { callingRecordId, telecallerUserId: actor.userId, cardId: card.id } });
        interestId = i.id;
        // collision flag: an Advisor lead with the same mobile (exact) → flag both, change nothing else (REQ-08 §8.7 OPEN)
        const lead = await tx.lead.findFirst({ where: { customerMobile: r.mobile }, select: { id: true } });
        if (lead) {
          await tx.lead.update({ where: { id: lead.id }, data: { possibleCollision: true } });
          await tx.callingRecord.update({ where: { id: callingRecordId }, data: { possibleCollision: true } });
        }
      }
      return { ...o, interestId };
    });
    if (body.doNotContact) await this.suppression.suppress(actor, r.mobile, 'CUSTOMER_REQUEST', callingRecordId);
    RequestContextStore.audit({ entityId: outcome.id, after: { callingRecordId, outcome: body.outcome, status: effect.status, hidden: effect.hide, doNotContact: Boolean(body.doNotContact), selectedCardId: card?.id ?? null } });
    return { id: outcome.id, outcome: body.outcome, interactionStatus: effect.status, hidden: effect.hide, nextFollowUpAt: outcome.followUpAt?.toISOString() ?? null, interestId: outcome.interestId, doNotContact: Boolean(body.doNotContact) };
  }

  // ── operational remarks (REQ-14 §14.5) ──
  private async assertRecordScope(actor: Actor, callingRecordId: string) {
    const r = await this.prisma.client.callingRecord.findUnique({ where: { id: callingRecordId }, select: { assignedTelecallerUserId: true } });
    if (!r) throw AppError.notFound('Record');
    const ok = actor.role === 'ADMIN' || (actor.role === 'MANAGER' && r.assignedTelecallerUserId !== null && actor.teamUserIds.includes(r.assignedTelecallerUserId)) || r.assignedTelecallerUserId === actor.userId;
    if (!ok) throw AppError.notFound('Record');
  }

  async addRemark(actor: Actor, callingRecordId: string, body: RemarkBody) {
    await this.assertRecordScope(actor, callingRecordId);
    const rem = await this.prisma.client.operationalRemark.create({ data: { entityType: 'CallingRecord', entityId: callingRecordId, authorUserId: actor.userId, text: body.text } });
    RequestContextStore.audit({ entityId: rem.id, after: { callingRecordId, text: body.text } });
    return rem;
  }

  /** Edit keeps every prior version in `editHistory` (append-only). Only the author (or Admin) may edit. */
  async editRemark(actor: Actor, remarkId: string, body: RemarkBody) {
    const rem = await this.prisma.client.operationalRemark.findUnique({ where: { id: remarkId } });
    if (!rem) throw AppError.notFound('Remark');
    if (rem.authorUserId !== actor.userId && actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only the author can edit a remark.');
    const history = ((rem.editHistory as Array<{ text: string; at: string; editedByUserId: string }> | null) ?? []).concat([{ text: rem.text, at: (rem.editedAt ?? rem.at).toISOString(), editedByUserId: actor.userId }]);
    const u = await this.prisma.client.operationalRemark.update({ where: { id: remarkId }, data: { text: body.text, editedAt: new Date(), editHistory: history } });
    RequestContextStore.audit({ entityId: remarkId, before: { text: rem.text }, after: { text: body.text } });
    return u;
  }

  async listRemarks(actor: Actor, callingRecordId: string) {
    await this.assertRecordScope(actor, callingRecordId);
    return this.prisma.client.operationalRemark.findMany({ where: { entityType: 'CallingRecord', entityId: callingRecordId }, orderBy: { at: 'desc' }, include: { author: { select: { id: true, fullName: true } } } });
  }
}
