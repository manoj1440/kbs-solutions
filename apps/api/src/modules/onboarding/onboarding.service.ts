import { type OnboardingAgentCodeBody, type OnboardingBankBody, type OnboardingChequeBody, type OnboardingConsentBody, type OnboardingIdentityCompleteBody, type OnboardingPersonalBody, type OnboardingReviewBody, type OnboardingStepName, type OnboardingView, ONBOARDING_STEPS } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { KYC_PROVIDER, type KycProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AgentCodesService } from '../users/agent-codes.service';
import { HierarchyService } from '../users/hierarchy.service';

type Step = OnboardingStepName;
const ORDER: Step[] = [...ONBOARDING_STEPS];
const idx = (s: Step) => ORDER.indexOf(s);

interface ConsentRecord {
  privacyNoticeVersion: string;
  identityConsent: boolean;
  termsAccepted: boolean;
  at: string;
  ip: string | null;
}

/**
 * F-401: resumable, server-ordered Advisor onboarding. Each step may be (re)submitted while the profile has not been submitted;
 * the recorded `onboardingStep` is always the furthest step still to do. Identity data never touches KBS storage beyond a
 * provider reference + evidence summary (REQ-10 §10.2).
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
    private readonly agentCodes: AgentCodesService,
    @Inject(KYC_PROVIDER) private readonly kyc: KycProvider,
  ) {}

  private async profile(userId: string) {
    const p = await this.prisma.client.advisorProfile.findUnique({ where: { userId }, include: { user: { select: { id: true, fullName: true, email: true, status: true, role: true } }, chequeFile: { select: { id: true, originalName: true } } } });
    if (!p || p.user.role !== 'ADVISOR') throw AppError.notFound('Onboarding profile');
    return p;
  }

  /** A step may be edited only before submission and only once every earlier mandatory step is done. */
  private assertEditable(p: Awaited<ReturnType<OnboardingService['profile']>>, step: Step) {
    if (p.submittedAt && p.onboardingStep !== 'PERSONAL') {
      if (p.onboardingStep === 'AWAITING_REVIEW') throw new AppError('CONFLICT', 'Your details are with KBS for review; changes are locked until the review completes.');
      if (p.onboardingStep === 'COMPLETE') throw new AppError('CONFLICT', 'Onboarding is complete. Contact KBS to change verified details.');
    }
    if (idx(step) > idx(p.onboardingStep)) throw new AppError('CONFLICT', `Complete step ${p.onboardingStep} first.`, { currentStep: p.onboardingStep });
  }

  private async advance(userId: string, from: Step, to: Step) {
    const p = await this.prisma.client.advisorProfile.findUnique({ where: { userId }, select: { onboardingStep: true } });
    if (p && idx(p.onboardingStep) <= idx(from)) await this.prisma.client.advisorProfile.update({ where: { userId }, data: { onboardingStep: to } });
  }

  async view(actor: Actor, userId = actor.userId): Promise<OnboardingView> {
    const p = await this.profile(userId);
    const consents = (p.consentRecords as ConsentRecord[] | null) ?? [];
    const latestConsent = consents[consents.length - 1];
    const parentId = await this.hierarchy.currentParentId(userId);
    const parent = parentId ? await this.prisma.client.user.findUnique({ where: { id: parentId }, select: { id: true, fullName: true, role: true } }) : null;
    return {
      step: p.onboardingStep,
      stepIndex: idx(p.onboardingStep),
      totalSteps: 7,
      personal: { fullName: p.user.fullName, email: p.user.email },
      consent: latestConsent ? { privacyNoticeVersion: latestConsent.privacyNoticeVersion, at: latestConsent.at } : null,
      identity: { status: p.identityStatus, provider: p.identityProvider, method: p.identityMethod, verifiedAt: p.identityVerifiedAt?.toISOString() ?? null, summary: (p.identityEvidenceSummary as Record<string, unknown> | null) ?? null },
      bank: p.bankAccountLast4 ? { accountHolderName: p.accountHolderName ?? '', accountLast4: p.bankAccountLast4, ifsc: p.ifsc ?? '', bankName: p.bankName ?? '' } : null,
      cheque: p.chequeFile ? { fileId: p.chequeFile.id, originalName: p.chequeFile.originalName } : null,
      reportingParent: parent,
      submittedAt: p.submittedAt?.toISOString() ?? null,
      review: p.reviewOutcome ? { outcome: p.reviewOutcome, reason: p.reviewReason, at: p.reviewedAt?.toISOString() ?? '' } : null,
      requiresAdminReview: this.config.getBool('onboarding.requiresAdminReview'),
      privacyNoticeVersion: this.config.getString('onboarding.privacyNoticeVersion') ?? 'v1-draft',
    };
  }

  async personal(actor: Actor, body: OnboardingPersonalBody) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'PERSONAL');
    await this.prisma.client.user.update({ where: { id: actor.userId }, data: { fullName: body.fullName, email: body.email } });
    await this.advance(actor.userId, 'PERSONAL', 'CONSENT');
    RequestContextStore.audit({ entityId: actor.userId, after: { fullName: body.fullName, emailDomain: body.email.split('@')[1] } });
    return this.view(actor);
  }

  async consent(actor: Actor, body: OnboardingConsentBody) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'CONSENT');
    const current = this.config.getString('onboarding.privacyNoticeVersion') ?? 'v1-draft';
    if (body.privacyNoticeVersion !== current) throw new AppError('VALIDATION_FAILED', `Please accept the current privacy notice (${current}).`, { privacyNoticeVersion: current });
    const rec: ConsentRecord = { privacyNoticeVersion: body.privacyNoticeVersion, identityConsent: true, termsAccepted: true, at: new Date().toISOString(), ip: RequestContextStore.get()?.ip ?? null };
    const records = ((p.consentRecords as ConsentRecord[] | null) ?? []).concat(rec);
    await this.prisma.client.advisorProfile.update({ where: { userId: actor.userId }, data: { consentRecords: records as unknown as object[] } });
    await this.advance(actor.userId, 'CONSENT', 'IDENTITY');
    RequestContextStore.audit({ entityId: actor.userId, after: rec });
    return this.view(actor);
  }

  /** Starts a provider session; instructions are shown to the Advisor. Nothing identity-related is stored yet. */
  async identityStart(actor: Actor) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'IDENTITY');
    if (p.identityStatus === 'VERIFIED') throw new AppError('CONFLICT', 'Identity is already verified.');
    const consents = (p.consentRecords as ConsentRecord[] | null) ?? [];
    const consent = consents[consents.length - 1];
    if (!consent?.identityConsent) throw new AppError('CONFLICT', 'Consent is required before identity verification.');
    const s = await this.kyc.start({ userId: actor.userId, consentAt: new Date(consent.at) });
    await this.prisma.client.advisorProfile.update({ where: { userId: actor.userId }, data: { identityStatus: 'PENDING', identityProvider: this.kyc.name, identityMethod: this.kyc.method, identityProviderRef: s.sessionRef } });
    RequestContextStore.audit({ entityId: actor.userId, after: { provider: this.kyc.name, method: this.kyc.method, sessionRef: s.sessionRef } });
    const v = await this.view(actor);
    return { ...v, identity: { ...v.identity, sessionRef: s.sessionRef, instructions: s.instructions } };
  }

  /** Completes with the provider payload; only the outcome + evidence summary are stored. */
  async identityComplete(actor: Actor, body: OnboardingIdentityCompleteBody) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'IDENTITY');
    if (p.identityStatus === 'VERIFIED') throw new AppError('CONFLICT', 'Identity is already verified.');
    if (p.identityProviderRef !== body.sessionRef) throw new AppError('VALIDATION_FAILED', 'Unknown verification session; start again.');
    let result: Awaited<ReturnType<KycProvider['complete']>>;
    try {
      result = await this.kyc.complete({ sessionRef: body.sessionRef, payload: body.payload });
    } catch {
      result = { status: 'UNAVAILABLE', providerRef: body.sessionRef, evidenceSummary: {} };
    }
    const summary = this.scrub(result.evidenceSummary);
    await this.prisma.client.advisorProfile.update({
      where: { userId: actor.userId },
      data: { identityStatus: result.status, identityProviderRef: result.providerRef, identityEvidenceSummary: summary as object, identityVerifiedAt: result.status === 'VERIFIED' ? new Date() : null },
    });
    if (result.status === 'VERIFIED') await this.advance(actor.userId, 'IDENTITY', 'BANK');
    RequestContextStore.audit({ entityId: actor.userId, after: { status: result.status, providerRef: result.providerRef } });
    if (result.status === 'UNAVAILABLE') throw new AppError('RATE_LIMITED', 'The identity verification service is unavailable right now. Nothing was recorded — please try again later.', { status: 'UNAVAILABLE' }, 'RETRY_LATER');
    if (result.status !== 'VERIFIED') throw new AppError('VALIDATION_FAILED', 'Identity verification did not succeed. Check the instructions and try again.', { status: result.status });
    return this.view(actor);
  }

  /** Defensive: drop anything in a provider summary that looks like an identity number (REQ-10 §10.2). */
  private scrub(summary: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(summary ?? {})) {
      if (/aadha?ar|uid|share.?code|xml|photo|image/i.test(k)) continue;
      if (typeof v === 'string' && /\d{12}/.test(v.replace(/\s/g, ''))) continue;
      out[k] = v;
    }
    return out;
  }

  async bank(actor: Actor, body: OnboardingBankBody) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'BANK');
    await this.prisma.client.advisorProfile.update({
      where: { userId: actor.userId },
      data: { accountHolderName: body.accountHolderName, bankAccountEncrypted: this.crypto.encrypt(body.accountNumber), bankAccountLast4: body.accountNumber.slice(-4), ifsc: body.ifsc, bankName: body.bankName },
    });
    await this.advance(actor.userId, 'BANK', 'CHEQUE');
    RequestContextStore.audit({ entityId: actor.userId, after: { accountLast4: body.accountNumber.slice(-4), ifsc: body.ifsc, bankName: body.bankName } });
    return this.view(actor);
  }

  async cheque(actor: Actor, body: OnboardingChequeBody) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'CHEQUE');
    const f = await this.prisma.client.storedFile.findUnique({ where: { id: body.fileId } });
    if (!f || f.purpose !== 'CHEQUE' || f.uploadedByUserId !== actor.userId) throw new AppError('VALIDATION_FAILED', 'Upload the cancelled cheque (purpose CHEQUE) first.');
    await this.prisma.client.advisorProfile.update({ where: { userId: actor.userId }, data: { chequeFileId: f.id } });
    await this.advance(actor.userId, 'CHEQUE', 'AGENT_CODE');
    RequestContextStore.audit({ entityId: actor.userId, after: { chequeFileId: f.id } });
    return this.view(actor);
  }

  /** Optional: blank keeps the Admin as reporting person (FOS-02). */
  async agentCode(actor: Actor, body: OnboardingAgentCodeBody) {
    const p = await this.profile(actor.userId);
    this.assertEditable(p, 'AGENT_CODE');
    if (body.code) await this.agentCodes.apply(actor, { code: body.code });
    await this.advance(actor.userId, 'AGENT_CODE', 'REVIEW');
    return this.view(actor);
  }

  async submit(actor: Actor) {
    const p = await this.profile(actor.userId);
    if (p.onboardingStep === 'AWAITING_REVIEW' || p.onboardingStep === 'COMPLETE') return this.view(actor);
    if (p.onboardingStep !== 'REVIEW') throw new AppError('CONFLICT', `Complete step ${p.onboardingStep} first.`, { currentStep: p.onboardingStep });
    if (p.identityStatus !== 'VERIFIED') throw new AppError('CONFLICT', 'Identity must be verified before submitting.');
    if (!p.bankAccountLast4 || !p.chequeFileId || !p.user.fullName) throw new AppError('CONFLICT', 'Bank details and cancelled cheque are required.');
    const requiresReview = this.config.getBool('onboarding.requiresAdminReview');
    const now = new Date();
    if (requiresReview) {
      await this.prisma.client.advisorProfile.update({ where: { userId: actor.userId }, data: { submittedAt: now, onboardingStep: 'AWAITING_REVIEW', reviewOutcome: null, reviewReason: null } });
      const adminId = await this.hierarchy.adminUserId();
      await this.notifications.notify({ recipientUserId: adminId, kind: 'ONBOARDING_ISSUE', title: 'Advisor onboarding awaiting review', body: `${p.user.fullName} submitted onboarding for review.`, deepLink: { entityType: 'AdvisorProfile', entityId: p.id }, dedupeKey: `onboarding:submitted:${p.id}:${now.getTime()}` });
    } else {
      await this.activate(actor.userId, p.id, null, 'auto-activated (onboarding.requiresAdminReview=false)');
      await this.prisma.client.advisorProfile.update({ where: { userId: actor.userId }, data: { submittedAt: now } });
    }
    RequestContextStore.audit({ entityId: actor.userId, after: { submittedAt: now.toISOString(), requiresReview } });
    return this.view(actor);
  }

  private async activate(userId: string, profileId: string, reviewerId: string | null, reason: string) {
    await this.prisma.client.$transaction([
      this.prisma.client.advisorProfile.update({ where: { id: profileId }, data: { onboardingStep: 'COMPLETE', reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewOutcome: 'APPROVED', reviewReason: reason } }),
      this.prisma.client.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } }),
      this.prisma.client.userLifecycleEvent.create({ data: { userId, eventType: 'ACTIVATED', actorUserId: reviewerId, reason } }),
    ]);
    await this.notifications.notify({ recipientUserId: userId, kind: 'ONBOARDING_APPROVED', title: 'Welcome to KBS Solutions', body: 'Your onboarding is approved. You can now browse cards and create leads.', dedupeKey: `onboarding:approved:${profileId}` });
  }

  // ── Admin review (F-401 §8) ──
  async reviewQueue() {
    const rows = await this.prisma.client.advisorProfile.findMany({ where: { onboardingStep: 'AWAITING_REVIEW' }, orderBy: { submittedAt: 'asc' }, include: { user: { select: { id: true, publicRef: true, fullName: true, email: true, mobile: true } } } });
    return rows.map((p) => ({ profileId: p.id, userId: p.user.id, publicRef: p.user.publicRef, fullName: p.user.fullName, email: p.user.email, submittedAt: p.submittedAt?.toISOString() ?? null, identityStatus: p.identityStatus, bankName: p.bankName, accountLast4: p.bankAccountLast4 }));
  }

  async reviewDetail(actor: Actor, userId: string, reveal?: 'bank') {
    const v = await this.view(actor, userId);
    const p = await this.profile(userId);
    let bankAccountNumber: string | null = null;
    if (reveal === 'bank') {
      if (!actor.permissions.includes('SENSITIVE_REVEAL_BANK')) throw new AppError('RBAC_FORBIDDEN', 'You cannot reveal bank details.');
      if (p.bankAccountEncrypted) bankAccountNumber = this.crypto.decrypt(p.bankAccountEncrypted);
      await this.audit.sensitiveAccess({ entityType: 'AdvisorProfile', entityId: p.id, field: 'BANK_ACCOUNT', purpose: 'ONBOARDING_REVIEW' });
    }
    return { ...v, userId, profileId: p.id, mobileMasked: undefined, bankAccountNumber };
  }

  async review(actor: Actor, userId: string, body: OnboardingReviewBody) {
    const p = await this.profile(userId);
    if (p.onboardingStep !== 'AWAITING_REVIEW') throw new AppError('CONFLICT', 'This Advisor is not awaiting review.');
    if (body.decision === 'APPROVE') {
      if (p.identityStatus !== 'VERIFIED') throw new AppError('CONFLICT', 'Identity is not verified; cannot approve.');
      await this.activate(userId, p.id, actor.userId, body.reason ?? 'approved by Admin');
    } else {
      // send back to REVIEW so the Advisor can fix and resubmit; earlier verified steps are kept
      await this.prisma.client.advisorProfile.update({ where: { id: p.id }, data: { onboardingStep: 'REVIEW', reviewedByUserId: actor.userId, reviewedAt: new Date(), reviewOutcome: 'REJECTED', reviewReason: body.reason, submittedAt: null } });
      await this.notifications.notify({ recipientUserId: userId, kind: 'ONBOARDING_ISSUE', title: 'Onboarding needs changes', body: body.reason ?? 'Please review your details and resubmit.', dedupeKey: `onboarding:rejected:${p.id}:${Date.now()}` });
    }
    RequestContextStore.audit({ entityId: userId, after: { decision: body.decision }, reason: body.reason });
    return this.view(actor, userId);
  }
}
