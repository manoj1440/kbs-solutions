import { Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';

export const ALLOCATION_ALGORITHM_VERSION = 'v1';
export type AllocationAlgorithm = 'ROUND_ROBIN_EQUAL' | 'WEIGHTED_BY_CAPACITY' | 'REGION_PREFERRED';

export interface AllocationResult {
  batchId: string;
  ran: boolean;
  /** Present when `ran=false`: why allocation did not happen (visible to Admin, REQ-21 §21.2 / REQ-06 §6.4). */
  blockedReason?: 'COMPLIANCE_NOT_CONFIRMED' | 'NO_ELIGIBLE_TELECALLER' | 'NOTHING_TO_ALLOCATE';
  assigned: number;
  unassigned: number;
  perTelecaller: Record<string, number>;
  algorithm: AllocationAlgorithm;
}

interface Eligible {
  userId: string;
  fullName: string;
  employeeCode: string | null;
  active: number;
  headroom: number | null;
  preferredStates: string[];
}

/**
 * F-305: allocation of accepted, unassigned calling records to trained, active Telecallers.
 * Only records with `reviewStatus=ACCEPTED`, not hidden, not suppressed, and `assignedTelecallerUserId=null` are ever touched;
 * existing assignments are never redistributed automatically (REQ-06 §6.2).
 */
@Injectable()
export class AllocationService {
  private readonly log = new Logger(AllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  algorithm(): AllocationAlgorithm {
    const a = this.config.getString('allocation.algorithm') ?? 'ROUND_ROBIN_EQUAL';
    return (['ROUND_ROBIN_EQUAL', 'WEIGHTED_BY_CAPACITY', 'REGION_PREFERRED'].includes(a) ? a : 'ROUND_ROBIN_EQUAL') as AllocationAlgorithm;
  }

  /** Compliance gate (REQ-21 §21.2): global compliance confirmation OR per-batch attestation. */
  private async allowed(batchId: string) {
    const batch = await this.prisma.client.customerImportBatch.findUnique({ where: { id: batchId }, select: { consentRepresentationConfirmed: true, status: true } });
    if (!batch) throw AppError.notFound('Batch');
    return batch.status === 'IMPORTED' && (this.config.getBool('compliance.callingListConsentConfirmedByCompliance') || batch.consentRepresentationConfirmed);
  }

  /** Called after import/review; silently no-ops when the gate is closed so the batch stays "imported but unallocated". */
  async allocateBatchIfAllowed(actor: Actor, batchId: string): Promise<AllocationResult> {
    if (!(await this.allowed(batchId))) {
      const unassigned = await this.prisma.client.callingRecord.count({ where: { batchId, reviewStatus: 'ACCEPTED', assignedTelecallerUserId: null, hiddenAt: null } });
      return { batchId, ran: false, blockedReason: 'COMPLIANCE_NOT_CONFIRMED', assigned: 0, unassigned, perTelecaller: {}, algorithm: this.algorithm() };
    }
    return this.allocateBatch(actor, batchId);
  }

  /** Explicit Admin run (`POST /allocation/run`); fails loudly when the gate is closed. */
  async run(actor: Actor, batchId: string): Promise<AllocationResult> {
    if (!(await this.allowed(batchId))) throw new AppError('CONFLICT', 'Calling-list consent is not confirmed for this batch (compliance confirmation or per-batch attestation required).');
    return this.allocateBatch(actor, batchId);
  }

  async eligiblePool(): Promise<Eligible[]> {
    const cap = this.config.getInt('allocation.maxActivePerTelecaller');
    const users = await this.prisma.client.user.findMany({
      where: { role: 'TELECALLER', status: 'ACTIVE', trainingEnrollment: { status: 'PASSED' } },
      select: { id: true, fullName: true, employeeCode: true },
      orderBy: [{ employeeCode: 'asc' }, { createdAt: 'asc' }],
    });
    if (!users.length) return [];
    const loads = await this.prisma.client.callingRecord.groupBy({
      by: ['assignedTelecallerUserId'],
      where: { assignedTelecallerUserId: { in: users.map((u) => u.id) }, hiddenAt: null, interactionStatus: { notIn: ['COMPLETED', 'DECLINED', 'UNREACHABLE'] } },
      _count: { _all: true },
    });
    const load = new Map(loads.map((l) => [l.assignedTelecallerUserId as string, l._count._all]));
    const regionPrefs = this.config.getJson<Record<string, string[]>>('allocation.regionPreferences') ?? {};
    return users
      .map((u) => {
        const active = load.get(u.id) ?? 0;
        const prefs = (u.employeeCode && regionPrefs[u.employeeCode]) || [];
        return { userId: u.id, fullName: u.fullName, employeeCode: u.employeeCode, active, headroom: cap === null ? null : Math.max(0, cap - active), preferredStates: prefs };
      })
      .filter((e) => e.headroom === null || e.headroom > 0);
  }

  private async allocateBatch(actor: Actor, batchId: string): Promise<AllocationResult> {
    const algorithm = this.algorithm();
    const records = await this.prisma.client.callingRecord.findMany({
      where: { batchId, reviewStatus: 'ACCEPTED', assignedTelecallerUserId: null, hiddenAt: null, suppressed: false },
      select: { id: true, resolvedState: true },
      orderBy: { sourceRowNumber: 'asc' },
    });
    if (!records.length) return { batchId, ran: true, blockedReason: 'NOTHING_TO_ALLOCATE', assigned: 0, unassigned: 0, perTelecaller: {}, algorithm };
    const pool = await this.eligiblePool();
    if (!pool.length) {
      this.log.warn(`allocation: no eligible Telecaller for batch ${batchId}; ${records.length} record(s) stay unassigned`);
      return { batchId, ran: true, blockedReason: 'NO_ELIGIBLE_TELECALLER', assigned: 0, unassigned: records.length, perTelecaller: {}, algorithm };
    }

    const plan = this.plan(algorithm, pool, records);
    const perTelecaller: Record<string, number> = {};
    const now = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      for (const [recordId, userId] of plan) {
        await tx.callingRecord.update({ where: { id: recordId }, data: { assignedTelecallerUserId: userId, assignedAt: now } });
        await tx.allocationEvent.create({
          data: { callingRecordId: recordId, fromTelecallerUserId: null, toTelecallerUserId: userId, batchId, actorUserId: actor.userId, reason: 'AUTO_ALLOCATION', algorithmVersion: `${algorithm}:${ALLOCATION_ALGORITHM_VERSION}` },
        });
        perTelecaller[userId] = (perTelecaller[userId] ?? 0) + 1;
      }
      await tx.customerImportBatch.update({ where: { id: batchId }, data: { allocatedAt: now } });
    });
    for (const [userId, n] of Object.entries(perTelecaller)) {
      await this.notifications.notify({
        recipientUserId: userId,
        kind: 'ASSIGNMENT_NEW',
        title: `New customers assigned (${n})`,
        body: `${n} new customer${n === 1 ? '' : 's'} added to your calling queue.`,
        deepLink: { entityType: 'CallingQueue', entityId: userId },
        sourceRef: { batchId },
        dedupeKey: `assignment:${batchId}:${userId}:${now.getTime()}`,
      });
    }
    RequestContextStore.audit({ entityId: batchId, after: { algorithm, assigned: plan.size, unassigned: records.length - plan.size, perTelecaller } });
    return { batchId, ran: true, assigned: plan.size, unassigned: records.length - plan.size, perTelecaller, algorithm };
  }

  /**
   * Deterministic plan. ROUND_ROBIN_EQUAL: always give the next record to the least-loaded Telecaller (ties by employee code, then name),
   * which yields the 4/3/3 split for 10 records over 3 fresh Telecallers. WEIGHTED_BY_CAPACITY: same, but the "load" is filled-fraction
   * of the cap. REGION_PREFERRED: first choose among Telecallers preferring the record's state, else fall back to ROUND_ROBIN_EQUAL.
   */
  plan(algorithm: AllocationAlgorithm, pool: Eligible[], records: { id: string; resolvedState: string | null }[]): Map<string, string> {
    const out = new Map<string, string>();
    const cap = this.config.getInt('allocation.maxActivePerTelecaller');
    const state = pool.map((p) => ({ ...p, given: 0 }));
    const canTake = (p: (typeof state)[number]) => cap === null || p.active + p.given < cap;
    const score = (p: (typeof state)[number]) => (algorithm === 'WEIGHTED_BY_CAPACITY' && cap ? (p.active + p.given) / cap : p.active + p.given);
    const pick = (cands: typeof state) =>
      cands
        .filter(canTake)
        .sort((a, b) => score(a) - score(b) || (a.employeeCode ?? '￿').localeCompare(b.employeeCode ?? '￿') || a.fullName.localeCompare(b.fullName) || a.userId.localeCompare(b.userId))[0];
    for (const r of records) {
      let chosen: (typeof state)[number] | undefined;
      if (algorithm === 'REGION_PREFERRED' && r.resolvedState) {
        const st = r.resolvedState.toUpperCase();
        chosen = pick(state.filter((p) => p.preferredStates.some((s) => s.toUpperCase() === st)));
      }
      chosen ??= pick(state);
      if (!chosen) break; // everyone at cap → remaining stay unassigned
      chosen.given++;
      out.set(r.id, chosen.userId);
    }
    return out;
  }

  /** Org / team / own totals (REQ-06 §6.4 visibility). */
  async batchTotals(batchId: string) {
    const [byStatus, assigned, unassigned, hidden, suppressed] = await Promise.all([
      this.prisma.client.callingRecord.groupBy({ by: ['reviewStatus'], where: { batchId }, _count: { _all: true } }),
      this.prisma.client.callingRecord.count({ where: { batchId, assignedTelecallerUserId: { not: null } } }),
      this.prisma.client.callingRecord.count({ where: { batchId, reviewStatus: 'ACCEPTED', hiddenAt: null, assignedTelecallerUserId: null } }),
      this.prisma.client.callingRecord.count({ where: { batchId, hiddenAt: { not: null } } }),
      this.prisma.client.callingRecord.count({ where: { batchId, suppressed: true } }),
    ]);
    return { byReviewStatus: Object.fromEntries(byStatus.map((s) => [s.reviewStatus, s._count._all])), assigned, unassigned, hidden, suppressed };
  }
}
