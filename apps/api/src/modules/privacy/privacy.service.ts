import {
  DATA_REQUEST_REF_PREFIX,
  DATA_REQUEST_TARGET_DAYS,
  DATA_REQUEST_TRANSITIONS,
  DATA_REQUEST_TYPE_LABEL,
  type DataRequestAdminView,
  type DataRequestCreateBody,
  type DataRequestListQuery,
  type DataRequestStatus,
  type DataRequestUpdateBody,
  type DataRequestView,
  makePublicRef,
  maskMobile,
  type PersonalDataExport,
  type RefPrefix,
} from '@kbs/shared';
import { Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const DAY = 86_400_000;
/** Upper bound on rows per section of a download, so one request never reads an unbounded set. */
const EXPORT_ROW_CAP = 5000;
const ACTIVE: DataRequestStatus[] = ['OPEN', 'IN_PROGRESS'];

interface StoredConsent {
  privacyNoticeVersion?: string;
  at?: string;
  scopes?: string[];
  identityConsent?: boolean;
  termsAccepted?: boolean;
}

const requestInclude = {
  requester: { select: { id: true, publicRef: true, fullName: true, role: true, status: true, mobile: true } },
  handledBy: { select: { id: true, fullName: true } },
} as const;

type RequestRow = {
  id: string;
  publicRef: string;
  type: DataRequestView['type'];
  status: DataRequestStatus;
  details: string | null;
  staffNote: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  dueAt: Date;
  closedAt: Date | null;
};

/**
 * F-908 data-principal rights (DPDP Act 2023 ss.11-13). Any signed-in user files requests and downloads their own data;
 * the Admin works the queue by hand. Nothing here deletes or anonymises anything — erasure is carried out by staff.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private view(r: RequestRow, asOf = new Date()): DataRequestView {
    return {
      id: r.id,
      publicRef: r.publicRef,
      type: r.type,
      status: r.status,
      details: r.details,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      provenance: 'KBS_OPERATIONAL',
      asOf: asOf.toISOString(),
    };
  }

  private adminView(r: RequestRow & { requester: { id: string; publicRef: string; fullName: string; role: string; status: string; mobile: string }; handledBy: { id: string; fullName: string } | null }): DataRequestAdminView {
    const now = new Date();
    return {
      ...this.view(r, now),
      staffNote: r.staffNote,
      overdue: ACTIVE.includes(r.status) && r.dueAt.getTime() < now.getTime(),
      requester: { id: r.requester.id, publicRef: r.requester.publicRef, fullName: r.requester.fullName, role: r.requester.role, status: r.requester.status, mobileMasked: maskMobile(r.requester.mobile) },
      handledBy: r.handledBy,
    };
  }

  async create(actor: Actor, body: DataRequestCreateBody): Promise<DataRequestView> {
    const active = await this.prisma.client.dataRequest.findFirst({ where: { requesterUserId: actor.userId, type: body.type, status: { in: ACTIVE } }, select: { publicRef: true } });
    if (active) throw new AppError('CONFLICT', `You already have an open request of this kind (${active.publicRef}). KBS will reply to that one first.`, { publicRef: active.publicRef });
    const now = new Date();
    let row: RequestRow;
    try {
      row = await this.prisma.client.dataRequest.create({
        data: {
          publicRef: makePublicRef(DATA_REQUEST_REF_PREFIX as RefPrefix),
          requesterUserId: actor.userId,
          type: body.type,
          details: body.details?.length ? body.details : null,
          dueAt: new Date(now.getTime() + DATA_REQUEST_TARGET_DAYS * DAY),
        },
      });
    } catch (e) {
      // two parallel submits: the partial unique index (one active request per type) refuses the second
      if ((e as { code?: string }).code === 'P2002') throw new AppError('CONFLICT', 'You already have an open request of this kind. KBS will reply to that one first.');
      throw e;
    }
    RequestContextStore.audit({ entityType: 'DataRequest', entityId: row.id, after: { type: row.type, publicRef: row.publicRef } });
    await this.notifyAdmins(row).catch((e: unknown) => this.logger.warn({ dataRequestId: row.id, err: (e as Error).message }, 'data request notification failed'));
    return this.view(row, now);
  }

  /** The Admin gets an in-app notification (and push) naming the request reference and type only — no user details. */
  private async notifyAdmins(row: RequestRow) {
    const admins = await this.prisma.client.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await this.notifications.notifyMany(
      admins.map((a) => a.id),
      {
        kind: 'DATA_REQUEST',
        title: 'New data request',
        body: `${DATA_REQUEST_TYPE_LABEL[row.type]} · ${row.publicRef}. Target: reply within ${DATA_REQUEST_TARGET_DAYS} days.`,
        deepLink: { entityType: 'DataRequest', entityId: row.id },
        dedupeKey: `data-request:${row.id}`,
      },
    );
  }

  async mine(actor: Actor): Promise<DataRequestView[]> {
    const rows = await this.prisma.client.dataRequest.findMany({ where: { requesterUserId: actor.userId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const now = new Date();
    return rows.map((r) => this.view(r, now));
  }

  async list(q: DataRequestListQuery) {
    const where = {
      ...(q.type ? { type: q.type } : {}),
      ...(q.status ? { status: q.status } : q.queue === 'open' ? { status: { in: ACTIVE } } : q.queue === 'closed' ? { status: { in: ['COMPLETED', 'REJECTED'] as DataRequestStatus[] } } : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.prisma.client.dataRequest.findMany({ where, include: requestInclude, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.dataRequest.count({ where }),
      this.prisma.client.dataRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const overdue = await this.prisma.client.dataRequest.count({ where: { status: { in: ACTIVE }, dueAt: { lt: new Date() } } });
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    return new Paginated(rows.map((r) => this.adminView(r)), q.page, q.pageSize, total, { counts: { ...byStatus, overdue } });
  }

  async get(id: string): Promise<DataRequestAdminView> {
    const r = await this.prisma.client.dataRequest.findUnique({ where: { id }, include: requestInclude });
    if (!r) throw AppError.notFound('Request');
    return this.adminView(r);
  }

  async update(actor: Actor, id: string, body: DataRequestUpdateBody): Promise<DataRequestAdminView> {
    const before = await this.prisma.client.dataRequest.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Request');
    if (!ACTIVE.includes(before.status)) throw new AppError('CONFLICT', 'This request is closed. File notes on a new request instead.', { status: before.status });
    const next = body.status && body.status !== before.status ? body.status : undefined;
    if (next && !DATA_REQUEST_TRANSITIONS[before.status].includes(next)) throw new AppError('CONFLICT', `A request that is ${before.status.toLowerCase().replace('_', ' ')} cannot move to ${next.toLowerCase().replace('_', ' ')}.`);
    const closing = next === 'COMPLETED' || next === 'REJECTED';
    // compare-and-set on the status read above: two staff closing at once cannot both win
    const res = await this.prisma.client.dataRequest.updateMany({
      where: { id, status: before.status },
      data: {
        ...(next ? { status: next } : {}),
        ...(closing ? { closedAt: new Date(), resolutionNote: body.resolutionNote } : {}),
        ...(body.staffNote !== undefined ? { staffNote: body.staffNote || null } : {}),
        // taking it, moving it on or closing it makes the caller the handler
        ...(body.assignToMe || next ? { handledByUserId: actor.userId } : {}),
      },
    });
    if (res.count === 0) throw new AppError('CONFLICT', 'Someone else changed this request. Reload and try again.');
    RequestContextStore.audit({
      entityType: 'DataRequest',
      entityId: id,
      before: { status: before.status, handledByUserId: before.handledByUserId },
      after: { status: next ?? before.status, handledByUserId: body.assignToMe || next ? actor.userId : before.handledByUserId, staffNoteChanged: body.staffNote !== undefined, closed: closing },
      reason: closing ? body.resolutionNote : undefined,
    });
    if (closing) {
      await this.notifications
        .notify({
          recipientUserId: before.requesterUserId,
          kind: 'DATA_REQUEST',
          title: next === 'COMPLETED' ? 'Your data request is complete' : 'Your data request was declined',
          body: `${DATA_REQUEST_TYPE_LABEL[before.type]} · ${before.publicRef}. Open "Your data" to read KBS's reply.`,
          dedupeKey: `data-request:${id}:closed`,
        })
        .catch((e: unknown) => this.logger.warn({ dataRequestId: id, err: (e as Error).message }, 'data request close notification failed'));
    }
    return this.get(id);
  }

  /**
   * Self-service download of the caller's own personal data. Masked by construction — the export never decrypts PAN or
   * bank numbers (only the stored last 4 are read) and shows the customers on the caller's leads by lead reference only.
   */
  async exportMine(actor: Actor): Promise<PersonalDataExport> {
    const userId = actor.userId;
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { publicRef: true, fullName: true, mobile: true, email: true, role: true, status: true, employeeCode: true, createdAt: true, lastLoginAt: true },
    });
    if (!user) throw AppError.notFound('Account');
    const [profile, reporting, leads, payouts, sessions, requests] = await Promise.all([
      this.prisma.client.advisorProfile.findUnique({
        where: { userId },
        // explicit select: the encrypted account number is never read here
        select: { onboardingStep: true, identityStatus: true, identityMethod: true, identityVerifiedAt: true, bankName: true, ifsc: true, bankAccountLast4: true, accountHolderName: true, chequeFileId: true, submittedAt: true, reviewOutcome: true, consentRecords: true },
      }),
      this.prisma.client.reportingAssignment.findMany({ where: { childUserId: userId, status: 'ACTIVE' }, orderBy: { effectiveFrom: 'asc' }, take: EXPORT_ROW_CAP, select: { effectiveFrom: true, effectiveTo: true, parent: { select: { fullName: true, role: true } } } }),
      this.prisma.client.lead.findMany({
        where: { advisorUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: EXPORT_ROW_CAP,
        // customer name, mobile and PAN are deliberately not selected
        select: { publicRef: true, createdAt: true, card: { select: { name: true } }, bank: { select: { displayName: true } }, statusSnapshot: { select: { currentStage: true, finalDecision: true, cardActivationStatus: true, lastMatchedAt: true } } },
      }),
      this.prisma.client.payoutRequest.findMany({ where: { advisorUserId: userId }, orderBy: { submittedAt: 'desc' }, take: EXPORT_ROW_CAP, select: { publicRef: true, state: true, itemCount: true, totalAmountInr: true, submittedAt: true, paidAt: true } }),
      this.prisma.client.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 200, select: { platform: true, userAgent: true, createdAt: true, lastSeenAt: true, revokedAt: true } }),
      this.prisma.client.dataRequest.findMany({ where: { requesterUserId: userId }, orderBy: { createdAt: 'desc' }, take: 200, select: { publicRef: true, type: true, status: true, createdAt: true, closedAt: true } }),
    ]);
    const consents = ((profile?.consentRecords as StoredConsent[] | null) ?? []).map((c) => ({
      privacyNoticeVersion: c.privacyNoticeVersion ?? '',
      at: c.at ?? '',
      scopes: c.scopes ?? [...(c.identityConsent ? ['IDENTITY_VERIFICATION'] : []), ...(c.termsAccepted ? ['PRIVACY_NOTICE_AND_TERMS'] : [])],
    }));
    RequestContextStore.audit({ entityType: 'User', entityId: userId, after: { leads: leads.length, payoutRequests: payouts.length, sessions: sessions.length } });
    return {
      format: 'kbs-personal-data/v1',
      generatedAt: new Date().toISOString(),
      notice:
        'Your personal data held by KBS Solutions. PAN and bank account numbers show the last 4 digits only. Customers on your leads appear by lead reference only: their details belong to them. Bank values are copied exactly as the bank reported them.',
      profile: {
        publicRef: user.publicRef,
        fullName: user.fullName,
        mobileMasked: maskMobile(user.mobile),
        email: user.email,
        role: user.role,
        status: user.status,
        employeeCode: user.employeeCode,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      payeeProfile: profile
        ? {
            onboardingStep: profile.onboardingStep,
            identity: { status: profile.identityStatus, method: profile.identityMethod, verifiedAt: profile.identityVerifiedAt?.toISOString() ?? null },
            bank: profile.bankAccountLast4 || profile.bankName ? { bankName: profile.bankName, ifsc: profile.ifsc, accountLast4: profile.bankAccountLast4, accountHolderName: profile.accountHolderName } : null,
            chequeOnFile: Boolean(profile.chequeFileId),
            submittedAt: profile.submittedAt?.toISOString() ?? null,
            reviewOutcome: profile.reviewOutcome,
            consents,
          }
        : null,
      reportingHistory: reporting.map((r) => ({ parentName: r.parent.fullName, parentRole: r.parent.role, from: r.effectiveFrom.toISOString(), to: r.effectiveTo?.toISOString() ?? null })),
      leads: leads.map((l) => ({
        publicRef: l.publicRef,
        card: l.card.name,
        bank: l.bank.displayName,
        createdAt: l.createdAt.toISOString(),
        bankStage: l.statusSnapshot?.currentStage ?? null,
        bankDecision: l.statusSnapshot?.finalDecision ?? null,
        cardActivation: l.statusSnapshot?.cardActivationStatus ?? null,
        bankAsOf: l.statusSnapshot?.lastMatchedAt.toISOString() ?? null,
      })),
      payoutRequests: payouts.map((p) => ({ publicRef: p.publicRef, state: p.state, itemCount: p.itemCount, amountInr: p.totalAmountInr?.toString() ?? null, submittedAt: p.submittedAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null })),
      sessions: sessions.map((s) => ({ platform: s.platform, device: s.userAgent, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), active: s.revokedAt === null })),
      dataRequests: requests.map((r) => ({ publicRef: r.publicRef, type: r.type, status: r.status, createdAt: r.createdAt.toISOString(), closedAt: r.closedAt?.toISOString() ?? null })),
    };
  }
}
