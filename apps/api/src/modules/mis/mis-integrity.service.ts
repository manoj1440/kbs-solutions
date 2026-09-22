import type { Prisma } from '@kbs/db';
import { maskName } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface MisIntegrityQuery {
  bankId?: string;
  from?: string;
  to?: string;
}

export interface BankIntegrity {
  bank: { id: string; code: string; displayName: string };
  lastUploadAt: string | null;
  lastAppliedAt: string | null;
  batches: Record<string, number>;
  rows: { imported: number; matched: number; unmatched: number; invalid: number; conflicted: number; duplicate: number; ignored: number; pending: number };
  /** Values seen in previews that are still not in the approved profile's knownValues. */
  newValuesPending: { field: string; values: string[] }[];
  duplicateKeys: number;
  correctionsUnderReview: number;
  leads: { total: number; neverMatched: number; matchedOlderThan7d: number; matchedOlderThan30d: number };
  advisorReferencesNeverMatched: number;
  quarantine: number;
}

/**
 * F-507 — MIS integrity & freshness (REQ-16 §16.2 row "MIS integrity and freshness", REQ-13 §13.8).
 * Every figure is derived from stored rows/batches so it reconciles with batch totals; freshness is per lead, never global.
 */
@Injectable()
export class MisIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(q: MisIntegrityQuery): Promise<{ generatedAt: string; range: { from: string | null; to: string | null }; banks: BankIntegrity[] }> {
    const banks = await this.prisma.client.bank.findMany({ where: q.bankId ? { id: q.bankId } : {}, select: { id: true, code: true, displayName: true }, orderBy: { code: 'asc' } });
    const uploadedAt = q.from || q.to ? { ...(q.from ? { gte: new Date(`${q.from}T00:00:00+05:30`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00+05:30`).getTime() + 86_400_000) } : {}) } : undefined;
    const now = Date.now();
    const out: BankIntegrity[] = [];
    for (const bank of banks) {
      const batchWhere = { bankId: bank.id, ...(uploadedAt ? { uploadedAt } : {}) };
      const [batches, rowStates, approvedProfile, entUnderReview, leadTotal, neverMatched, older7, older30, advisorRefs] = await Promise.all([
        this.prisma.client.misImportBatch.findMany({ where: batchWhere, select: { id: true, stage: true, uploadedAt: true, appliedAt: true, preview: true } }),
        this.prisma.client.misRow.groupBy({ by: ['matchState'], where: { batch: batchWhere }, _count: { _all: true } }),
        this.prisma.client.misImportProfile.findFirst({ where: { bankId: bank.id, status: 'APPROVED' }, orderBy: { version: 'desc' }, select: { knownValues: true } }),
        this.prisma.client.payoutEntitlement.count({ where: { bankId: bank.id, state: 'UNDER_REVIEW' } }),
        this.prisma.client.lead.count({ where: { bankId: bank.id } }),
        this.prisma.client.lead.count({ where: { bankId: bank.id, statusSnapshot: null } }),
        this.prisma.client.bankStatusSnapshot.count({ where: { bankId: bank.id, lastMatchedAt: { lt: new Date(now - 7 * 86_400_000) } } }),
        this.prisma.client.bankStatusSnapshot.count({ where: { bankId: bank.id, lastMatchedAt: { lt: new Date(now - 30 * 86_400_000) } } }),
        this.prisma.client.bankApplicationLinkage.count({ where: { bankId: bank.id, supersededAt: null, source: 'ADVISOR_ENTERED', verificationStatus: { not: 'VERIFIED_BY_MIS_MATCH' } } }),
      ]);
      const state = (s: string) => rowStates.find((r) => r.matchState === s)?._count._all ?? 0;
      const stages: Record<string, number> = {};
      let duplicateKeys = 0;
      const pendingValues = new Map<string, Set<string>>();
      const known = ((approvedProfile?.knownValues as Record<string, string[]> | null) ?? {}) as Record<string, string[]>;
      for (const b of batches) {
        stages[b.stage] = (stages[b.stage] ?? 0) + 1;
        const report = (b.preview as { report?: { duplicateReferences?: unknown[]; newValues?: Record<string, string[]> } } | null)?.report;
        duplicateKeys += report?.duplicateReferences?.length ?? 0;
        for (const [f, vals] of Object.entries(report?.newValues ?? {})) for (const v of vals) if (!(known[f] ?? []).includes(v)) pendingValues.set(f, (pendingValues.get(f) ?? new Set()).add(v));
      }
      const last = (xs: (Date | null)[]) => xs.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null;
      out.push({
        bank,
        lastUploadAt: last(batches.map((b) => b.uploadedAt)),
        lastAppliedAt: last(batches.map((b) => b.appliedAt)),
        batches: stages,
        rows: { imported: rowStates.reduce((n, r) => n + r._count._all, 0), matched: state('MATCHED'), unmatched: state('UNMATCHED'), invalid: state('INVALID'), conflicted: state('CONFLICT'), duplicate: state('DUPLICATE_IN_BATCH'), ignored: state('IGNORED'), pending: state('PENDING') },
        newValuesPending: [...pendingValues.entries()].map(([field, values]) => ({ field, values: [...values].sort() })).sort((a, b) => a.field.localeCompare(b.field)),
        duplicateKeys,
        correctionsUnderReview: entUnderReview,
        leads: { total: leadTotal, neverMatched, matchedOlderThan7d: older7, matchedOlderThan30d: older30 },
        advisorReferencesNeverMatched: advisorRefs,
        quarantine: state('UNMATCHED') + state('CONFLICT'),
      });
    }
    return { generatedAt: new Date().toISOString(), range: { from: q.from ?? null, to: q.to ?? null }, banks: out };
  }

  /** Cross-batch quarantine: UNMATCHED / CONFLICT rows (masked) with their batch, for F-504 resolution. */
  async quarantine(q: { bankId?: string; state?: 'UNMATCHED' | 'CONFLICT'; page: number; pageSize: number }) {
    const where: Prisma.MisRowWhereInput = { matchState: q.state ? q.state : { in: ['UNMATCHED', 'CONFLICT'] }, ...(q.bankId ? { batch: { bankId: q.bankId } } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.client.misRow.findMany({ where, orderBy: [{ batch: { uploadedAt: 'desc' } }, { sourceRowNumber: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { batch: { select: { id: true, publicRef: true, uploadedAt: true, stage: true, bank: { select: { code: true, displayName: true } } } } } }),
      this.prisma.client.misRow.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => {
        const m = (r.mapped as Record<string, string>) ?? {};
        return { id: r.id, batch: r.batch, sourceRowNumber: r.sourceRowNumber, matchState: r.matchState, matchExplanation: r.matchExplanation, referenceValues: r.referenceValues, customer: maskName(m.customerName) ?? '', currentStage: m.currentStage ?? null, finalDecision: m.finalDecision ?? null, cardActivationStatus: m.cardActivationStatus ?? null };
      }),
      q.page,
      q.pageSize,
      total,
    );
  }
}
