import type { Prisma } from '@kbs/db';
import {
  CALL_LIVE_WINDOW_MINUTES,
  callAttention,
  maskMobile,
  type OversightCallsQuery,
  type OversightSharesQuery,
  type OversightSummaryQuery,
  RECORDING_OVERDUE_MINUTES,
  recordingChip,
  shareDeliveryLabel,
} from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { HierarchyService } from '../users/hierarchy.service';

const LIVE_STATES = ['REQUESTED', 'RINGING', 'CONNECTED'] as const;
const DAY_MS = 24 * 3600_000;

/** IST calendar day → UTC instant at 00:00 IST. */
const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
const istToday = (now: Date) => new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * F-314: organisation-wide oversight of telephony, recordings and WhatsApp sharing (REQ-25 §25.4, REQ-16 §16.1).
 * Read-only. Every value comes from a provider event or a recorded KBS action — nothing is inferred or written back:
 * connected = provider `connectedAt`; delivered = provider delivery status only (WA-01); "Recorded" only when AVAILABLE (CALL-02).
 */
@Injectable()
export class OversightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
  ) {}

  private range(q: { from?: string; to?: string }, now: Date) {
    const toDay = q.to ?? istToday(now);
    const fromDay = q.from ?? istToday(new Date(istStart(toDay).getTime() - 6 * DAY_MS + 12 * 3600_000));
    const from = istStart(fromDay);
    const to = new Date(istStart(toDay).getTime() + DAY_MS - 1);
    if (from > to) throw new AppError('VALIDATION_FAILED', '"From" must be on or before "To".');
    if (to.getTime() - from.getTime() > 366 * DAY_MS) throw new AppError('VALIDATION_FAILED', 'Choose a range of one year or less.');
    return { from, to, fromDay, toDay };
  }

  /** User ids whose calls/shares the actor may see, narrowed by filters. `null` = everyone (Admin, no filter). */
  private async scope(actor: Actor, q: { managerId?: string; userId?: string }): Promise<string[] | null> {
    let ids: string[] | null;
    if (actor.role === 'ADMIN') ids = q.managerId ? await this.hierarchy.teamUserIds(q.managerId) : null;
    else if (actor.role === 'MANAGER') ids = actor.teamUserIds;
    else throw new AppError('RBAC_FORBIDDEN', 'Communications oversight is for Managers and the Admin.');
    if (q.userId) {
      if (ids && !ids.includes(q.userId)) throw AppError.notFound('User');
      ids = [q.userId];
    }
    return ids;
  }

  private callWhere(ids: string[] | null, from: Date, to: Date): Prisma.CallAttemptWhereInput {
    return { initiatedAt: { gte: from, lte: to }, ...(ids ? { telecallerUserId: { in: ids } } : {}) };
  }

  private attentionWhere(kind: NonNullable<OversightCallsQuery['attention']>, now: Date): Prisma.CallAttemptWhereInput {
    switch (kind) {
      case 'NO_PROVIDER_CONFIRMATION':
        return { providerState: { in: [...LIVE_STATES] }, initiatedAt: { lt: new Date(now.getTime() - CALL_LIVE_WINDOW_MINUTES * 60_000) } };
      case 'FAILED_BEFORE_PROVIDER':
        return { providerState: 'FAILED', providerCallId: null };
      case 'RECORDING_FAILED':
        return { recording: { is: { status: 'FAILED' } } };
      case 'RECORDING_OVERDUE':
        return {
          connectedAt: { not: null },
          endedAt: { lt: new Date(now.getTime() - RECORDING_OVERDUE_MINUTES * 60_000) },
          OR: [{ recording: { is: null } }, { recording: { is: { status: { in: ['PENDING', 'NOT_ATTEMPTED'] } } } }],
        };
    }
  }

  private shareWhere(ids: string[] | null, from: Date, to: Date): Prisma.ShareActionWhereInput {
    return { at: { gte: from, lte: to }, ...(ids ? { actorUserId: { in: ids } } : {}) };
  }

  private static readonly SHARE_FAILED: Prisma.ShareActionWhereInput = { OR: [{ handoffResult: 'FAILED' }, { deliveryStatus: 'FAILED' }] };

  async summary(actor: Actor, q: OversightSummaryQuery, now = new Date()) {
    const r = this.range(q, now);
    const ids = await this.scope(actor, { managerId: q.managerId, userId: q.telecallerId });
    const calls = this.callWhere(ids, r.from, r.to);
    const connected: Prisma.CallAttemptWhereInput = { ...calls, connectedAt: { not: null } };
    const shares = this.shareWhere(ids, r.from, r.to);
    const c = this.prisma.client;
    const [total, confirmed, byState, conn, reasons, recRows, shareKinds, shareOutcome, att1, att2, att3, att4, att5] = await Promise.all([
      c.callAttempt.count({ where: calls }),
      c.callAttempt.count({ where: { ...calls, providerCallId: { not: null } } }),
      c.callAttempt.groupBy({ by: ['providerState'], where: calls, _count: { _all: true } }),
      c.callAttempt.aggregate({ where: connected, _count: { _all: true }, _sum: { durationSec: true } }),
      c.callAttempt.groupBy({ by: ['failureReason'], where: { ...calls, failureReason: { not: null } }, _count: { _all: true }, orderBy: { _count: { failureReason: 'desc' } }, take: 5 }),
      c.callRecording.groupBy({ by: ['status'], where: { callAttempt: connected }, _count: { _all: true } }),
      c.shareAction.groupBy({ by: ['kind'], where: shares, _count: { _all: true } }),
      c.shareAction.groupBy({ by: ['channel', 'handoffResult', 'deliveryStatus'], where: shares, _count: { _all: true } }),
      c.callAttempt.count({ where: { AND: [calls, this.attentionWhere('NO_PROVIDER_CONFIRMATION', now)] } }),
      c.callAttempt.count({ where: { AND: [calls, this.attentionWhere('FAILED_BEFORE_PROVIDER', now)] } }),
      c.callAttempt.count({ where: { AND: [calls, this.attentionWhere('RECORDING_FAILED', now)] } }),
      c.callAttempt.count({ where: { AND: [calls, this.attentionWhere('RECORDING_OVERDUE', now)] } }),
      c.shareAction.count({ where: { AND: [shares, OversightService.SHARE_FAILED] } }),
    ]);
    const rec = Object.fromEntries(recRows.map((x) => [x.status, x._count._all])) as Partial<Record<string, number>>;
    const connectedN = conn._count._all;
    const recordedRows = (rec.AVAILABLE ?? 0) + (rec.PENDING ?? 0) + (rec.FAILED ?? 0);
    const sum = (f: (x: (typeof shareOutcome)[number]) => boolean) => shareOutcome.filter(f).reduce((n, x) => n + x._count._all, 0);
    const sharesTotal = sum(() => true);
    return {
      range: { from: r.from.toISOString(), to: r.to.toISOString(), fromDay: r.fromDay, toDay: r.toDay },
      dateBasis: { calls: 'KBS call initiated time', shares: 'KBS share action time' },
      thresholds: { liveWindowMinutes: CALL_LIVE_WINDOW_MINUTES, recordingOverdueMinutes: RECORDING_OVERDUE_MINUTES },
      calls: {
        source: 'TELEPHONY_PROVIDER' as const,
        initiated: total,
        providerConfirmed: confirmed,
        failedBeforeProvider: att2,
        byState: Object.fromEntries(byState.map((x) => [x.providerState, x._count._all])),
        connected: connectedN,
        talkTimeSec: conn._sum.durationSec ?? 0,
        topFailureReasons: reasons.map((x) => ({ reason: x.failureReason as string, count: x._count._all })),
      },
      recordings: {
        source: 'TELEPHONY_PROVIDER' as const,
        denominator: connectedN,
        denominatorLabel: 'provider-connected calls',
        available: rec.AVAILABLE ?? 0,
        pending: rec.PENDING ?? 0,
        failed: rec.FAILED ?? 0,
        noneRecorded: Math.max(0, connectedN - recordedRows),
        overdue: att4,
      },
      shares: {
        source: 'KBS_SHARING' as const,
        total: sharesTotal,
        byKind: Object.fromEntries(shareKinds.map((x) => [x.kind, x._count._all])),
        handoffOpened: sum((x) => x.channel === 'WHATSAPP_HANDOFF' && x.handoffResult === 'OPENED'),
        handoffFailed: sum((x) => x.handoffResult === 'FAILED'),
        /** Provider statuses only — hand-off shares are never counted here (WA-01). */
        provider: {
          sent: sum((x) => x.channel === 'WHATSAPP_BUSINESS_API' && x.deliveryStatus === 'SENT'),
          delivered: sum((x) => x.channel === 'WHATSAPP_BUSINESS_API' && x.deliveryStatus === 'DELIVERED'),
          failed: sum((x) => x.channel === 'WHATSAPP_BUSINESS_API' && x.deliveryStatus === 'FAILED'),
          awaiting: sum((x) => x.channel === 'WHATSAPP_BUSINESS_API' && x.handoffResult === 'OPENED' && x.deliveryStatus === 'UNKNOWN'),
        },
        deliveryNotReported: sum((x) => x.channel === 'WHATSAPP_HANDOFF' && x.handoffResult === 'OPENED'),
      },
      attention: { NO_PROVIDER_CONFIRMATION: att1, FAILED_BEFORE_PROVIDER: att2, RECORDING_FAILED: att3, RECORDING_OVERDUE: att4, SHARE_FAILED: att5 },
    };
  }

  async calls(actor: Actor, q: OversightCallsQuery, now = new Date()) {
    const r = this.range(q, now);
    const ids = await this.scope(actor, { managerId: q.managerId, userId: q.telecallerId });
    const and: Prisma.CallAttemptWhereInput[] = [this.callWhere(ids, r.from, r.to)];
    if (q.state) and.push({ providerState: q.state });
    if (q.recording === 'NONE') and.push({ OR: [{ recording: { is: null } }, { recording: { is: { status: 'NOT_ATTEMPTED' } } }] });
    else if (q.recording) and.push({ recording: { is: { status: q.recording } } });
    if (q.attention) and.push(this.attentionWhere(q.attention, now));
    const where: Prisma.CallAttemptWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.client.callAttempt.findMany({
        where,
        orderBy: { initiatedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          recording: { select: { status: true, durationSec: true, failureReason: true } },
          telecaller: { select: { id: true, fullName: true, employeeCode: true } },
          callingRecord: { select: { id: true, fullName: true, mobile: true } },
        },
      }),
      this.prisma.client.callAttempt.count({ where }),
    ]);
    const data = rows.map((a) => ({
      id: a.id,
      initiatedAt: a.initiatedAt.toISOString(),
      telecaller: a.telecaller,
      customer: { id: a.callingRecord.id, fullName: a.callingRecord.fullName, mobileMasked: maskMobile(a.callingRecord.mobile) ?? a.targetMobileMasked },
      providerKey: a.providerKey,
      providerCallId: a.providerCallId,
      providerState: a.providerState,
      connectedAt: a.connectedAt?.toISOString() ?? null,
      endedAt: a.endedAt?.toISOString() ?? null,
      durationSec: a.durationSec,
      failureReason: a.failureReason,
      recording: recordingChip(a.recording?.status),
      recordingStatus: a.recording?.status ?? null,
      recordingFailureReason: a.recording?.failureReason ?? null,
      canPlay: a.recording?.status === 'AVAILABLE',
      attention: callAttention({ providerState: a.providerState, providerCallId: a.providerCallId, initiatedAt: a.initiatedAt, connectedAt: a.connectedAt, endedAt: a.endedAt, recordingStatus: a.recording?.status ?? null }, now),
    }));
    return new Paginated(data, q.page, q.pageSize, total, { dateBasis: 'KBS call initiated time', range: { from: r.fromDay, to: r.toDay } });
  }

  async shares(actor: Actor, q: OversightSharesQuery, now = new Date()) {
    const r = this.range(q, now);
    const ids = await this.scope(actor, { managerId: q.managerId, userId: q.actorId });
    const where: Prisma.ShareActionWhereInput = {
      AND: [
        this.shareWhere(ids, r.from, r.to),
        q.kind ? { kind: q.kind } : {},
        q.channel ? { channel: q.channel } : {},
        q.handoff ? { handoffResult: q.handoff } : {},
        q.delivery ? { deliveryStatus: q.delivery } : {},
        q.attention ? OversightService.SHARE_FAILED : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.shareAction.findMany({
        where,
        orderBy: { at: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          actor: { select: { id: true, fullName: true, role: true, employeeCode: true } },
          callingRecord: { select: { id: true, fullName: true } },
          lead: { select: { id: true, publicRef: true, customerFullName: true } },
          card: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.shareAction.count({ where }),
    ]);
    const data = rows.map((s) => ({
      id: s.id,
      at: s.at.toISOString(),
      actor: s.actor,
      customer: s.callingRecord ? { type: 'CALLING_RECORD' as const, id: s.callingRecord.id, fullName: s.callingRecord.fullName, ref: null } : s.lead ? { type: 'LEAD' as const, id: s.lead.id, fullName: s.lead.customerFullName, ref: s.lead.publicRef } : null,
      kind: s.kind,
      card: s.card,
      assetVersionRef: s.assetVersionRef,
      targetMobileMasked: s.targetMobileMasked,
      channel: s.channel,
      handoffResult: s.handoffResult,
      deliveryStatus: s.deliveryStatus,
      deliveryLabel: shareDeliveryLabel(s.channel, s.handoffResult, s.deliveryStatus),
      attention: s.handoffResult === 'FAILED' || s.deliveryStatus === 'FAILED' ? (['SHARE_FAILED'] as const) : [],
    }));
    return new Paginated(data, q.page, q.pageSize, total, { dateBasis: 'KBS share action time', range: { from: r.fromDay, to: r.toDay } });
  }
}
