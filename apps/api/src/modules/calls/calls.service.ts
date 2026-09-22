import { type CallAttemptView, maskMobile, type RecordingStatusValue } from '@kbs/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TELEPHONY_PROVIDER, type TelephonyEvent, type TelephonyProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { SuppressionService } from '../calling-list/suppression.service';
import { ConfigService } from '../config/config.service';
import { FilesService } from '../files/files.service';

const RETRY_AFTER_MS = 5_000;

/**
 * F-309: in-app call initiation through the telephony port. The customer's full number never leaves the server except to the
 * provider; clients only ever see the masked target. Provider-confirmed states are the only source of "connected" (REQ-16 §16.3).
 */
@Injectable()
export class CallsService {
  private readonly log = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly suppression: SuppressionService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    @Inject(TELEPHONY_PROVIDER) private readonly telephony: TelephonyProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Idempotent per (actor, Idempotency-Key): the interceptor replays; this also guards against the same key hitting twice concurrently. */
  async initiate(actor: Actor, callingRecordId: string, idempotencyKey: string): Promise<CallAttemptView> {
    const existing = await this.prisma.client.callAttempt.findUnique({ where: { idempotencyKey }, include: { recording: true } });
    if (existing) return this.view(existing);

    const r = await this.prisma.client.callingRecord.findUnique({ where: { id: callingRecordId } });
    if (!r) throw AppError.notFound('Record');
    if (r.assignedTelecallerUserId !== actor.userId) throw new AppError('RBAC_FORBIDDEN', 'This customer is not assigned to you.');
    if (r.suppressed || (await this.suppression.isSuppressed(r.mobile))) throw new AppError('CALLING_SUPPRESSED', 'This customer has asked not to be contacted.');
    if (r.hiddenAt) throw new AppError('CONFLICT', 'This record is hidden; it cannot be called.');
    if (!r.mobile.startsWith('+')) throw new AppError('VALIDATION_FAILED', 'This record has no valid mobile number.');

    // safe retry: block re-dial while a previous attempt on this record is still live
    const live = await this.prisma.client.callAttempt.findFirst({ where: { callingRecordId, providerState: { in: ['REQUESTED', 'RINGING', 'CONNECTED'] }, initiatedAt: { gt: new Date(Date.now() - 30 * 60_000) } } });
    if (live) throw new AppError('CONFLICT', 'A call to this customer is already in progress.', { callAttemptId: live.id });
    const lastFailed = await this.prisma.client.callAttempt.findFirst({ where: { callingRecordId, telecallerUserId: actor.userId, providerState: 'FAILED' }, orderBy: { initiatedAt: 'desc' } });
    if (lastFailed && lastFailed.initiatedAt.getTime() + RETRY_AFTER_MS > Date.now()) throw new AppError('RATE_LIMITED', 'Please wait a few seconds before retrying.', { retryAfter: new Date(lastFailed.initiatedAt.getTime() + RETRY_AFTER_MS).toISOString() });

    const attempt = await this.prisma.client.callAttempt.create({
      data: { callingRecordId, telecallerUserId: actor.userId, providerKey: this.telephony.name, targetMobileMasked: maskMobile(r.mobile) ?? '••••', providerState: 'REQUESTED', idempotencyKey },
    });
    let result: Awaited<ReturnType<TelephonyProvider['initiateCall']>>;
    try {
      result = await this.telephony.initiateCall({ fromUserId: actor.userId, toMobileE164: r.mobile, callbackUrl: `${this.env.API_PUBLIC_URL}/api/v1/webhooks/telephony/${this.telephony.name}` });
    } catch (e) {
      result = { providerCallId: '', state: 'FAILED', reason: e instanceof Error ? e.message : 'PROVIDER_ERROR' };
    }
    const updated = await this.prisma.client.callAttempt.update({
      where: { id: attempt.id },
      data: result.state === 'FAILED' ? { providerCallId: result.providerCallId || null, providerState: 'FAILED', failureReason: result.reason ?? 'PROVIDER_FAILED', endedAt: new Date() } : { providerCallId: result.providerCallId },
      include: { recording: true },
    });
    await this.audit.sensitiveAccess({ entityType: 'CallingRecord', entityId: callingRecordId, field: 'MOBILE', purpose: 'CALL_INITIATE' });
    RequestContextStore.audit({ entityId: attempt.id, after: { callingRecordId, providerState: updated.providerState, providerCallId: updated.providerCallId, failureReason: updated.failureReason } });
    return this.view(updated);
  }

  async get(actor: Actor, id: string): Promise<CallAttemptView> {
    const a = await this.prisma.client.callAttempt.findUnique({ where: { id }, include: { recording: true, callingRecord: { select: { assignedTelecallerUserId: true } } } });
    if (!a) throw AppError.notFound('Call');
    this.assertScope(actor, a.telecallerUserId, a.callingRecord.assignedTelecallerUserId);
    return this.view(a);
  }

  private assertScope(actor: Actor, telecallerUserId: string, assignedTelecallerUserId: string | null) {
    const ok = actor.role === 'ADMIN' || (actor.role === 'MANAGER' && (actor.teamUserIds.includes(telecallerUserId) || (assignedTelecallerUserId !== null && actor.teamUserIds.includes(assignedTelecallerUserId)))) || actor.userId === telecallerUserId;
    if (!ok) throw AppError.notFound('Call');
  }

  /** Provider webhook: idempotent per (providerCallId, type, at); unknown call ids are logged and ignored. */
  async applyWebhook(providerName: string, headers: Record<string, string | string[] | undefined>, body: unknown) {
    if (providerName !== this.telephony.name) throw AppError.notFound('Provider');
    const events = this.telephony.parseWebhook(headers, body);
    let applied = 0;
    for (const ev of events) {
      if (await this.applyEvent(ev)) applied++;
    }
    return { received: events.length, applied };
  }

  private async applyEvent(ev: TelephonyEvent): Promise<boolean> {
    const a = await this.prisma.client.callAttempt.findFirst({ where: { providerCallId: ev.providerCallId }, include: { recording: true } });
    if (!a) {
      this.log.warn(`telephony event for unknown call ${ev.providerCallId} (${ev.type})`);
      return false;
    }
    switch (ev.type) {
      case 'RINGING':
        if (a.providerState !== 'REQUESTED') return false;
        await this.prisma.client.callAttempt.update({ where: { id: a.id }, data: { providerState: 'RINGING' } });
        return true;
      case 'CONNECTED':
        if (a.connectedAt) return false; // duplicate
        await this.prisma.client.callAttempt.update({ where: { id: a.id }, data: { providerState: 'CONNECTED', connectedAt: ev.at } });
        return true;
      case 'ENDED': {
        if (a.endedAt && a.providerState === 'ENDED') return false;
        const connectedAt = a.connectedAt;
        const durationSec = ev.durationSec ?? (connectedAt ? Math.max(0, Math.round((ev.at.getTime() - connectedAt.getTime()) / 1000)) : null);
        await this.prisma.client.callAttempt.update({ where: { id: a.id }, data: { providerState: connectedAt ? 'ENDED' : 'NO_ANSWER', endedAt: ev.at, durationSec } });
        if (connectedAt && !a.recording) await this.prisma.client.callRecording.create({ data: { callAttemptId: a.id, status: 'PENDING' } });
        return true;
      }
      case 'NO_ANSWER':
      case 'FAILED':
        if (a.endedAt) return false;
        await this.prisma.client.callAttempt.update({ where: { id: a.id }, data: { providerState: ev.type, endedAt: ev.at, failureReason: ev.reason ?? null } });
        return true;
      case 'RECORDING_AVAILABLE': {
        if (a.recording?.status === 'AVAILABLE') return false;
        await this.prisma.client.callRecording.upsert({ where: { callAttemptId: a.id }, create: { callAttemptId: a.id, status: 'AVAILABLE', providerRecordingId: ev.recordingRef, durationSec: ev.durationSec, retrievedAt: ev.at }, update: { status: 'AVAILABLE', providerRecordingId: ev.recordingRef, durationSec: ev.durationSec, retrievedAt: ev.at, failureReason: null } });
        return true;
      }
      case 'RECORDING_FAILED': {
        if (a.recording?.status === 'AVAILABLE' || a.recording?.status === 'FAILED') return false;
        await this.prisma.client.callRecording.upsert({ where: { callAttemptId: a.id }, create: { callAttemptId: a.id, status: 'FAILED', failureReason: ev.reason ?? 'PROVIDER_RECORDING_FAILED' }, update: { status: 'FAILED', failureReason: ev.reason ?? 'PROVIDER_RECORDING_FAILED' } });
        return true;
      }
      default:
        return false;
    }
  }

  /** Playback URL for Manager (team) / Admin only; every access is logged as a sensitive read (REQ-21 §21.1). */
  async recordingUrl(actor: Actor, callId: string) {
    const a = await this.prisma.client.callAttempt.findUnique({ where: { id: callId }, include: { recording: true, callingRecord: { select: { assignedTelecallerUserId: true } } } });
    if (!a) throw AppError.notFound('Call');
    this.assertScope(actor, a.telecallerUserId, a.callingRecord.assignedTelecallerUserId);
    if (actor.role === 'TELECALLER') throw new AppError('RBAC_FORBIDDEN', 'Recording playback is limited to Managers and the Admin.');
    if (!a.recording || a.recording.status !== 'AVAILABLE') throw new AppError('CONFLICT', 'No recording is available for this call.', { status: a.recording?.status ?? 'NOT_ATTEMPTED' });
    await this.audit.sensitiveAccess({ entityType: 'CallAttempt', entityId: callId, field: 'RECORDING', purpose: 'PLAYBACK' });
    if (a.recording.fileId) return { url: (await this.files.downloadUrl(actor, a.recording.fileId)).url, source: 'FILE' as const, expiresInSec: this.config.getInt('files.presignExpirySec') ?? 300 };
    // provider-hosted recording: the adapter would mint a signed URL; the mock returns a deterministic placeholder
    return { url: `${this.env.API_PUBLIC_URL}/api/v1/calls/${callId}/recording/${a.recording.providerRecordingId ?? 'unknown'}`, source: 'PROVIDER' as const, expiresInSec: 300 };
  }

  async listForRecord(actor: Actor, callingRecordId: string) {
    const r = await this.prisma.client.callingRecord.findUnique({ where: { id: callingRecordId }, select: { assignedTelecallerUserId: true } });
    if (!r) throw AppError.notFound('Record');
    const rows = await this.prisma.client.callAttempt.findMany({ where: { callingRecordId }, orderBy: { initiatedAt: 'desc' }, include: { recording: true } });
    for (const a of rows) this.assertScope(actor, a.telecallerUserId, r.assignedTelecallerUserId);
    return rows.map((a) => this.view(a));
  }

  private view(a: { id: string; callingRecordId: string; providerKey: string; providerCallId: string | null; targetMobileMasked: string; initiatedAt: Date; providerState: CallAttemptView['providerState']; connectedAt: Date | null; endedAt: Date | null; durationSec: number | null; failureReason: string | null; recording: { status: RecordingStatusValue; durationSec: number | null; failureReason: string | null } | null }): CallAttemptView {
    return {
      id: a.id,
      callingRecordId: a.callingRecordId,
      providerKey: a.providerKey,
      providerCallId: a.providerCallId,
      targetMobileMasked: a.targetMobileMasked,
      initiatedAt: a.initiatedAt.toISOString(),
      providerState: a.providerState,
      connectedAt: a.connectedAt?.toISOString() ?? null,
      endedAt: a.endedAt?.toISOString() ?? null,
      durationSec: a.durationSec,
      failureReason: a.failureReason,
      recording: a.recording ? { status: a.recording.status, durationSec: a.recording.durationSec, failureReason: a.recording.failureReason } : null,
      retryAfter: a.providerState === 'FAILED' ? new Date(a.initiatedAt.getTime() + RETRY_AFTER_MS).toISOString() : null,
      disclosureText: this.config.getString('compliance.recordingDisclosureText'),
    };
  }
}
