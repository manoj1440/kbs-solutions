import { type BankReferenceBody, bankValueDisplay, type DeclarationText, type LeadDeclarationsBody, type LeadDetailsBody, type LeadDraftView, type LeadEmploymentBody, type LeadIncomeBody, type LeadListQuery, type LeadMobileBody, type LeadPanBody, type LeadPincodeBody, LEAD_STEPS, type LeadStep, makePublicRef, maskMobile, normalizePan, RefPrefix, toE164India } from '@kbs/shared';
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

  // ── read ──
  private scopeWhere(actor: Actor, advisorId?: string) {
    if (actor.role === 'ADVISOR') return { advisorUserId: actor.userId };
    if (actor.role === 'MANAGER') return { advisorUserId: advisorId ? (actor.teamUserIds.includes(advisorId) ? advisorId : '__none__') : { in: actor.teamUserIds } };
    return advisorId ? { advisorUserId: advisorId } : {};
  }

  async list(actor: Actor, q: LeadListQuery) {
    const where = { ...this.scopeWhere(actor, q.advisorId), ...(q.q ? { OR: [{ customerFullName: { contains: q.q, mode: 'insensitive' as const } }, { publicRef: { contains: q.q.toUpperCase() } }] } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.client.lead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { card: { select: { name: true } }, bank: { select: { displayName: true } }, statusSnapshot: true, linkages: { where: { supersededAt: null }, take: 1 } } }),
      this.prisma.client.lead.count({ where }),
    ]);
    return new Paginated(rows.map((l) => this.summary(l)), q.page, q.pageSize, total);
  }

  private summary(l: { id: string; publicRef: string; customerFullName: string; customerMobile: string; createdAt: Date; card: { name: string }; bank: { displayName: string }; statusSnapshot: { currentStage: string | null; finalDecision: string | null; cardActivationStatus: string | null } | null; linkages: Array<{ referenceValue: string; verificationStatus: string }>; possibleCollision: boolean }) {
    const matched = l.statusSnapshot !== null;
    return {
      id: l.id,
      publicRef: l.publicRef,
      customerFullName: l.customerFullName,
      customerMobileMasked: maskMobile(l.customerMobile),
      card: l.card.name,
      bank: l.bank.displayName,
      createdAt: l.createdAt.toISOString(),
      stage: bankValueDisplay(l.statusSnapshot?.currentStage, matched),
      decision: bankValueDisplay(l.statusSnapshot?.finalDecision, matched),
      activation: bankValueDisplay(l.statusSnapshot?.cardActivationStatus, matched),
      bankReference: l.linkages[0] ? { value: l.linkages[0].referenceValue, status: l.linkages[0].verificationStatus } : null,
      possibleCollision: l.possibleCollision,
    };
  }

  async detail(actor: Actor, id: string) {
    const l = await this.prisma.client.lead.findUnique({ where: { id }, include: { card: { select: { id: true, name: true } }, bank: { select: { id: true, displayName: true } }, statusSnapshot: true, linkages: { orderBy: { at: 'desc' } }, linkInitiations: { orderBy: { at: 'desc' }, take: 20 }, shareActions: { orderBy: { at: 'desc' }, take: 20 } } });
    if (!l) throw AppError.notFound('Lead');
    const ok = actor.role === 'ADMIN' || actor.role === 'ACCOUNTS' || (actor.role === 'MANAGER' && actor.teamUserIds.includes(l.advisorUserId)) || l.advisorUserId === actor.userId;
    if (!ok) throw AppError.notFound('Lead');
    const matched = l.statusSnapshot !== null;
    const current = l.linkages.find((x) => !x.supersededAt) ?? null;
    return {
      ...this.summary({ ...l, linkages: current ? [current] : [] }),
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
      bankStatus: { matched, provenance: matched ? 'BANK_MIS' : 'NONE', stage: bankValueDisplay(l.statusSnapshot?.currentStage, matched), decision: bankValueDisplay(l.statusSnapshot?.finalDecision, matched), activation: bankValueDisplay(l.statusSnapshot?.cardActivationStatus, matched) },
      bankReference: current ? { id: current.id, kind: current.referenceKind, value: current.referenceValue, status: current.verificationStatus, source: current.source, at: current.at.toISOString() } : { value: null, label: 'Bank application reference not yet available' },
      referenceHistory: l.linkages.map((x) => ({ id: x.id, kind: x.referenceKind, value: x.referenceValue, status: x.verificationStatus, source: x.source, at: x.at.toISOString(), supersededAt: x.supersededAt?.toISOString() ?? null })),
      linkActivity: l.linkInitiations.map((i) => ({ id: i.id, action: i.action, linkVersion: i.linkVersion, at: i.at.toISOString(), label: i.action === 'SHARED' ? 'Application link shared (KBS activity)' : 'Application link opened (KBS activity)', provenance: 'KBS_OPERATIONAL' })),
      shares: l.shareActions.map((s) => ({ id: s.id, kind: s.kind, at: s.at.toISOString(), handoffResult: s.handoffResult, deliveryStatus: s.deliveryStatus })),
    };
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
