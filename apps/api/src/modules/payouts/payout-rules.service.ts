import type { CreatePayoutRateBody, CreatePayoutRuleBody, PayoutRateView, PayoutRuleListQuery, PayoutRuleView, UpdatePayoutRuleBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';

const ruleInclude = { bank: { select: { id: true, code: true, displayName: true } }, rates: { orderBy: { effectiveFrom: 'desc' as const } }, _count: { select: { entitlements: true } } } as const;

/**
 * F-601 — versioned payout rules and rates per bank (REQ-17 §17.1, §17.9; ADR-008).
 * Only APPROVED rules/rates inside their effective window ever evaluate; the seed contains none (fail closed, PAY-01).
 * Editing an APPROVED rule creates a new DRAFT version; rate changes create new rates — existing entitlement amounts never move.
 */
@Injectable()
export class PayoutRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async users(ids: (string | null)[]) {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    const rows = uniq.length ? await this.prisma.client.user.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true } }) : [];
    return new Map(rows.map((u) => [u.id, u]));
  }

  private rateView(r: { id: string; amountInr: unknown; effectiveFrom: Date; effectiveTo: Date | null; status: string; approvedAt: Date | null; approvedByUserId: string | null }, users: Map<string, { id: string; fullName: string }>): PayoutRateView {
    return { id: r.id, amountInr: Number(r.amountInr), effectiveFrom: r.effectiveFrom.toISOString(), effectiveTo: r.effectiveTo?.toISOString() ?? null, status: r.status, approvedAt: r.approvedAt?.toISOString() ?? null, approvedBy: r.approvedByUserId ? (users.get(r.approvedByUserId) ?? null) : null };
  }

  /** The APPROVED rate in force at `at` for a rule (latest effectiveFrom wins). */
  static rateAt<T extends { status: string; effectiveFrom: Date; effectiveTo: Date | null }>(rates: T[], at: Date): T | null {
    return rates.filter((r) => r.status === 'APPROVED' && r.effectiveFrom <= at && (!r.effectiveTo || r.effectiveTo > at)).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
  }

  private async view(rule: { id: string; bank: { id: string; code: string; displayName: string }; name: string; version: number; status: string; triggerField: string; triggerValues: unknown; productCodePattern: string | null; holdDays: number; effectiveFrom: Date; effectiveTo: Date | null; approvedAt: Date | null; approvedByUserId: string | null; notes: string | null; createdAt: Date; rates: Array<{ id: string; amountInr: unknown; effectiveFrom: Date; effectiveTo: Date | null; status: string; approvedAt: Date | null; approvedByUserId: string | null }>; _count: { entitlements: number } }): Promise<PayoutRuleView> {
    const users = await this.users([rule.approvedByUserId, ...rule.rates.map((r) => r.approvedByUserId)]);
    const current = PayoutRulesService.rateAt(rule.rates, new Date());
    return {
      id: rule.id,
      bank: rule.bank,
      name: rule.name,
      version: rule.version,
      status: rule.status,
      triggerField: rule.triggerField,
      triggerValues: (rule.triggerValues as string[]) ?? [],
      productCodePattern: rule.productCodePattern,
      holdDays: rule.holdDays,
      effectiveFrom: rule.effectiveFrom.toISOString(),
      effectiveTo: rule.effectiveTo?.toISOString() ?? null,
      approvedAt: rule.approvedAt?.toISOString() ?? null,
      approvedBy: rule.approvedByUserId ? (users.get(rule.approvedByUserId) ?? null) : null,
      notes: rule.notes,
      createdAt: rule.createdAt.toISOString(),
      rates: rule.rates.map((r) => this.rateView(r, users)),
      currentRate: current ? this.rateView(current, users) : null,
      entitlementCount: rule._count.entitlements,
    };
  }

  async list(q: PayoutRuleListQuery): Promise<PayoutRuleView[]> {
    const rows = await this.prisma.client.payoutRule.findMany({ where: { ...(q.bankId ? { bankId: q.bankId } : {}), ...(q.status ? { status: q.status } : {}) }, orderBy: [{ bank: { code: 'asc' } }, { name: 'asc' }, { version: 'desc' }], include: ruleInclude });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async get(id: string): Promise<PayoutRuleView> {
    const r = await this.prisma.client.payoutRule.findUnique({ where: { id }, include: ruleInclude });
    if (!r) throw AppError.notFound('Payout rule');
    return this.view(r);
  }

  async create(actor: Actor, body: CreatePayoutRuleBody) {
    if (body.effectiveTo && new Date(body.effectiveTo) <= new Date(body.effectiveFrom)) throw new AppError('VALIDATION_FAILED', 'effectiveTo must be after effectiveFrom.');
    this.assertPattern(body.productCodePattern);
    const bank = await this.prisma.client.bank.findUnique({ where: { id: body.bankId }, select: { id: true } });
    if (!bank) throw AppError.notFound('Bank');
    const r = await this.prisma.client.payoutRule.create({
      data: { bankId: body.bankId, name: body.name, version: 1, triggerField: body.triggerField, triggerValues: body.triggerValues.map((v) => v.trim()), productCodePattern: body.productCodePattern ?? null, holdDays: body.holdDays, effectiveFrom: new Date(body.effectiveFrom), effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null, notes: body.notes ?? null },
      include: ruleInclude,
    });
    RequestContextStore.audit({ entityId: r.id, after: { ...body, version: 1, status: 'DRAFT' } });
    return this.view(r);
  }

  /** DRAFT: edit in place. APPROVED: create version n+1 as DRAFT (the approved version keeps evaluating until the new one is approved, which retires it). */
  async update(actor: Actor, id: string, body: UpdatePayoutRuleBody) {
    const r = await this.prisma.client.payoutRule.findUnique({ where: { id } });
    if (!r) throw AppError.notFound('Payout rule');
    if (r.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired rules are read-only; create a new rule.');
    this.assertPattern(body.productCodePattern);
    const merged = {
      name: body.name ?? r.name,
      triggerField: body.triggerField ?? r.triggerField,
      triggerValues: (body.triggerValues ?? (r.triggerValues as string[])).map((v) => v.trim()),
      productCodePattern: body.productCodePattern === undefined ? r.productCodePattern : body.productCodePattern,
      holdDays: body.holdDays ?? r.holdDays,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : r.effectiveFrom,
      effectiveTo: body.effectiveTo === undefined ? r.effectiveTo : body.effectiveTo ? new Date(body.effectiveTo) : null,
      notes: body.notes === undefined ? r.notes : body.notes,
    };
    if (merged.effectiveTo && merged.effectiveTo <= merged.effectiveFrom) throw new AppError('VALIDATION_FAILED', 'effectiveTo must be after effectiveFrom.');
    if (r.status === 'DRAFT') {
      const u = await this.prisma.client.payoutRule.update({ where: { id }, data: merged, include: ruleInclude });
      RequestContextStore.audit({ entityId: id, before: { name: r.name, triggerValues: r.triggerValues, holdDays: r.holdDays }, after: body });
      return this.view(u);
    }
    const latest = await this.prisma.client.payoutRule.findFirst({ where: { bankId: r.bankId, name: merged.name }, orderBy: { version: 'desc' }, select: { version: true } });
    const v = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.payoutRule.create({ data: { bankId: r.bankId, version: (latest?.version ?? r.version) + 1, ...merged } });
      // carry the approved rates forward so the new version prices identically until a rate is changed on purpose
      const rates = await tx.payoutRate.findMany({ where: { ruleId: id, status: 'APPROVED' } });
      if (rates.length) await tx.payoutRate.createMany({ data: rates.map((x) => ({ ruleId: created.id, amountInr: x.amountInr, effectiveFrom: x.effectiveFrom, effectiveTo: x.effectiveTo, status: 'APPROVED' as const, approvedByUserId: x.approvedByUserId, approvedAt: x.approvedAt })) });
      return created;
    });
    RequestContextStore.audit({ entityId: v.id, after: { from: id, version: v.version, ...body } });
    return this.get(v.id);
  }

  /** Approve with reason (audited). Approving version n retires older APPROVED versions of the same rule name. */
  async approve(actor: Actor, id: string, reason: string) {
    const r = await this.prisma.client.payoutRule.findUnique({ where: { id }, include: { rates: true } });
    if (!r) throw AppError.notFound('Payout rule');
    if (r.status !== 'DRAFT') throw new AppError('CONFLICT', `Rule is ${r.status}.`);
    if (!(r.triggerValues as string[])?.length) throw new AppError('VALIDATION_FAILED', 'A rule needs at least one trigger value.');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.payoutRule.updateMany({ where: { bankId: r.bankId, name: r.name, status: 'APPROVED', id: { not: id } }, data: { status: 'RETIRED', effectiveTo: new Date() } });
      await tx.payoutRule.update({ where: { id }, data: { status: 'APPROVED', approvedByUserId: actor.userId, approvedAt: new Date() } });
    });
    RequestContextStore.audit({ entityId: id, before: { status: 'DRAFT' }, after: { status: 'APPROVED', version: r.version }, reason });
    return this.get(id);
  }

  async retire(actor: Actor, id: string, reason: string) {
    const r = await this.prisma.client.payoutRule.findUnique({ where: { id } });
    if (!r) throw AppError.notFound('Payout rule');
    if (r.status === 'RETIRED') return this.get(id);
    await this.prisma.client.payoutRule.update({ where: { id }, data: { status: 'RETIRED', effectiveTo: r.effectiveTo && r.effectiveTo < new Date() ? r.effectiveTo : new Date() } });
    RequestContextStore.audit({ entityId: id, before: { status: r.status }, after: { status: 'RETIRED' }, reason });
    return this.get(id);
  }

  // ── rates ──
  async addRate(actor: Actor, ruleId: string, body: CreatePayoutRateBody) {
    const r = await this.prisma.client.payoutRule.findUnique({ where: { id: ruleId } });
    if (!r) throw AppError.notFound('Payout rule');
    if (r.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired rules cannot take new rates.');
    if (body.effectiveTo && new Date(body.effectiveTo) <= new Date(body.effectiveFrom)) throw new AppError('VALIDATION_FAILED', 'effectiveTo must be after effectiveFrom.');
    const rate = await this.prisma.client.payoutRate.create({ data: { ruleId, amountInr: body.amountInr, effectiveFrom: new Date(body.effectiveFrom), effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null } });
    RequestContextStore.audit({ entityId: rate.id, after: { ruleId, ...body, status: 'DRAFT' } });
    return this.get(ruleId);
  }

  /** Approving a rate closes any overlapping APPROVED rate at the new rate's effectiveFrom. Entitlements already priced keep their rateId/amount (§17.9). */
  async approveRate(actor: Actor, rateId: string, reason: string) {
    const rate = await this.prisma.client.payoutRate.findUnique({ where: { id: rateId } });
    if (!rate) throw AppError.notFound('Payout rate');
    if (rate.status !== 'DRAFT') throw new AppError('CONFLICT', `Rate is ${rate.status}.`);
    await this.prisma.client.$transaction(async (tx) => {
      const overlapping = await tx.payoutRate.findMany({ where: { ruleId: rate.ruleId, status: 'APPROVED', id: { not: rateId }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: rate.effectiveFrom } }] } });
      for (const o of overlapping) {
        if (o.effectiveFrom >= rate.effectiveFrom) await tx.payoutRate.update({ where: { id: o.id }, data: { status: 'RETIRED' } });
        else await tx.payoutRate.update({ where: { id: o.id }, data: { effectiveTo: rate.effectiveFrom } });
      }
      await tx.payoutRate.update({ where: { id: rateId }, data: { status: 'APPROVED', approvedByUserId: actor.userId, approvedAt: new Date() } });
    });
    RequestContextStore.audit({ entityId: rateId, before: { status: 'DRAFT' }, after: { status: 'APPROVED', amountInr: Number(rate.amountInr) }, reason });
    return this.get(rate.ruleId);
  }

  /** Distinct values actually seen in MIS for a bank's snapshot field — the trigger picker (F-601 §4). */
  async seenValues(bankId: string, field: string) {
    const profile = await this.prisma.client.misImportProfile.findFirst({ where: { bankId, status: 'APPROVED' }, orderBy: { version: 'desc' }, select: { knownValues: true } });
    const known = ((profile?.knownValues as Record<string, string[]> | null) ?? {})[field] ?? [];
    const snaps = await this.prisma.client.bankStatusSnapshot.findMany({ where: { bankId }, select: { [field]: true } as never });
    const seen = snaps.map((s) => (s as unknown as Record<string, string | null>)[field]).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    return { field, values: [...new Set([...known, ...seen.map((v) => v.trim())])].sort() };
  }

  private assertPattern(p?: string | null) {
    if (!p) return;
    try {
      new RegExp(p, 'i');
    } catch {
      throw new AppError('VALIDATION_FAILED', 'productCodePattern is not a valid regular expression.');
    }
  }
}
