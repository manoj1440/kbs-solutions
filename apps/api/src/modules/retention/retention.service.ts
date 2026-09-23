import type { Prisma } from '@kbs/db';
import { type LegalHoldBody, RETENTION_CATEGORIES, RETENTION_CATEGORY_META, type RetentionCategory, type RetentionExecuteBody } from '@kbs/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';

const DAY_MS = 86_400_000;
/** MIS batches still in flight keep their source file whatever its age (REQ-24 §24.4 "preserve source files and support safe retry"). */
const MIS_TERMINAL = ['APPLIED', 'REJECTED', 'FAILED'] as const;
export const RESTRICTED_NAME = 'Restricted (retention)';

/**
 * F-904 data retention and deletion authority (REQ-21 §21.5, REQ-24 §24.4, INV-07). BLOCKED on KBS durations, so the
 * whole path fails closed: `plan()` is a read-only dry run; `execute()` refuses with CONFIG_MISSING until the category's
 * `retention.*Days` is set AND `retention.executionEnabled` is on.
 *
 * What is never touched, by construction: MIS rows / bank status snapshots and history, payout entitlements, requests
 * and payments, audit and sensitive-access logs, contact suppressions. Files are purged (object deleted, the StoredFile
 * row kept with `purgedAt` as the trace). Calling records are restricted (PII redacted, hidden from queues) — never
 * deleted. Anything under legal hold is skipped.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private days(category: RetentionCategory): number | null {
    const d = this.config.getInt(RETENTION_CATEGORY_META[category].configKey);
    return d !== null && Number.isFinite(d) && d > 0 ? d : null;
  }

  /** Where-clauses per category. `protectedWhere` = old enough but kept for a legitimate obligation (not legal hold). */
  private fileWheres(category: Exclude<RetentionCategory, 'CALLING_RECORDS'>, cutoff: Date) {
    const base: Prisma.StoredFileWhereInput = { purpose: { in: [...(RETENTION_CATEGORY_META[category].purposes ?? [])] as never }, createdAt: { lt: cutoff }, purgedAt: null };
    const protections: Prisma.StoredFileWhereInput[] = [
      // quarantined uploads are security evidence (F-902)
      { scanStatus: 'INFECTED' },
    ];
    if (category === 'DOCUMENTS') {
      protections.push(
        // payment proofs are part of the payout audit trail (REQ-21 §21.5: never silently delete payout audit)
        { purpose: 'PAYMENT_PROOF', paymentProofs: { some: {} } },
        // the cheque an Advisor profile still points at is live bank-verification evidence
        { purpose: 'CHEQUE', advisorCheques: { some: {} } },
        // the rendered file of a non-revoked ID card is in use
        { purpose: 'ID_CARD', idCards: { some: { revokedAt: null } } },
      );
    }
    if (category === 'MIS_FILES') protections.push({ misBatches: { some: { stage: { notIn: [...MIS_TERMINAL] } } } });
    return {
      base,
      held: { ...base, legalHold: true } satisfies Prisma.StoredFileWhereInput,
      protectedWhere: { ...base, legalHold: false, OR: protections } satisfies Prisma.StoredFileWhereInput,
      eligible: { ...base, legalHold: false, NOT: { OR: protections } } satisfies Prisma.StoredFileWhereInput,
    };
  }

  private recordWheres(cutoff: Date) {
    const base: Prisma.CallingRecordWhereInput = { restrictedAt: null, updatedAt: { lt: cutoff } };
    const protections: Prisma.CallingRecordWhereInput[] = [
      // still in someone's active queue
      { assignedTelecallerUserId: { not: null }, hiddenAt: null, suppressed: false },
      // an open follow-up is a live obligation to the customer
      { followUpTasks: { some: { doneAt: null } } },
    ];
    return {
      base,
      held: { ...base, legalHold: true } satisfies Prisma.CallingRecordWhereInput,
      protectedWhere: { ...base, legalHold: false, OR: protections } satisfies Prisma.CallingRecordWhereInput,
      eligible: { ...base, legalHold: false, NOT: { OR: protections } } satisfies Prisma.CallingRecordWhereInput,
    };
  }

  /** Read-only dry run for every category. */
  async plan() {
    const executionEnabled = this.config.getBool('retention.executionEnabled');
    const categories = await Promise.all(
      RETENTION_CATEGORIES.map(async (category) => {
        const meta = RETENTION_CATEGORY_META[category];
        const days = this.days(category);
        const alreadyDone =
          category === 'CALLING_RECORDS'
            ? await this.prisma.client.callingRecord.count({ where: { restrictedAt: { not: null } } })
            : await this.prisma.client.storedFile.count({ where: { purpose: { in: [...(meta.purposes ?? [])] as never }, purgedAt: { not: null } } });
        const onHoldTotal =
          category === 'CALLING_RECORDS'
            ? await this.prisma.client.callingRecord.count({ where: { legalHold: true } })
            : await this.prisma.client.storedFile.count({ where: { purpose: { in: [...(meta.purposes ?? [])] as never }, legalHold: true } });
        const common = { category, label: meta.label, configKey: meta.configKey, action: meta.action, days, onHoldTotal, alreadyDone };
        if (days === null) return { ...common, configured: false as const, cutoff: null, olderThanCutoff: null, onHold: null, protected: null, eligible: null, runnable: false, blockedReason: `${meta.configKey} is not set (REQ-21 §21.5 OPEN).` };
        const cutoff = new Date(Date.now() - days * DAY_MS);
        const [olderThanCutoff, onHold, protectedCount, eligible] =
          category === 'CALLING_RECORDS'
            ? await (async () => {
                const w = this.recordWheres(cutoff);
                return Promise.all([w.base, w.held, w.protectedWhere, w.eligible].map((where) => this.prisma.client.callingRecord.count({ where })));
              })()
            : await (async () => {
                const w = this.fileWheres(category, cutoff);
                return Promise.all([w.base, w.held, w.protectedWhere, w.eligible].map((where) => this.prisma.client.storedFile.count({ where })));
              })();
        return {
          ...common,
          configured: true as const,
          cutoff: cutoff.toISOString(),
          olderThanCutoff,
          onHold,
          protected: protectedCount,
          eligible,
          runnable: executionEnabled,
          blockedReason: executionEnabled ? null : 'retention.executionEnabled is off.',
        };
      }),
    );
    return {
      executionEnabled,
      neverRemoved: ['MIS rows, bank status snapshots and history', 'Payout entitlements, requests, payments and ledger', 'Audit and sensitive-access logs', 'Contact suppressions (do-not-contact list)'],
      categories,
    };
  }

  /** Authorised run for one category (Admin, with a reason). Fails closed; bounded by `limit`; everything audited. */
  async execute(actor: Actor, body: RetentionExecuteBody) {
    if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only Admin can run retention.');
    const meta = RETENTION_CATEGORY_META[body.category];
    const days = this.days(body.category);
    if (days === null) throw new AppError('CONFIG_MISSING', `${meta.configKey} is not set. KBS has not approved a retention duration for ${meta.label.toLowerCase()} (REQ-21 §21.5 OPEN).`, { key: meta.configKey });
    if (!this.config.getBool('retention.executionEnabled')) throw new AppError('CONFIG_MISSING', 'Retention runs are disabled (retention.executionEnabled).', { key: 'retention.executionEnabled' });
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const runAt = new Date();
    let processed = 0;
    const failures: { id: string; error: string }[] = [];

    if (body.category === 'CALLING_RECORDS') {
      const rows = await this.prisma.client.callingRecord.findMany({ where: this.recordWheres(cutoff).eligible, select: { id: true, mobile: true, hiddenAt: true }, orderBy: { updatedAt: 'asc' }, take: body.limit });
      for (const r of rows) {
        // re-check the hold inside the write so a hold placed mid-run wins
        const res = await this.prisma.client.callingRecord.updateMany({
          where: { id: r.id, legalHold: false, restrictedAt: null },
          data: {
            fullName: RESTRICTED_NAME,
            mobile: `restricted:${r.mobile.slice(-4)}`,
            panEncrypted: null,
            panLast4: null,
            nextFollowUpAt: null,
            hiddenAt: r.hiddenAt ?? runAt,
            hiddenReason: r.hiddenAt ? undefined : 'RETENTION_RESTRICTED',
            restrictedAt: runAt,
          },
        });
        if (res.count === 1) {
          processed++;
          await this.audit.record({ action: 'retention.restrictRecord', entityType: 'CallingRecord', entityId: r.id, after: { restrictedAt: runAt.toISOString(), days }, reason: body.reason });
        }
      }
    } else {
      const files = await this.prisma.client.storedFile.findMany({ where: this.fileWheres(body.category, cutoff).eligible, select: { id: true, bucket: true, key: true, purpose: true, sha256: true, sizeBytes: true }, orderBy: { createdAt: 'asc' }, take: body.limit });
      for (const f of files) {
        // claim the row first (hold re-checked), then delete the object: a crash leaves "purged, object maybe present", never "live row, object gone"
        const claim = await this.prisma.client.storedFile.updateMany({ where: { id: f.id, legalHold: false, purgedAt: null }, data: { purgedAt: runAt } });
        if (claim.count !== 1) continue;
        try {
          await this.storage.delete({ bucket: f.bucket, key: f.key });
          processed++;
          await this.audit.record({ action: 'retention.purgeFile', entityType: 'StoredFile', entityId: f.id, before: { purpose: f.purpose, sha256: f.sha256, sizeBytes: f.sizeBytes }, after: { purgedAt: runAt.toISOString(), days }, reason: body.reason });
        } catch (e) {
          // object delete failed: roll the claim back so the file stays served and the next run retries
          await this.prisma.client.storedFile.update({ where: { id: f.id }, data: { purgedAt: null } });
          failures.push({ id: f.id, error: (e as Error).message });
          this.logger.warn({ fileId: f.id, err: (e as Error).message }, 'retention purge failed; will retry next run');
        }
      }
    }
    const summary = { category: body.category, days, cutoff: cutoff.toISOString(), processed, failed: failures.length, limit: body.limit, runAt: runAt.toISOString() };
    RequestContextStore.audit({ entityType: 'Retention', entityId: body.category, after: summary, reason: body.reason });
    return { ...summary, failures };
  }

  async setLegalHold(actor: Actor, body: LegalHoldBody) {
    if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only Admin can place or release legal holds.');
    const data = { legalHold: body.hold, legalHoldReason: body.hold ? body.reason : null };
    if (body.subject === 'FILE') {
      const f = await this.prisma.client.storedFile.findUnique({ where: { id: body.id } });
      if (!f) throw AppError.notFound('File');
      if (body.hold && f.purgedAt) throw new AppError('FILE_PURGED', 'This file was already purged; a hold cannot restore it.');
      await this.prisma.client.storedFile.update({ where: { id: f.id }, data });
      RequestContextStore.audit({ entityType: 'StoredFile', entityId: f.id, before: { legalHold: f.legalHold, legalHoldReason: f.legalHoldReason }, after: data });
    } else {
      const r = await this.prisma.client.callingRecord.findUnique({ where: { id: body.id } });
      if (!r) throw AppError.notFound('Calling record');
      await this.prisma.client.callingRecord.update({ where: { id: r.id }, data });
      RequestContextStore.audit({ entityType: 'CallingRecord', entityId: r.id, before: { legalHold: r.legalHold, legalHoldReason: r.legalHoldReason }, after: data });
    }
    return { subject: body.subject, id: body.id, ...data };
  }

  async listHolds(subject?: 'FILE' | 'CALLING_RECORD') {
    const [files, records] = await Promise.all([
      subject === 'CALLING_RECORD' ? [] : this.prisma.client.storedFile.findMany({ where: { legalHold: true }, select: { id: true, purpose: true, originalName: true, legalHoldReason: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
      subject === 'FILE' ? [] : this.prisma.client.callingRecord.findMany({ where: { legalHold: true }, select: { id: true, batchId: true, sourceRowNumber: true, legalHoldReason: true, restrictedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);
    return {
      files: files.map((f) => ({ subject: 'FILE' as const, id: f.id, label: `${f.purpose.toLowerCase().replace(/_/g, ' ')} · ${f.originalName}`, reason: f.legalHoldReason, createdAt: f.createdAt.toISOString() })),
      records: records.map((r) => ({ subject: 'CALLING_RECORD' as const, id: r.id, label: `Calling record · row ${r.sourceRowNumber}`, reason: r.legalHoldReason, restricted: Boolean(r.restrictedAt), createdAt: r.createdAt.toISOString() })),
    };
  }
}
