import { type CreateFollowUpTaskBody, isBlankBankValue, MisActionableRule, type PendingAction, type PendingActionsQuery, type RemarkBody } from '@kbs/shared';
import { Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';

import { LeadsService } from './leads.service';

/**
 * F-409 — Pending Actions (REQ-11 §11.10, VIEW-03) and lead-level operational remarks (REQ-14 §14.5).
 * Sources: explicit FollowUpTask rows, and MIS-derived items produced ONLY by `mis.actionableRules` (seeded empty).
 * A blank cell or a generic "Inprocess" never becomes a task; bank text with no owner is shown verbatim without a CTA.
 */
@Injectable()
export class PendingActionsService {
  private readonly log = new Logger(PendingActionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly leads: LeadsService,
  ) {}

  private rules(): MisActionableRule[] {
    const raw = this.config.getJson<unknown[]>('mis.actionableRules') ?? [];
    const out: MisActionableRule[] = [];
    for (const r of raw) {
      const p = MisActionableRule.safeParse(r);
      if (p.success) out.push(p.data);
      else this.log.warn(`Ignoring invalid mis.actionableRules entry: ${p.error.issues.map((i) => i.message).join('; ')}`);
    }
    return out;
  }

  private leadScope(actor: Actor) {
    if (actor.role === 'ADVISOR') return { advisorUserId: actor.userId };
    if (actor.role === 'MANAGER') return { advisorUserId: { in: actor.teamUserIds } };
    return {};
  }

  // ── follow-up tasks ──
  async createFollowUp(actor: Actor, leadId: string, body: CreateFollowUpTaskBody) {
    await this.leads.assertCanRead(actor, leadId);
    const lead = await this.prisma.client.lead.findUniqueOrThrow({ where: { id: leadId }, select: { advisorUserId: true, publicRef: true } });
    const ownerUserId = body.ownerUserId ?? actor.userId;
    if (ownerUserId !== actor.userId) {
      const allowed = actor.role === 'ADMIN' || (actor.role === 'MANAGER' && actor.teamUserIds.includes(ownerUserId)) || ownerUserId === lead.advisorUserId;
      if (!allowed) throw new AppError('RBAC_FORBIDDEN', 'You can only assign follow-ups to yourself or an advisor in your team.');
    }
    if (new Date(body.dueAt).getTime() < Date.now() - 60_000) throw new AppError('VALIDATION_FAILED', 'Follow-up must be in the future.');
    const t = await this.prisma.client.followUpTask.create({ data: { leadId, ownerUserId, text: body.text, dueAt: new Date(body.dueAt) } });
    RequestContextStore.audit({ entityId: t.id, after: { leadId, ownerUserId, text: body.text, dueAt: body.dueAt } });
    if (ownerUserId !== actor.userId) {
      await this.notifications.notify({ recipientUserId: ownerUserId, kind: 'FOLLOW_UP_DUE', title: 'Follow-up task assigned', body: `${body.text} · lead ${lead.publicRef}`, deepLink: { entityType: 'Lead', entityId: leadId }, dedupeKey: `followup:${t.id}:assigned` });
    }
    return t;
  }

  async completeFollowUp(actor: Actor, id: string) {
    const t = await this.prisma.client.followUpTask.findUnique({ where: { id }, include: { lead: { select: { advisorUserId: true } } } });
    if (!t || !t.leadId) throw AppError.notFound('Follow-up task');
    const ok = t.ownerUserId === actor.userId || actor.role === 'ADMIN' || (actor.role === 'MANAGER' && t.lead && actor.teamUserIds.includes(t.lead.advisorUserId));
    if (!ok) throw AppError.notFound('Follow-up task');
    if (t.doneAt) return t;
    const u = await this.prisma.client.followUpTask.update({ where: { id }, data: { doneAt: new Date() } });
    RequestContextStore.audit({ entityId: id, before: { doneAt: null }, after: { doneAt: u.doneAt } });
    return u;
  }

  // ── pending actions (REQ-11 §11.10) ──
  async list(actor: Actor, q: PendingActionsQuery): Promise<PendingAction[]> {
    const scope = { ...this.leadScope(actor), ...(q.leadId ? { id: q.leadId } : {}) };
    const tasks = await this.prisma.client.followUpTask.findMany({
      where: { leadId: { not: null }, lead: scope, ...(q.includeDone ? {} : { doneAt: null }), ...(actor.role === 'ADVISOR' ? { ownerUserId: actor.userId } : {}) },
      include: { owner: { select: { id: true, fullName: true, role: true } }, lead: { select: { id: true, publicRef: true, customerFullName: true, card: { select: { name: true } }, bank: { select: { displayName: true } } } } },
      orderBy: { dueAt: 'asc' },
    });
    const items: PendingAction[] = tasks
      .filter((t) => t.lead)
      .map((t) => ({
        id: `task:${t.id}`,
        leadId: t.lead!.id,
        leadRef: t.lead!.publicRef,
        customer: t.lead!.customerFullName,
        card: t.lead!.card.name,
        issuer: t.lead!.bank.displayName,
        owner: { userId: t.owner.id, name: t.owner.fullName, role: t.owner.role === 'MANAGER' ? 'MANAGER' : 'ADVISOR' },
        whatToDo: t.text,
        source: { type: 'KBS_TASK', createdByUserId: t.ownerUserId },
        date: t.dueAt.toISOString(),
        cta: 'OPEN_LEAD',
        doneAt: t.doneAt?.toISOString() ?? null,
      }));
    const rules = this.rules();
    if (rules.length) items.push(...(await this.misDerived(actor, scope, rules)));
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** MIS-derived informational items: exact-text rule matches only; never inferred from blanks. */
  private async misDerived(actor: Actor, scope: Record<string, unknown>, rules: MisActionableRule[]): Promise<PendingAction[]> {
    const blank = this.config.getJson<string[]>('mis.blankValueTokens') ?? [];
    const leads = await this.prisma.client.lead.findMany({
      where: { ...scope, statusSnapshot: { isNot: null } },
      include: { statusSnapshot: { include: { lastMatchedBatch: { select: { publicRef: true } } } }, card: { select: { name: true } }, bank: { select: { code: true, displayName: true } }, advisor: { select: { id: true, fullName: true, reportingAsChild: { where: { status: 'ACTIVE', effectiveTo: null }, take: 1, select: { parent: { select: { id: true, fullName: true } } } } } } },
    });
    const out: PendingAction[] = [];
    for (const l of leads) {
      const s = l.statusSnapshot!;
      for (const r of rules) {
        if (r.bankCode !== l.bank.code) continue;
        const v = (s as unknown as Record<string, unknown>)[r.field];
        if (typeof v !== 'string' || isBlankBankValue(v, blank)) continue;
        let re: RegExp;
        try {
          re = new RegExp(r.pattern, 'i');
        } catch {
          continue;
        }
        if (!re.test(v.trim())) continue;
        const owner = r.owner === 'ADVISOR' ? { userId: l.advisor.id, name: l.advisor.fullName, role: 'ADVISOR' as const } : r.owner === 'MANAGER' ? { userId: l.advisor.reportingAsChild[0]?.parent.id ?? null, name: l.advisor.reportingAsChild[0]?.parent.fullName ?? null, role: 'MANAGER' as const } : { userId: null, name: null, role: 'BANK' as const };
        if (actor.role === 'ADVISOR' && owner.role === 'MANAGER') continue;
        out.push({
          id: `mis:${l.id}:${r.field}`,
          leadId: l.id,
          leadRef: l.publicRef,
          customer: l.customerFullName,
          card: l.card.name,
          issuer: l.bank.displayName,
          owner,
          whatToDo: r.owner ? r.label : `Bank reported: ${v.trim()}`,
          source: { type: 'MIS_FIELD', field: r.field, batchRef: s.lastMatchedBatch.publicRef, bankText: v.trim() },
          date: s.lastMatchedAt.toISOString(),
          cta: r.owner ? (r.cta ?? 'OPEN_LEAD') : null,
          doneAt: null,
        });
      }
    }
    return out;
  }

  // ── lead operational remarks (REQ-14 §14.5): separate from bank remarks, never override MIS ──
  async addRemark(actor: Actor, leadId: string, body: RemarkBody) {
    await this.leads.assertCanRead(actor, leadId);
    const rem = await this.prisma.client.operationalRemark.create({ data: { entityType: 'Lead', entityId: leadId, authorUserId: actor.userId, text: body.text }, include: { author: { select: { id: true, fullName: true } } } });
    RequestContextStore.audit({ entityId: rem.id, after: { leadId, text: body.text } });
    return rem;
  }

  async listRemarks(actor: Actor, leadId: string) {
    await this.leads.assertCanRead(actor, leadId);
    return this.prisma.client.operationalRemark.findMany({ where: { entityType: 'Lead', entityId: leadId }, orderBy: { at: 'desc' }, include: { author: { select: { id: true, fullName: true } } } });
  }
}
