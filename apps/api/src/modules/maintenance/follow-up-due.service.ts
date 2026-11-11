import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { MaintenanceProcessor } from './maintenance.processor';

export const FOLLOW_UP_DUE_JOB = 'followUps.notifyDue';
/** A follow-up that fell due longer ago than this is no longer announced (bounds each run; it was announced when it fell due). */
const LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const PAGE = 500;

/**
 * REQ-19 §19.1 "assigned follow-up due": every 5 minutes (worker mode or JOBS_INLINE, see MaintenanceProcessor)
 * - a calling record whose `nextFollowUpAt` has passed notifies its assigned Telecaller and that Telecaller's current Manager;
 * - an open lead follow-up task whose `dueAt` has passed notifies the task owner (the Advisor).
 * Dedupe keys carry the due timestamp, so one scheduled follow-up notifies once and a rescheduled one notifies again.
 * Never for hidden / suppressed / do-not-contact customers, declined or completed records, or non-ACTIVE users.
 * Text carries the customer name only — never the mobile (REQ-21 §21.1).
 */
@Injectable()
export class FollowUpDueService implements OnModuleInit {
  private readonly logger = new Logger(FollowUpDueService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly maintenance: MaintenanceProcessor,
  ) {}

  onModuleInit() {
    this.maintenance.schedule(FOLLOW_UP_DUE_JOB, { every: 5 * 60_000 }, () => this.run());
  }

  /** Idempotent: safe to run any number of times (the notification dedupe key absorbs repeats). */
  async run(now = new Date()): Promise<{ callingRecords: number; leadTasks: number }> {
    const since = new Date(now.getTime() - LOOKBACK_MS);
    const callingRecords = await this.callingFollowUps(now, since);
    const leadTasks = await this.leadTasks(now, since);
    if (callingRecords || leadTasks) this.logger.debug({ callingRecords, leadTasks }, 'follow-ups due checked');
    return { callingRecords, leadTasks };
  }

  private async suppressedMobiles(mobiles: string[]): Promise<Set<string>> {
    if (!mobiles.length) return new Set();
    const rows = await this.prisma.client.contactSuppression.findMany({ where: { mobile: { in: [...new Set(mobiles)] }, liftedAt: null }, select: { mobile: true } });
    return new Set(rows.map((r) => r.mobile));
  }

  /** Calling-queue follow-ups → assigned Telecaller + current Manager. Returns the number of due records considered. */
  private async callingFollowUps(now: Date, since: Date): Promise<number> {
    let cursor: string | undefined;
    let seen = 0;
    for (;;) {
      const rows = await this.prisma.client.callingRecord.findMany({
        where: {
          nextFollowUpAt: { lte: now, gte: since },
          hiddenAt: null,
          suppressed: false,
          restrictedAt: null,
          interactionStatus: { notIn: ['DECLINED', 'COMPLETED'] },
          assignedTelecaller: { is: { status: 'ACTIVE', role: 'TELECALLER' } },
        },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, fullName: true, mobile: true, nextFollowUpAt: true, assignedTelecallerUserId: true, assignedTelecaller: { select: { fullName: true } } },
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      // defence in depth: an active do-not-contact entry wins even if the record flag was not (yet) set
      const dnc = await this.suppressedMobiles(rows.map((r) => r.mobile));
      const due = rows.filter((r) => !dnc.has(r.mobile));
      const telecallerIds = [...new Set(due.map((r) => r.assignedTelecallerUserId as string))];
      const parents = telecallerIds.length
        ? await this.prisma.client.reportingAssignment.findMany({ where: { childUserId: { in: telecallerIds }, effectiveTo: null, status: 'ACTIVE' }, select: { childUserId: true, parent: { select: { id: true, role: true, status: true } } } })
        : [];
      const managerOf = new Map<string, string>();
      for (const p of parents) if (p.parent.role === 'MANAGER' && p.parent.status === 'ACTIVE') managerOf.set(p.childUserId, p.parent.id);
      for (const r of due) {
        const telecallerId = r.assignedTelecallerUserId as string;
        const at = (r.nextFollowUpAt as Date).getTime();
        const title = `Follow-up due: ${r.fullName}`;
        await this.notifications.notify({
          recipientUserId: telecallerId,
          kind: 'FOLLOW_UP_DUE',
          title,
          body: `Your follow-up call with ${r.fullName} is due now.`,
          deepLink: { entityType: 'CallingRecord', entityId: r.id },
          sourceRef: { callingRecordId: r.id, dueAt: (r.nextFollowUpAt as Date).toISOString() },
          dedupeKey: `followup-due:record:${r.id}:${at}:${telecallerId}`,
        });
        const managerId = managerOf.get(telecallerId);
        if (managerId) {
          await this.notifications.notify({
            recipientUserId: managerId,
            kind: 'FOLLOW_UP_DUE',
            title,
            body: `${r.assignedTelecaller?.fullName ?? 'Your Telecaller'} has a follow-up call with ${r.fullName} due now.`,
            // Managers open the Telecaller's page (its follow-up list); they have no calling-record screen
            deepLink: { entityType: 'User', entityId: telecallerId },
            sourceRef: { callingRecordId: r.id, telecallerUserId: telecallerId, dueAt: (r.nextFollowUpAt as Date).toISOString() },
            dedupeKey: `followup-due:record:${r.id}:${at}:${managerId}`,
          });
        }
      }
      seen += due.length;
      if (rows.length < PAGE) break;
    }
    return seen;
  }

  /** Open lead follow-up tasks (F-409) → the task owner. Returns the number of due tasks considered. */
  private async leadTasks(now: Date, since: Date): Promise<number> {
    let cursor: string | undefined;
    let seen = 0;
    for (;;) {
      const rows = await this.prisma.client.followUpTask.findMany({
        where: { leadId: { not: null }, doneAt: null, dueAt: { lte: now, gte: since }, owner: { is: { status: 'ACTIVE' } } },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, text: true, dueAt: true, ownerUserId: true, lead: { select: { id: true, publicRef: true, customerFullName: true, customerMobile: true } } },
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      const dnc = await this.suppressedMobiles(rows.flatMap((t) => (t.lead ? [t.lead.customerMobile] : [])));
      for (const t of rows) {
        if (!t.lead || dnc.has(t.lead.customerMobile)) continue;
        seen += 1;
        await this.notifications.notify({
          recipientUserId: t.ownerUserId,
          kind: 'FOLLOW_UP_DUE',
          title: `Follow-up due: ${t.lead.customerFullName}`,
          body: `${t.text} · lead ${t.lead.publicRef}`,
          deepLink: { entityType: 'Lead', entityId: t.lead.id },
          sourceRef: { followUpTaskId: t.id, leadId: t.lead.id, dueAt: t.dueAt.toISOString() },
          dedupeKey: `followup-due:task:${t.id}:${t.dueAt.getTime()}`,
        });
      }
      if (rows.length < PAGE) break;
    }
    return seen;
  }
}
