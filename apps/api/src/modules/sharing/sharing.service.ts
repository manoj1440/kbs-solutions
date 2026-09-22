import { createHmac, timingSafeEqual } from 'node:crypto';

import { maskMobile, type ShareBody, type ShareResult } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { SuppressionService } from '../calling-list/suppression.service';
import { CatalogueService } from '../catalogue/catalogue.service';
import { ConfigService } from '../config/config.service';
import { FilesService } from '../files/files.service';
import { IdCardsService } from '../id-cards/id-cards.service';

const REDIRECT_TTL_SEC = 7 * 24 * 3600;

/**
 * F-311: three distinct share actions (benefit PDF, official ID, application link) over the WhatsApp port.
 * Hand-off ≠ delivery: `deliveryStatus` only ever changes from provider confirmations (WA-01).
 * Application links are sent verbatim (WA-02). PDF/ID go through a KBS redirect `/r/<token>` so the customer never gets a raw bucket URL.
 */
@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly files: FilesService,
    private readonly catalogue: CatalogueService,
    private readonly idCards: IdCardsService,
    private readonly suppression: SuppressionService,
    private readonly audit: AuditService,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ── redirect tokens (stateless, HMAC-signed; expire) ──
  private sign(payload: string) {
    return createHmac('sha256', this.env.JWT_ACCESS_SECRET).update(payload).digest('base64url');
  }

  redirectUrl(fileId: string, shareActionId: string): string {
    const exp = Math.floor(Date.now() / 1000) + REDIRECT_TTL_SEC;
    const payload = `${fileId}.${shareActionId}.${exp}`;
    return `${this.env.API_PUBLIC_URL}/api/v1/r/${Buffer.from(payload).toString('base64url')}.${this.sign(payload)}`;
  }

  /** Resolves a redirect token → presigned URL. Public route; every hit is logged against the share action. */
  async resolveRedirect(token: string): Promise<string> {
    const dot = token.lastIndexOf('.');
    if (dot < 0) throw AppError.notFound('Link');
    const payload = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8');
    const sig = token.slice(dot + 1);
    const expected = this.sign(payload);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw AppError.notFound('Link');
    const [fileId, shareActionId, expStr] = payload.split('.');
    if (!fileId || !expStr || Number(expStr) * 1000 < Date.now()) throw new AppError('CONFLICT', 'This link has expired. Ask your KBS contact to share it again.');
    const file = await this.prisma.client.storedFile.findUnique({ where: { id: fileId } });
    if (!file || (file.purpose !== 'BENEFIT_PDF' && file.purpose !== 'ID_CARD')) throw AppError.notFound('Link');
    const expiresInSec = this.config.getInt('files.presignExpirySec') ?? 300;
    const url = await this.files.presign(file, expiresInSec);
    await this.prisma.client.auditLog.create({ data: { action: 'share.redirectOpened', entityType: 'ShareAction', entityId: shareActionId ?? 'unknown', after: { fileId } } });
    return url;
  }

  // ── share ──
  async share(actor: Actor, body: ShareBody): Promise<ShareResult> {
    const target = await this.loadTarget(actor, body);
    if (await this.suppression.isSuppressed(target.mobile)) throw new AppError('CALLING_SUPPRESSED', 'This customer has asked not to be contacted.');
    const consentPolicy = this.config.getString('compliance.whatsappConsentPolicy');
    if (this.whatsapp.mode === 'BUSINESS_API' && !consentPolicy) throw new AppError('CONFIG_MISSING', 'WhatsApp Business sending is disabled until compliance.whatsappConsentPolicy is set.');

    const channel = this.whatsapp.mode === 'BUSINESS_API' ? 'WHATSAPP_BUSINESS_API' : 'WHATSAPP_HANDOFF';
    // create the row first so PDF/ID redirect tokens can reference it
    const action = await this.prisma.client.shareAction.create({
      data: { actorUserId: actor.userId, callingRecordId: target.callingRecordId, leadId: target.leadId, kind: body.kind, cardId: body.cardId ?? null, targetMobileMasked: maskMobile(target.mobile) ?? '••••', channel, handoffResult: 'FAILED', deliveryStatus: 'UNKNOWN' },
    });

    let text: string;
    let mediaUrl: string | undefined;
    let assetVersionRef: string | null = null;
    let linkVersion: number | null = null;
    let callingInterestId: string | null = null;
    const me = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { fullName: true } });

    if (body.kind === 'APPLICATION_LINK') {
      if (!body.cardId) throw new AppError('VALIDATION_FAILED', 'cardId is required for an application link.');
      const card = await this.prisma.client.creditCard.findUnique({ where: { id: body.cardId }, include: { bank: true } });
      if (!card || card.status !== 'PUBLISHED') throw new AppError('VALIDATION_FAILED', 'Card is not published.');
      const link = await this.catalogue.effectiveLink(card.id, actor.role === 'ADVISOR' ? 'ADVISOR' : 'TELECALLER');
      if (!link) throw new AppError('CONFLICT', 'No application link is effective for this card right now.');
      linkVersion = link.version;
      assetVersionRef = `link:${link.id}:v${link.version}`;
      // verbatim URL — never normalised (WA-02)
      text = `Hi ${target.customerName}, here is the ${card.bank.displayName} ${card.name} application link as discussed:\n${link.url}\n— ${me.fullName}, KBS Solutions`;
      if (target.callingRecordId) {
        const i = await this.prisma.client.callingInterest.create({ data: { callingRecordId: target.callingRecordId, telecallerUserId: actor.userId, cardId: card.id, applicationLinkId: link.id } });
        callingInterestId = i.id;
        await this.prisma.client.callingRecord.update({ where: { id: target.callingRecordId }, data: { interactionStatus: 'LINK_SHARED' } });
      }
    } else if (body.kind === 'BENEFIT_PDF') {
      if (!body.cardId) throw new AppError('VALIDATION_FAILED', 'cardId is required for a benefit PDF.');
      const card = await this.prisma.client.creditCard.findUnique({ where: { id: body.cardId }, include: { bank: true, benefitPdf: true } });
      if (!card || card.status !== 'PUBLISHED') throw new AppError('VALIDATION_FAILED', 'Card is not published.');
      if (!card.benefitPdf) throw new AppError('CONFLICT', 'This card has no approved benefit PDF.');
      assetVersionRef = `pdf:${card.benefitPdf.id}:card-v${card.version}`;
      mediaUrl = this.redirectUrl(card.benefitPdf.id, action.id);
      text = `Hi ${target.customerName}, the benefits of the ${card.bank.displayName} ${card.name} are in this PDF:`;
    } else {
      const card = await this.idCards.ensureRendered(actor.userId);
      if (!card || !card.renderedFileId) throw new AppError('CONFLICT', 'Your official ID is revoked or not available.', undefined);
      assetVersionRef = `idcard:${card.id}:v${card.version}`;
      mediaUrl = this.redirectUrl(card.renderedFileId, action.id);
      text = `Hi ${target.customerName}, this is my official KBS Solutions ID for your reference:`;
    }

    let prepared: Awaited<ReturnType<WhatsAppProvider['prepare']>>;
    let handoffResult: 'OPENED' | 'FAILED' = 'OPENED';
    try {
      prepared = await this.whatsapp.prepare({ toMobileE164: target.mobile, text, mediaUrl });
    } catch {
      prepared = { confirmedSent: false };
      handoffResult = 'FAILED';
    }
    const deliveryStatus = prepared.confirmedSent ? 'SENT' : 'UNKNOWN';
    const updated = await this.prisma.client.shareAction.update({ where: { id: action.id }, data: { handoffResult, deliveryStatus, providerMessageId: prepared.providerMessageId ?? null, assetVersionRef } });
    await this.audit.sensitiveAccess({ entityType: target.callingRecordId ? 'CallingRecord' : 'Lead', entityId: target.callingRecordId ?? (target.leadId as string), field: 'MOBILE', purpose: `SHARE_${body.kind}` });
    RequestContextStore.audit({ entityId: action.id, after: { kind: body.kind, channel, handoffResult, deliveryStatus, assetVersionRef, cardId: body.cardId ?? null, target: { callingRecordId: target.callingRecordId, leadId: target.leadId } } });
    return {
      shareActionId: updated.id,
      kind: body.kind,
      channel,
      handoffResult,
      deliveryStatus,
      handoffUrl: prepared.handoffUrl ?? null,
      providerMessageId: prepared.providerMessageId ?? null,
      message: mediaUrl ? `${text}\n${mediaUrl}` : text,
      consentPolicyConfigured: Boolean(consentPolicy),
      callingInterestId,
      linkVersion,
    };
  }

  private async loadTarget(actor: Actor, body: ShareBody): Promise<{ mobile: string; customerName: string; callingRecordId: string | null; leadId: string | null }> {
    if (body.targetType === 'CALLING_RECORD') {
      const r = await this.prisma.client.callingRecord.findUnique({ where: { id: body.targetId } });
      if (!r || r.assignedTelecallerUserId !== actor.userId) throw AppError.notFound('Record');
      if (r.hiddenAt) throw new AppError('CONFLICT', 'This record is hidden.');
      if (!r.mobile.startsWith('+')) throw new AppError('VALIDATION_FAILED', 'No valid mobile for this customer.');
      return { mobile: r.mobile, customerName: r.fullName, callingRecordId: r.id, leadId: null };
    }
    const l = await this.prisma.client.lead.findUnique({ where: { id: body.targetId } });
    if (!l || l.advisorUserId !== actor.userId) throw AppError.notFound('Lead');
    return { mobile: l.customerMobile, customerName: l.customerFullName, callingRecordId: null, leadId: l.id };
  }

  /** Provider delivery webhook (BUSINESS_API mode): the only path that can ever set SENT/DELIVERED/FAILED. */
  async applyDelivery(providerMessageId: string, status: 'SENT' | 'DELIVERED' | 'FAILED') {
    const r = await this.prisma.client.shareAction.updateMany({ where: { providerMessageId, channel: 'WHATSAPP_BUSINESS_API' }, data: { deliveryStatus: status } });
    return { updated: r.count };
  }

  listForRecord(actor: Actor, callingRecordId: string) {
    return this.prisma.client.shareAction.findMany({ where: { callingRecordId, ...(actor.role === 'TELECALLER' ? { actorUserId: actor.userId } : {}) }, orderBy: { at: 'desc' } });
  }
}
