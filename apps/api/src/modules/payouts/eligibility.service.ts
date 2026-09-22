import { isBlankBankValue } from '@kbs/shared';
import { Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';

import { PayoutRulesService } from './payout-rules.service';

export interface EntitlementListQuery {
  page: number;
  pageSize: number;
  state?: string;
  advisorId?: string;
  bankId?: string;
  leadId?: string;
}

const OPEN_STATES = ['PENDING_HOLD', 'ELIGIBLE_AVAILABLE', 'RESERVED'] as const;

/**
 * F-602 — the ONLY creator of `PayoutEntitlement` (ADR-008, INV-05/INV-06).
 * An entitlement exists iff an APPROVED rule in force at the batch upload time names the exact snapshot value the
 * bank reported for a Lead-backed application, and an approved rate prices it. `eventKey` is unique per bank event,
 * so re-imports and later rule versions never duplicate it. Corrections put open entitlements UNDER_REVIEW; PAID
 * entitlements are never altered — an exception is raised instead (F-606).
 */
@Injectable()
export class PayoutEligibilityService {
  private readonly log = new Logger(PayoutEligibilityService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
  ) {}

  private blankTokens() {
    return this.config.getJson<string[]>('mis.blankValueTokens') ?? [];
  }

  /** Evaluate one lead against its bank's rules after batch `batchId` was applied. Idempotent. */
  async evaluateLead(leadId: string, batchId: string): Promise<{ created: string[]; reviewed: string[] }> {
    const lead = await this.prisma.client.lead.findUnique({ where: { id: leadId }, include: { statusSnapshot: true, linkages: { where: { supersededAt: null }, take: 1 } } });
    const batch = await this.prisma.client.misImportBatch.findUnique({ where: { id: batchId }, select: { uploadedAt: true, bankId: true } });
    if (!lead?.statusSnapshot || !batch) return { created: [], reviewed: [] };
    const snap = lead.statusSnapshot as unknown as Record<string, unknown>;
    const tokens = this.blankTokens();
    const at = batch.uploadedAt;
    const rules = await this.prisma.client.payoutRule.findMany({ where: { bankId: lead.bankId, status: 'APPROVED', effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }, include: { rates: true } });
    const created: string[] = [];
    const reviewed = await this.reviewLead(leadId, batchId, snap, tokens);
    if (!rules.length) return { created, reviewed };
    const primaryReference = lead.linkages[0] ? `${lead.linkages[0].referenceKind}=${lead.linkages[0].referenceValue}` : null;
    if (!primaryReference) return { created, reviewed }; // no uniquely identified bank application → no entitlement (REQ-28 P0)
    const misRow = await this.prisma.client.misRow.findFirst({ where: { batchId, matchedLeadId: leadId }, select: { id: true } });
    for (const rule of rules) {
      const raw = snap[rule.triggerField];
      if (typeof raw !== 'string' || isBlankBankValue(raw, tokens)) continue;
      const value = raw.trim();
      if (!((rule.triggerValues as string[]) ?? []).includes(value)) continue;
      if (rule.productCodePattern) {
        const pc = typeof snap.productCode === 'string' ? snap.productCode.trim() : '';
        let ok = false;
        try {
          ok = new RegExp(rule.productCodePattern, 'i').test(pc);
        } catch {
          ok = false;
        }
        if (!ok) continue;
      }
      const eventKey = `${lead.bankId}|${primaryReference}|${rule.triggerField}|${value}`;
      const existing = await this.prisma.client.payoutEntitlement.findUnique({ where: { eventKey } });
      if (existing) {
        // a correction that restores the trigger value re-opens a reviewed entitlement
        if (existing.state === 'UNDER_REVIEW') await this.transition(existing.id, existing.state, existing.eligibleAt <= new Date() ? 'ELIGIBLE_AVAILABLE' : 'PENDING_HOLD', { batchId, reason: `MIS ${batchId} again reports ${rule.triggerField} = ${value}` });
        continue;
      }
      const eligibleAt = new Date(lead.statusSnapshot.lastMatchedAt.getTime() + rule.holdDays * 86_400_000);
      const rate = PayoutRulesService.rateAt(rule.rates, eligibleAt) ?? PayoutRulesService.rateAt(rule.rates, at);
      if (!rate) {
        this.log.warn({ leadId, ruleId: rule.id }, 'rule matched but no approved rate in force; entitlement not created');
        continue;
      }
      const parent = (await this.hierarchy.currentParentId(lead.advisorUserId)) ?? (await this.hierarchy.adminUserId());
      const state = eligibleAt <= new Date() ? 'ELIGIBLE_AVAILABLE' : 'PENDING_HOLD';
      const ent = await this.prisma.client.payoutEntitlement.create({
        data: { leadId, advisorUserId: lead.advisorUserId, reportingParentSnapshot: parent, bankId: lead.bankId, cardId: lead.cardId, eventKey, ruleId: rule.id, ruleVersion: rule.version, rateId: rate.id, amountInr: rate.amountInr, evidenceBatchId: batchId, evidenceMisRowId: misRow?.id ?? null, triggerFieldValue: value, eligibleAt, state },
      });
      await this.prisma.client.payoutEntitlementEvent.create({ data: { entitlementId: ent.id, fromState: null, toState: state, batchId, reason: `${rule.name} v${rule.version}: ${rule.triggerField} = "${value}" (rate ₹${Number(rate.amountInr)})` } });
      created.push(ent.id);
      await this.notifications.notify({ recipientUserId: lead.advisorUserId, kind: 'PAYOUT_ELIGIBLE', title: 'Card event eligible for payout', body: `${lead.publicRef}: bank reported ${rule.triggerField} = ${value}. ${state === 'PENDING_HOLD' ? `Available from ${eligibleAt.toISOString().slice(0, 10)}.` : 'Available to request now.'}`, deepLink: { entityType: 'Lead', entityId: leadId }, dedupeKey: `payout:eligible:${ent.id}` });
    }
    return { created, reviewed };
  }

  /** Correction handling: open entitlements whose trigger value the bank no longer reports go UNDER_REVIEW; PAID ones raise an exception event. */
  private async reviewLead(leadId: string, batchId: string, snap: Record<string, unknown>, tokens: string[]): Promise<string[]> {
    const ents = await this.prisma.client.payoutEntitlement.findMany({ where: { leadId, state: { in: [...OPEN_STATES, 'PAID'] } }, include: { rule: { select: { triggerField: true } } } });
    const reviewed: string[] = [];
    for (const e of ents) {
      const raw = snap[e.rule.triggerField];
      const current = typeof raw === 'string' && !isBlankBankValue(raw, tokens) ? raw.trim() : null;
      if (current === e.triggerFieldValue) continue;
      const reason = `MIS now reports ${e.rule.triggerField} = ${current === null ? '(blank)' : `"${current}"`} (was "${e.triggerFieldValue}")`;
      if (e.state === 'PAID') {
        const last = await this.prisma.client.payoutEntitlementEvent.findFirst({ where: { entitlementId: e.id }, orderBy: { at: 'desc' } });
        if (last?.reason?.includes(reason)) {
          reviewed.push(e.id);
          continue; // identical re-import: exception already raised for this exact correction (MIS-08)
        }
        await this.prisma.client.payoutEntitlementEvent.create({ data: { entitlementId: e.id, fromState: 'PAID', toState: 'PAID', batchId, reason: `Correction after payment — exception raised: ${reason}` } });
        await this.prisma.client.outboxEvent.create({ data: { type: 'payouts.exception', payload: { entitlementId: e.id, batchId, reason, jobId: `payouts.exception:${batchId}:${e.id}` } } });
      } else {
        await this.transition(e.id, e.state, 'UNDER_REVIEW', { batchId, reason });
      }
      reviewed.push(e.id);
    }
    return reviewed;
  }

  async transition(id: string, from: string, to: string, opts: { batchId?: string; reason?: string; actorUserId?: string; requestId?: string }) {
    await this.prisma.client.$transaction([
      this.prisma.client.payoutEntitlement.update({ where: { id }, data: { state: to as never, ...(to === 'UNDER_REVIEW' ? { reviewReason: opts.reason ?? null } : to === 'PENDING_HOLD' || to === 'ELIGIBLE_AVAILABLE' ? { reviewReason: null } : {}) } }),
      this.prisma.client.payoutEntitlementEvent.create({ data: { entitlementId: id, fromState: from as never, toState: to as never, batchId: opts.batchId ?? null, reason: opts.reason ?? null, actorUserId: opts.actorUserId ?? null, requestId: opts.requestId ?? null } }),
    ]);
  }

  /** Lazy hold release: PENDING_HOLD → ELIGIBLE_AVAILABLE once eligibleAt has passed (also run by the maintenance sweep). */
  async releaseHolds(where: { advisorUserId?: string | { in: string[] } } = {}) {
    const due = await this.prisma.client.payoutEntitlement.findMany({ where: { ...where, state: 'PENDING_HOLD', eligibleAt: { lte: new Date() } }, select: { id: true } });
    for (const d of due) await this.transition(d.id, 'PENDING_HOLD', 'ELIGIBLE_AVAILABLE', { reason: 'hold period elapsed' });
    return due.length;
  }

  /** Re-evaluate every matched lead of a bank (e.g. after a rule is approved later than the MIS was applied). Admin only. */
  async reevaluateBank(actor: Actor, bankId: string) {
    const snaps = await this.prisma.client.bankStatusSnapshot.findMany({ where: { bankId }, select: { leadId: true, lastMatchedBatchId: true } });
    let created = 0;
    let reviewed = 0;
    for (const s of snaps) {
      const r = await this.evaluateLead(s.leadId, s.lastMatchedBatchId);
      created += r.created.length;
      reviewed += r.reviewed.length;
    }
    return { leads: snaps.length, created, reviewed };
  }

  // ── ledger reads (REQ-17 §17.9: available = eligible − reserved − paid) ──
  private scope(actor: Actor, advisorId?: string) {
    if (actor.role === 'ADVISOR') return { advisorUserId: actor.userId };
    if (actor.role === 'MANAGER') return { advisorUserId: advisorId ? (actor.teamUserIds.includes(advisorId) ? advisorId : '__none__') : { in: actor.teamUserIds } };
    return advisorId ? { advisorUserId: advisorId } : {};
  }

  async list(actor: Actor, q: EntitlementListQuery) {
    const scope = this.scope(actor, q.advisorId);
    await this.releaseHolds(scope.advisorUserId ? { advisorUserId: scope.advisorUserId } : {});
    const where = { ...scope, ...(q.state ? { state: q.state as never } : {}), ...(q.bankId ? { bankId: q.bankId } : {}), ...(q.leadId ? { leadId: q.leadId } : {}) };
    const [rows, total, groups] = await Promise.all([
      this.prisma.client.payoutEntitlement.findMany({ where, orderBy: [{ eligibleAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { lead: { select: { id: true, publicRef: true, customerFullName: true } }, bank: { select: { code: true, displayName: true } }, card: { select: { name: true } }, rule: { select: { name: true, triggerField: true } }, evidenceBatch: { select: { publicRef: true, uploadedAt: true } }, advisor: { select: { id: true, fullName: true } } } }),
      this.prisma.client.payoutEntitlement.count({ where }),
      this.prisma.client.payoutEntitlement.groupBy({ by: ['state'], where: { ...scope, ...(q.bankId ? { bankId: q.bankId } : {}) }, _count: { _all: true }, _sum: { amountInr: true } }),
    ]);
    const n = (s: string) => groups.find((g) => g.state === s)?._count._all ?? 0;
    const amt = (s: string) => Number(groups.find((g) => g.state === s)?._sum.amountInr ?? 0);
    const counts = { pendingHold: n('PENDING_HOLD'), available: n('ELIGIBLE_AVAILABLE'), reserved: n('RESERVED'), paid: n('PAID'), underReview: n('UNDER_REVIEW'), void: n('VOID') };
    const amounts = { available: amt('ELIGIBLE_AVAILABLE'), reserved: amt('RESERVED'), paid: amt('PAID'), pendingHold: amt('PENDING_HOLD'), underReview: amt('UNDER_REVIEW') };
    const eligible = counts.pendingHold + counts.available + counts.reserved + counts.paid;
    return new Paginated(
      rows.map((e) => ({
        id: e.id,
        state: e.state,
        amountInr: Number(e.amountInr),
        eligibleAt: e.eligibleAt.toISOString(),
        triggerField: e.rule.triggerField,
        triggerFieldValue: e.triggerFieldValue,
        rule: { id: e.ruleId, name: e.rule.name, version: e.ruleVersion },
        lead: e.lead,
        advisor: e.advisor,
        bank: e.bank,
        card: e.card.name,
        evidence: { batchRef: e.evidenceBatch.publicRef, uploadedAt: e.evidenceBatch.uploadedAt.toISOString() },
        reviewReason: e.reviewReason,
        currentRequestId: e.currentRequestId,
        createdAt: e.createdAt.toISOString(),
      })),
      q.page,
      q.pageSize,
      total,
      { counts: { ...counts, eligible, availableToClaim: counts.available }, amounts },
    );
  }

  async events(actor: Actor, id: string) {
    const e = await this.prisma.client.payoutEntitlement.findUnique({ where: { id }, select: { advisorUserId: true } });
    if (!e) throw AppError.notFound('Entitlement');
    const ok = actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || e.advisorUserId === actor.userId || (actor.role === 'MANAGER' && actor.teamUserIds.includes(e.advisorUserId));
    if (!ok) throw AppError.notFound('Entitlement');
    return this.prisma.client.payoutEntitlementEvent.findMany({ where: { entitlementId: id }, orderBy: { at: 'asc' } });
  }
}
