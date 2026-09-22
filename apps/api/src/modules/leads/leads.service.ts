import type { Prisma } from '@kbs/db';
import { type BankReferenceBody, bankRemarkFields, buildLeadStatusRow, DEFAULT_BLANK_TOKENS, type DeclarationText, FILTER_AWAITING, FILTER_NOT_REPORTED, isBlankBankValue, isValidE164India, type LeadFilterOptions, type OperationalEvent, type LeadDeclarationsBody, type LeadDetailsBody, type LeadDraftView, type LeadEmploymentBody, type LeadIncomeBody, type LeadListQuery, type LeadMobileBody, type LeadStatusRow, type LeadPanBody, type LeadPincodeBody, LEAD_STEPS, type LeadStep, makePublicRef, maskMobile, normalizePan, RefPrefix, toE164India } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PAN_PROVIDER, type PanVerificationProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { PincodeMasterService } from '../calling-list/pincode-master.service';
import { CatalogueService } from '../catalogue/catalogue.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';

const DRAFT_TTL_MS = 7 * 24 * 3600_000;
const idx = (s: LeadStep) => LEAD_STEPS.indexOf(s);

interface DraftData {
  mobile?: string;
  duplicateOverrideReason?: string;
  duplicateWarning?: { leadPublicRef: string; createdAt: string } | null;
  fullName?: string;
  email?: string;
  dob?: string;
  panEncrypted?: string;
  panLast4?: string;
  panVerification?: { status: 'VERIFIED' | 'MISMATCH' | 'FAILED' | 'UNAVAILABLE'; providerRef: string | null };
  pincode?: string;
  city?: string;
  state?: string;
  locationConfirmed?: boolean;
  employmentType?: 'SALARIED' | 'SELF_EMPLOYED' | 'SELF_EMPLOYED_PROFESSIONAL';
  annualIncomeItr?: number;
  acceptedDeclarationIds?: string[];
  declarationVersions?: Record<string, string>;
  bureauAckAt?: string;
}

interface RowSource {
  id: string;
  publicRef: string;
  customerFullName: string;
  customerMobile: string | null;
  createdAt: Date;
  possibleCollision: boolean;
  card: { id: string; name: string };
  bank: { id: string; displayName: string };
  statusSnapshot: (Record<string, unknown> & { productCode: string | null; lastMatchedAt: Date; lastMatchedBatch: { publicRef: string } }) | null;
  linkages: Array<{ referenceKind: string; referenceValue: string; verificationStatus: string }>;
}

/**
 * F-406 / F-407: server-side lead drafts (resumable, 7-day TTL), idempotent submit into `Lead` with NO bank status
 * (INV-01: status only ever comes from MIS), link initiations and bank-reference linkage.
 */
@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly pincodes: PincodeMasterService,
    private readonly catalogue: CatalogueService,
    private readonly hierarchy: HierarchyService,
    private readonly notifications: NotificationsService,
    @Inject(PAN_PROVIDER) private readonly pan: PanVerificationProvider,
  ) {}

  declarations(): DeclarationText[] {
    const raw = this.config.getJson<unknown>('leads.declarations');
    if (!Array.isArray(raw)) return [];
    return raw.filter((d): d is DeclarationText => Boolean(d && typeof d === 'object' && 'id' in d && 'text' in d)).map((d) => ({ id: String(d.id), version: String(d.version ?? '1'), text: String(d.text) }));
  }

  // ── drafts ──
  private async draft(actor: Actor, id: string) {
    const d = await this.prisma.client.leadDraft.findUnique({ where: { id } });
    if (!d || d.advisorUserId !== actor.userId) throw AppError.notFound('Draft');
    if (d.expiresAt.getTime() < Date.now()) throw new AppError('CONFLICT', 'This draft has expired. Start a new lead.');
    return { row: d, data: (d.data as DraftData) ?? {} };
  }

  private async save(id: string, data: DraftData, step: LeadStep, currentStep: LeadStep) {
    const next = idx(step) >= idx(currentStep) ? step : currentStep;
    await this.prisma.client.leadDraft.update({ where: { id }, data: { data: data as object, step: next, expiresAt: new Date(Date.now() + DRAFT_TTL_MS) } });
  }

  private assertStep(current: LeadStep, wanted: LeadStep) {
    if (idx(wanted) > idx(current)) throw new AppError('CONFLICT', `Complete step ${current} first.`, { currentStep: current });
  }

  async createDraft(actor: Actor, cardId: string): Promise<LeadDraftView> {
    if (actor.role !== 'ADVISOR') throw new AppError('RBAC_FORBIDDEN', 'Only Advisors create leads.');
    if (this.declarations().length === 0) throw new AppError('CONFIG_MISSING', 'Lead creation is blocked until KBS configures the customer declarations (leads.declarations).', undefined, 'CONTACT_ADMIN');
    const card = await this.prisma.client.creditCard.findUnique({ where: { id: cardId }, include: { bank: true } });
    if (!card || card.status !== 'PUBLISHED' || !card.bank.active) throw new AppError('VALIDATION_FAILED', 'Card is not available.');
    if (!(await this.catalogue.effectiveLink(card.id, 'ADVISOR'))) throw new AppError('VALIDATION_FAILED', 'This card has no active application link right now.');
    const d = await this.prisma.client.leadDraft.create({ data: { advisorUserId: actor.userId, cardId, step: 'MOBILE', data: {}, expiresAt: new Date(Date.now() + DRAFT_TTL_MS) } });
    return this.viewDraft(actor, d.id);
  }

  async listDrafts(actor: Actor) {
    const rows = await this.prisma.client.leadDraft.findMany({ where: { advisorUserId: actor.userId, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: 'desc' } });
    const cards = await this.prisma.client.creditCard.findMany({ where: { id: { in: rows.map((r) => r.cardId) } }, select: { id: true, name: true, bank: { select: { displayName: true } } } });
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows.map((r) => ({ id: r.id, step: r.step, card: byId.get(r.cardId) ?? null, customer: (r.data as DraftData).fullName ?? null, updatedAt: r.updatedAt.toISOString(), expiresAt: r.expiresAt.toISOString() }));
  }

  async viewDraft(actor: Actor, id: string): Promise<LeadDraftView> {
    const { row, data } = await this.draft(actor, id);
    const card = await this.prisma.client.creditCard.findUniqueOrThrow({ where: { id: row.cardId }, select: { id: true, name: true, bank: { select: { id: true, displayName: true } } } });
    return {
      id: row.id,
      step: row.step as LeadStep,
      card,
      data: {
        mobileMasked: data.mobile ? (maskMobile(data.mobile) ?? undefined) : undefined,
        fullName: data.fullName,
        email: data.email,
        dob: data.dob,
        panMasked: data.panLast4 ? `••••••${data.panLast4}` : undefined,
        panVerification: data.panVerification,
        pincode: data.pincode,
        city: data.city,
        state: data.state,
        locationConfirmed: data.locationConfirmed,
        employmentType: data.employmentType,
        annualIncomeItr: data.annualIncomeItr,
        acceptedDeclarationIds: data.acceptedDeclarationIds,
        bureauAckAt: data.bureauAckAt,
        duplicateWarning: data.duplicateWarning ?? null,
      },
      declarations: this.declarations(),
      expiresAt: row.expiresAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async stepMobile(actor: Actor, id: string, body: LeadMobileBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'MOBILE');
    let mobile: string;
    try {
      mobile = toE164India(body.mobile);
    } catch {
      throw new AppError('VALIDATION_FAILED', 'Enter a valid 10-digit Indian mobile number.', { field: 'mobile' });
    }
    // duplicate guard: own lead for same mobile + card in the last 30 days (REQ-11 §11.4)
    const dup = await this.prisma.client.lead.findFirst({ where: { advisorUserId: actor.userId, customerMobile: mobile, cardId: row.cardId, createdAt: { gt: new Date(Date.now() - 30 * 24 * 3600_000) } }, orderBy: { createdAt: 'desc' }, select: { publicRef: true, createdAt: true } });
    if (dup && !body.duplicateOverrideReason) throw new AppError('LEAD_DUPLICATE_REFERENCE', `You already created lead ${dup.publicRef} for this customer and card on ${dup.createdAt.toISOString().slice(0, 10)}. Add a reason to continue anyway.`, { leadPublicRef: dup.publicRef, createdAt: dup.createdAt.toISOString() });
    await this.save(id, { ...data, mobile, duplicateOverrideReason: body.duplicateOverrideReason, duplicateWarning: dup ? { leadPublicRef: dup.publicRef, createdAt: dup.createdAt.toISOString() } : null }, 'DETAILS', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  async stepDetails(actor: Actor, id: string, body: LeadDetailsBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'DETAILS');
    await this.save(id, { ...data, fullName: body.fullName, email: body.email, dob: body.dob }, 'PAN', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  /** PAN is normalised, verified through the port, stored encrypted in the draft; MISMATCH blocks, UNAVAILABLE needs config. */
  async stepPan(actor: Actor, id: string, body: LeadPanBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'PAN');
    let pan: string;
    try {
      pan = normalizePan(body.pan);
    } catch {
      throw new AppError('VALIDATION_FAILED', 'PAN must look like ABCDE1234F.', { field: 'pan' });
    }
    const result = await this.pan.verify({ pan, name: data.fullName });
    const verification = { status: result.status, providerRef: result.providerRef };
    const next: DraftData = { ...data, panEncrypted: this.crypto.encrypt(pan), panLast4: pan.slice(-4), panVerification: verification };
    await this.audit.sensitiveAccess({ entityType: 'LeadDraft', entityId: id, field: 'PAN', purpose: 'PAN_VERIFY' });
    if (result.status === 'MISMATCH') {
      await this.save(id, next, 'PAN', row.step as LeadStep);
      throw new AppError('VALIDATION_FAILED', 'The PAN does not match the customer name. Check both and try again.', { field: 'pan', status: 'MISMATCH' });
    }
    if (result.status === 'FAILED') {
      await this.save(id, next, 'PAN', row.step as LeadStep);
      throw new AppError('VALIDATION_FAILED', 'PAN could not be verified. Check the number and try again.', { field: 'pan', status: 'FAILED' });
    }
    if (result.status === 'UNAVAILABLE' && !this.config.getBool('leads.allowUnverifiedPan')) {
      await this.save(id, next, 'PAN', row.step as LeadStep);
      throw new AppError('RATE_LIMITED', 'PAN verification is unavailable right now. Your draft is saved — try again shortly.', { field: 'pan', status: 'UNAVAILABLE' }, 'RETRY_LATER');
    }
    await this.save(id, next, 'PINCODE', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  async stepPincode(actor: Actor, id: string, body: LeadPincodeBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'PINCODE');
    const lookup = await this.pincodes.lookup(body.pincode);
    const city = body.city ?? lookup.district ?? undefined;
    const state = body.state ?? lookup.state ?? undefined;
    await this.save(id, { ...data, pincode: body.pincode, city, state, locationConfirmed: body.locationConfirmed && Boolean(city && state) }, 'EMPLOYMENT', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  async stepEmployment(actor: Actor, id: string, body: LeadEmploymentBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'EMPLOYMENT');
    await this.save(id, { ...data, employmentType: body.employmentType }, 'INCOME', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  async stepIncome(actor: Actor, id: string, body: LeadIncomeBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'INCOME');
    await this.save(id, { ...data, annualIncomeItr: body.annualIncomeItr }, 'DECLARATIONS', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  async stepDeclarations(actor: Actor, id: string, body: LeadDeclarationsBody) {
    const { row, data } = await this.draft(actor, id);
    this.assertStep(row.step as LeadStep, 'DECLARATIONS');
    const required = this.declarations();
    const missing = required.filter((d) => !body.acceptedDeclarationIds.includes(d.id));
    if (missing.length) throw new AppError('VALIDATION_FAILED', 'All declarations must be accepted.', { missing: missing.map((m) => m.id) });
    await this.save(id, { ...data, acceptedDeclarationIds: required.map((d) => d.id), declarationVersions: Object.fromEntries(required.map((d) => [d.id, d.version])), bureauAckAt: new Date().toISOString() }, 'REVIEW', row.step as LeadStep);
    return this.viewDraft(actor, id);
  }

  /** Idempotent submit: the Idempotency-Key becomes `Lead.idempotencyKey`; a replayed key returns the same lead. */
  async submit(actor: Actor, id: string, idempotencyKey: string) {
    const existing = await this.prisma.client.lead.findUnique({ where: { idempotencyKey } });
    if (existing) return this.detail(actor, existing.id);
    const { row, data } = await this.draft(actor, id);
    if ((row.step as LeadStep) !== 'REVIEW') throw new AppError('CONFLICT', `Complete step ${row.step} first.`, { currentStep: row.step });
    const problems: string[] = [];
    if (!data.mobile) problems.push('mobile');
    if (!data.fullName) problems.push('fullName');
    if (!data.panEncrypted || !data.panVerification || (data.panVerification.status !== 'VERIFIED' && !(data.panVerification.status === 'UNAVAILABLE' && this.config.getBool('leads.allowUnverifiedPan')))) problems.push('pan');
    if (!data.pincode) problems.push('pincode');
    if (!data.employmentType) problems.push('employmentType');
    if (data.annualIncomeItr === undefined) problems.push('annualIncomeItr');
    if (!data.bureauAckAt || !data.acceptedDeclarationIds?.length) problems.push('declarations');
    if (problems.length) throw new AppError('VALIDATION_FAILED', 'Some steps are incomplete.', { problems });
    const card = await this.prisma.client.creditCard.findUniqueOrThrow({ where: { id: row.cardId } });
    const parentId = (await this.hierarchy.currentParentId(actor.userId)) ?? (await this.hierarchy.adminUserId());
    const lead = await this.prisma.client.$transaction(async (tx) => {
      const l = await tx.lead.create({
        data: {
          publicRef: makePublicRef(RefPrefix.LEAD),
          advisorUserId: actor.userId,
          reportingParentUserIdSnapshot: parentId,
          cardId: card.id,
          bankId: card.bankId,
          customerFullName: data.fullName as string,
          customerMobile: data.mobile as string,
          customerPanEncrypted: data.panEncrypted,
          customerPanLast4: data.panLast4,
          panVerificationStatus: data.panVerification?.status ?? 'NOT_STARTED',
          panVerificationRef: data.panVerification?.providerRef ?? null,
          pincode: data.pincode as string,
          city: data.city ?? null,
          state: data.state ?? null,
          locationConfirmed: Boolean(data.locationConfirmed),
          employmentType: data.employmentType as 'SALARIED',
          annualIncomeItr: data.annualIncomeItr as number,
          declarations: { accepted: data.acceptedDeclarationIds, versions: data.declarationVersions, email: data.email ?? null, dob: data.dob ?? null, duplicateOverrideReason: data.duplicateOverrideReason ?? null },
          bureauAckAt: new Date(data.bureauAckAt as string),
          idempotencyKey,
        },
      });
      await tx.leadDraft.delete({ where: { id } });
      return l;
    });
    // collision flag with calling records on the same mobile (F-310 §5) — flag only
    const rec = await this.prisma.client.callingRecord.findFirst({ where: { mobile: lead.customerMobile, interests: { some: {} } }, select: { id: true } });
    if (rec) await this.prisma.client.$transaction([this.prisma.client.callingRecord.update({ where: { id: rec.id }, data: { possibleCollision: true } }), this.prisma.client.lead.update({ where: { id: lead.id }, data: { possibleCollision: true } })]);
    await this.notifications.notify({ recipientUserId: parentId, kind: 'LEAD_CREATED', title: 'New lead created', body: `${lead.publicRef} · ${card.name}`, deepLink: { entityType: 'Lead', entityId: lead.id }, dedupeKey: `lead:created:${lead.id}` });
    RequestContextStore.audit({ entityId: lead.id, after: { publicRef: lead.publicRef, cardId: card.id, bankId: card.bankId, panVerificationStatus: lead.panVerificationStatus, employmentType: lead.employmentType } });
    return this.detail(actor, lead.id);
  }

  // ── read (F-506 DTO shaping) ──
  private scopeWhere(actor: Actor, advisorId?: string) {
    if (actor.role === 'ADVISOR') return { advisorUserId: actor.userId };
    if (actor.role === 'MANAGER') return { advisorUserId: advisorId ? (actor.teamUserIds.includes(advisorId) ? advisorId : '__none__') : { in: actor.teamUserIds } };
    return advisorId ? { advisorUserId: advisorId } : {};
  }

  private blankTokens() {
    return this.config.getJson<string[]>('mis.blankValueTokens') ?? DEFAULT_BLANK_TOKENS;
  }

  private readonly rowInclude = {
    card: { select: { id: true, name: true } },
    bank: { select: { id: true, displayName: true } },
    statusSnapshot: { include: { lastMatchedBatch: { select: { publicRef: true } } } },
    linkages: { where: { supersededAt: null }, take: 1 },
  } as const;

  /** Reviewed product-code crosswalks for the banks in view (REQ-14 §14.2 row 2). */
  private async crosswalks(rows: Array<{ bank: { id: string }; statusSnapshot: { productCode: string | null } | null }>) {
    const bankIds = [...new Set(rows.filter((r) => r.statusSnapshot?.productCode).map((r) => r.bank.id))];
    if (!bankIds.length) return new Map<string, { id: string; name: string }>();
    const xs = await this.prisma.client.productCodeCrosswalk.findMany({ where: { bankId: { in: bankIds } }, include: { card: { select: { id: true, name: true } } } });
    return new Map(xs.map((x) => [`${x.bankId}|${x.misProductCode}`, x.card]));
  }

  private toRow(l: RowSource, crosswalk: Map<string, { id: string; name: string }>, blankTokens: readonly string[]): LeadStatusRow {
    const s = l.statusSnapshot;
    return buildLeadStatusRow({
      id: l.id,
      publicRef: l.publicRef,
      customerFullName: l.customerFullName,
      customerMobile: l.customerMobile,
      bank: l.bank,
      card: l.card,
      createdAt: l.createdAt,
      snapshot: s ? { ...s, lastMatchedBatchRef: s.lastMatchedBatch.publicRef } : null,
      crosswalkedCard: s?.productCode ? (crosswalk.get(`${l.bank.id}|${s.productCode.trim()}`) ?? null) : null,
      bankReference: l.linkages[0] ? { kind: l.linkages[0].referenceKind, value: l.linkages[0].referenceValue, status: l.linkages[0].verificationStatus } : null,
      possibleCollision: l.possibleCollision,
      blankTokens,
    });
  }

  /** F-408 search + filters. `q` matches customer name, mobile (any Indian format) or a KBS / bank reference — never status text. */
  private listWhere(actor: Actor, q: LeadListQuery): Prisma.LeadWhereInput {
    const and: Prisma.LeadWhereInput[] = [this.scopeWhere(actor, q.advisorId)];
    if (q.q) {
      const or: Prisma.LeadWhereInput[] = [{ customerFullName: { contains: q.q, mode: 'insensitive' } }, { publicRef: { contains: q.q.toUpperCase() } }, { linkages: { some: { referenceValue: q.q } } }];
      if (isValidE164India(q.q)) or.push({ customerMobile: toE164India(q.q) });
      and.push({ OR: or });
    }
    if (q.bankId) and.push({ bankId: q.bankId });
    if (q.cardId) and.push({ cardId: q.cardId });
    if (q.from) and.push({ createdAt: { gte: new Date(`${q.from}T00:00:00+05:30`) } });
    if (q.to) and.push({ createdAt: { lt: new Date(new Date(`${q.to}T00:00:00+05:30`).getTime() + 86_400_000) } });
    const tokens = this.blankTokens();
    const statusFilter = (field: 'currentStage' | 'finalDecision' | 'cardActivationStatus', v: string | undefined) => {
      if (!v) return;
      if (v === FILTER_AWAITING) and.push({ statusSnapshot: null });
      else if (v === FILTER_NOT_REPORTED) and.push({ statusSnapshot: { OR: [{ [field]: null }, { [field]: { in: [...tokens] } }] } });
      else and.push({ statusSnapshot: { [field]: { equals: v, mode: 'insensitive' } } });
    };
    statusFilter('currentStage', q.stage);
    statusFilter('finalDecision', q.decision);
    statusFilter('cardActivationStatus', q.activation);
    if (q.misFreshness) {
      const now = Date.now();
      if (q.misFreshness === 'never') and.push({ statusSnapshot: null });
      else if (q.misFreshness === 'recent') and.push({ statusSnapshot: { lastMatchedAt: { gte: new Date(now - 7 * 86_400_000) } } });
      else if (q.misFreshness === 'older7d') and.push({ statusSnapshot: { lastMatchedAt: { lt: new Date(now - 7 * 86_400_000) } } });
      else and.push({ statusSnapshot: { lastMatchedAt: { lt: new Date(now - 30 * 86_400_000) } } });
    }
    if (q.actionable === true) and.push({ statusSnapshot: null, linkages: { none: { supersededAt: null, verificationStatus: 'VERIFIED_BY_MIS_MATCH' } } });
    if (q.actionable === false) and.push({ OR: [{ statusSnapshot: { isNot: null } }, { linkages: { some: { supersededAt: null, verificationStatus: 'VERIFIED_BY_MIS_MATCH' } } }] });
    return { AND: and };
  }

  async list(actor: Actor, q: LeadListQuery) {
    const where = this.listWhere(actor, q);
    const skip = (q.page - 1) * q.pageSize;
    let rows: RowSource[];
    let total: number;
    if (q.sort === 'lastMatchedAt_desc' || q.sort === 'lastMatchedAt_asc') {
      // Postgres puts NULLs first on DESC; never-matched leads must sort last either way, so order ids in memory (cheap: ids only).
      const all = await this.prisma.client.lead.findMany({ where, select: { id: true, createdAt: true, statusSnapshot: { select: { lastMatchedAt: true } } } });
      const dir = q.sort === 'lastMatchedAt_desc' ? -1 : 1;
      all.sort((a, b) => {
        const am = a.statusSnapshot?.lastMatchedAt.getTime() ?? null;
        const bm = b.statusSnapshot?.lastMatchedAt.getTime() ?? null;
        if (am === null && bm === null) return b.createdAt.getTime() - a.createdAt.getTime();
        if (am === null) return 1;
        if (bm === null) return -1;
        return dir * (am - bm) || b.createdAt.getTime() - a.createdAt.getTime();
      });
      total = all.length;
      const pageIds = all.slice(skip, skip + q.pageSize).map((x) => x.id);
      const fetched = await this.prisma.client.lead.findMany({ where: { id: { in: pageIds } }, include: this.rowInclude });
      const byId = new Map(fetched.map((r) => [r.id, r]));
      rows = pageIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
    } else {
      const orderBy: Prisma.LeadOrderByWithRelationInput[] = q.sort === 'createdAt_asc' ? [{ createdAt: 'asc' }] : q.sort === 'customer_asc' ? [{ customerFullName: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];
      [rows, total] = await Promise.all([this.prisma.client.lead.findMany({ where, orderBy, skip, take: q.pageSize, include: this.rowInclude }), this.prisma.client.lead.count({ where })]);
    }
    const xw = await this.crosswalks(rows);
    const tokens = this.blankTokens();
    return new Paginated(rows.map((l) => this.toRow(l, xw, tokens)), q.page, q.pageSize, total, { filters: { q: q.q ?? null, bankId: q.bankId ?? null, cardId: q.cardId ?? null, stage: q.stage ?? null, decision: q.decision ?? null, activation: q.activation ?? null, misFreshness: q.misFreshness ?? null, actionable: q.actionable ?? null, sort: q.sort } });
  }

  /** Distinct filter values within the actor's scope — verbatim bank values, never a fixed list (REQ-14 §14.1). */
  async filterOptions(actor: Actor): Promise<LeadFilterOptions> {
    const scope = this.scopeWhere(actor);
    const [banks, cards, snaps] = await Promise.all([
      this.prisma.client.lead.findMany({ where: scope, distinct: ['bankId'], select: { bank: { select: { id: true, displayName: true } } }, orderBy: { bank: { displayName: 'asc' } } }),
      this.prisma.client.lead.findMany({ where: scope, distinct: ['cardId'], select: { card: { select: { id: true, name: true, bankId: true } } }, orderBy: { card: { name: 'asc' } } }),
      this.prisma.client.bankStatusSnapshot.findMany({ where: { lead: scope }, select: { currentStage: true, finalDecision: true, cardActivationStatus: true } }),
    ]);
    const tokens = this.blankTokens();
    const distinct = (vals: (string | null)[]) => [...new Set(vals.filter((v): v is string => typeof v === 'string' && !isBlankBankValue(v, tokens)).map((v) => v.trim()))].sort();
    return { banks: banks.map((b) => b.bank), cards: cards.map((c) => c.card), stages: distinct(snaps.map((x) => x.currentStage)), decisions: distinct(snaps.map((x) => x.finalDecision)), activations: distinct(snaps.map((x) => x.cardActivationStatus)) };
  }

  /** Scope check shared with other modules that expose per-lead reads (e.g. MIS history). */
  async assertCanRead(actor: Actor, leadId: string) {
    const l = await this.prisma.client.lead.findUnique({ where: { id: leadId }, select: { advisorUserId: true } });
    const ok = !!l && (actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || (actor.role === 'MANAGER' && actor.teamUserIds.includes(l.advisorUserId)) || l.advisorUserId === actor.userId);
    if (!ok) throw AppError.notFound('Lead');
  }

  async detail(actor: Actor, id: string) {
    const l = await this.prisma.client.lead.findUnique({ where: { id }, include: { ...this.rowInclude, linkages: { orderBy: { at: 'desc' } }, linkInitiations: { orderBy: { at: 'desc' }, take: 20 }, shareActions: { orderBy: { at: 'desc' }, take: 20 } } });
    if (!l) throw AppError.notFound('Lead');
    const ok = actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || (actor.role === 'MANAGER' && actor.teamUserIds.includes(l.advisorUserId)) || l.advisorUserId === actor.userId;
    if (!ok) throw AppError.notFound('Lead');
    const tokens = this.blankTokens();
    const matched = l.statusSnapshot !== null;
    const current = l.linkages.find((x) => !x.supersededAt) ?? null;
    const [followUps, remarks] = await Promise.all([
      this.prisma.client.followUpTask.findMany({ where: { leadId: id }, orderBy: { dueAt: 'asc' }, include: { owner: { select: { id: true, fullName: true } } } }),
      this.prisma.client.operationalRemark.findMany({ where: { entityType: 'Lead', entityId: id }, orderBy: { at: 'desc' }, include: { author: { select: { id: true, fullName: true } } } }),
    ]);
    const row = this.toRow({ ...l, linkages: current ? [current] : [] }, await this.crosswalks([l]), tokens);
    const s = l.statusSnapshot;
    return {
      ...row,
      cardId: l.card.id,
      bankId: l.bank.id,
      customerPanMasked: l.customerPanLast4 ? `••••••${l.customerPanLast4}` : null,
      panVerificationStatus: l.panVerificationStatus,
      pincode: l.pincode,
      city: l.city,
      state: l.state,
      locationConfirmed: l.locationConfirmed,
      employmentType: l.employmentType,
      annualIncomeItr: Number(l.annualIncomeItr),
      declarations: l.declarations,
      bureauAckAt: l.bureauAckAt.toISOString(),
      reportingParentUserIdSnapshot: l.reportingParentUserIdSnapshot,
      /** Section A: KBS operational events, explicitly labelled and never a bank stage (REQ-11 §11.9, REQ-14 §14.1). */
      operationalEvents: this.operationalEvents(l, followUps, remarks),
      followUps: followUps.map((t) => ({ id: t.id, text: t.text, dueAt: t.dueAt.toISOString(), doneAt: t.doneAt?.toISOString() ?? null, owner: t.owner })),
      remarks: remarks.map((r) => ({ id: r.id, text: r.text, at: r.at.toISOString(), editedAt: r.editedAt?.toISOString() ?? null, author: r.author })),
      bankStatus: {
        matched,
        provenance: matched ? 'BANK_MIS' : 'NONE',
        stage: row.stage.display,
        decision: row.decision.display,
        activation: row.activation.display,
        lastMatchedAt: row.lastMatchedAt,
        lastMatchedBatchRef: s?.lastMatchedBatch.publicRef ?? null,
        firstMatchedAt: s?.firstMatchedAt.toISOString() ?? null,
        finalDecisionDate: s?.finalDecisionDate?.toISOString() ?? null,
        raw: s ? Object.fromEntries(Object.entries(s.rawLatest as Record<string, string>)) : null,
      },
      /** Section C: grouped bank remarks and Bank/KYC information (REQ-14 §14.5). */
      bankRemarks: bankRemarkFields(s, tokens),
      bankReference: current ? { id: current.id, kind: current.referenceKind, value: current.referenceValue, status: current.verificationStatus, source: current.source, at: current.at.toISOString() } : { value: null, label: 'Bank application reference not yet available' },
      referenceHistory: l.linkages.map((x) => ({ id: x.id, kind: x.referenceKind, value: x.referenceValue, status: x.verificationStatus, source: x.source, at: x.at.toISOString(), supersededAt: x.supersededAt?.toISOString() ?? null })),
      linkActivity: l.linkInitiations.map((i) => ({ id: i.id, action: i.action, linkVersion: i.linkVersion, at: i.at.toISOString(), label: i.action === 'SHARED' ? 'Application link shared (KBS activity)' : 'Application link opened (KBS activity)', provenance: 'KBS_OPERATIONAL' })),
      shares: l.shareActions.map((s) => ({ id: s.id, kind: s.kind, at: s.at.toISOString(), handoffResult: s.handoffResult, deliveryStatus: s.deliveryStatus })),
    };
  }

  private operationalEvents(l: { id: string; createdAt: Date; linkages: Array<{ id: string; referenceKind: string; referenceValue: string; source: string; at: Date }>; linkInitiations: Array<{ id: string; action: string; linkVersion: number; at: Date }>; shareActions: Array<{ id: string; kind: string; at: Date; targetMobileMasked: string; handoffResult: string; deliveryStatus: string }> }, followUps: Array<{ id: string; text: string; dueAt: Date; doneAt: Date | null; createdAt: Date; owner: { fullName: string } }>, remarks: Array<{ id: string; text: string; at: Date; author: { fullName: string } }>): OperationalEvent[] {
    const ev: OperationalEvent[] = [{ id: `created-${l.id}`, at: l.createdAt.toISOString(), kind: 'LEAD_CREATED', label: 'Lead created in KBS', detail: null, provenance: 'KBS_OPERATIONAL' }];
    for (const i of l.linkInitiations) ev.push({ id: i.id, at: i.at.toISOString(), kind: i.action === 'SHARED' ? 'LINK_SHARED' : 'LINK_OPENED', label: i.action === 'SHARED' ? 'Application link shared' : 'Application link opened', detail: `link v${i.linkVersion}`, provenance: 'KBS_OPERATIONAL' });
    const asc = [...l.linkages].sort((a, b) => a.at.getTime() - b.at.getTime());
    asc.forEach((x, n) => ev.push({ id: x.id, at: x.at.toISOString(), kind: n === 0 ? 'BANK_REFERENCE_ENTERED' : 'BANK_REFERENCE_CORRECTED', label: n === 0 ? 'Bank application reference entered' : 'Bank application reference corrected', detail: `${x.referenceKind} ${x.referenceValue} (${x.source.toLowerCase().replace(/_/g, ' ')})`, provenance: 'KBS_OPERATIONAL' }));
    for (const sh of l.shareActions) ev.push({ id: sh.id, at: sh.at.toISOString(), kind: 'SHARE_SENT', label: `${sh.kind.toLowerCase().replace(/_/g, ' ')} shared to ${sh.targetMobileMasked}`, detail: `handoff ${sh.handoffResult.toLowerCase()} · delivery ${sh.deliveryStatus.toLowerCase()}`, provenance: 'KBS_OPERATIONAL' });
    for (const t of followUps) ev.push({ id: `task-${t.id}`, at: t.createdAt.toISOString(), kind: 'FOLLOW_UP_TASK', label: `Follow-up task: ${t.text}`, detail: `owner ${t.owner.fullName} · due ${t.dueAt.toISOString()}${t.doneAt ? ' · done' : ''}`, provenance: 'KBS_OPERATIONAL' });
    for (const r of remarks) ev.push({ id: `remark-${r.id}`, at: r.at.toISOString(), kind: 'OPERATIONAL_REMARK', label: `Operational remark by ${r.author.fullName}`, detail: r.text, provenance: 'KBS_OPERATIONAL' });
    return ev.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }

  // ── F-407 link initiation ──
  async linkInitiation(actor: Actor, id: string, action: 'SHARED' | 'OPENED') {
    const l = await this.prisma.client.lead.findUnique({ where: { id }, select: { id: true, advisorUserId: true, cardId: true } });
    if (!l || l.advisorUserId !== actor.userId) throw AppError.notFound('Lead');
    const link = await this.catalogue.effectiveLink(l.cardId, 'ADVISOR');
    if (!link) throw new AppError('CONFLICT', 'No application link is effective for this card right now.');
    const row = await this.prisma.client.leadLinkInitiation.create({ data: { leadId: id, applicationLinkId: link.id, linkVersion: link.version, action, byUserId: actor.userId } });
    RequestContextStore.audit({ entityId: row.id, after: { leadId: id, action, linkVersion: link.version } });
    // the URL is returned verbatim for OPENED so the app can launch it; bank status untouched (INV-01)
    return { id: row.id, action, linkVersion: link.version, url: link.url, at: row.at.toISOString(), label: action === 'SHARED' ? 'Application link shared (KBS activity)' : 'Application link opened (KBS activity)' };
  }

  // ── F-407 bank reference ──
  async setBankReference(actor: Actor, id: string, body: BankReferenceBody) {
    const l = await this.prisma.client.lead.findUnique({ where: { id }, include: { linkages: { where: { supersededAt: null } } } });
    if (!l) throw AppError.notFound('Lead');
    const own = l.advisorUserId === actor.userId;
    if (!own && actor.role !== 'ADMIN') throw AppError.notFound('Lead');
    const value = body.referenceValue.trim(); // ends only — case and leading zeros preserved (REQ-13 §13.5)
    if (!value) throw new AppError('VALIDATION_FAILED', 'Reference cannot be blank.');
    const current = l.linkages[0] ?? null;
    if (current && current.verificationStatus === 'VERIFIED_BY_MIS_MATCH' && actor.role !== 'ADMIN') throw new AppError('CONFLICT', 'This reference was verified by the bank MIS and can only be changed by the Admin review flow.');
    const clash = await this.prisma.client.bankApplicationLinkage.findUnique({ where: { bankId_referenceKind_referenceValue: { bankId: l.bankId, referenceKind: body.referenceKind, referenceValue: value } } });
    if (clash && clash.leadId !== id) throw new AppError('CONFLICT', 'This reference is already linked to another lead; contact Admin.');
    if (clash && clash.leadId === id && !clash.supersededAt) return this.detail(actor, id);
    const row = await this.prisma.client.$transaction(async (tx) => {
      if (current) await tx.bankApplicationLinkage.update({ where: { id: current.id }, data: { supersededAt: new Date() } });
      if (clash) await tx.bankApplicationLinkage.delete({ where: { id: clash.id } }); // same lead re-entering a superseded value: reuse the unique slot
      return tx.bankApplicationLinkage.create({ data: { leadId: id, bankId: l.bankId, referenceKind: body.referenceKind, referenceValue: value, source: actor.role === 'ADMIN' ? 'ADMIN_ENTERED' : 'ADVISOR_ENTERED', verificationStatus: 'UNVERIFIED', enteredByUserId: actor.userId } });
    });
    RequestContextStore.audit({ entityId: row.id, before: current ? { value: current.referenceValue } : undefined, after: { leadId: id, kind: body.referenceKind, value } });
    return this.detail(actor, id);
  }
}
