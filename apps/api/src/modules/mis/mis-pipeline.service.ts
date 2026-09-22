import { withMisApplyContext } from '@kbs/db';
import { isBlankBankValue, maskName, MIS_DATE_FIELDS, MIS_PII_FIELDS, MIS_STATUS_FIELDS, MIS_TEXT_FIELDS, type MisResolveBody } from '@kbs/shared';
import { Injectable, Logger } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';

type RefKind = 'APPLICATION_NO' | 'APPLICATION_REFERENCE_NUMBER' | 'OTHER';
interface RefValue {
  kind: RefKind;
  value: string;
}
type MatchState = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'CONFLICT' | 'INVALID' | 'DUPLICATE_IN_BATCH' | 'IGNORED';

/** Which snapshot fields count as payout triggers for retroactive review (F-606). */
const PAYOUT_TRIGGER_FIELDS = new Set<string>(['finalDecision', 'cardActivationStatus']);

/**
 * F-504 matcher (pure): exact (bank, kind, value) lookups only. Never name/mobile/PAN/date/similarity.
 * `linkages` maps "kind|value" → leadId for the batch's bank.
 */
export function matchRow(refs: RefValue[], linkages: Map<string, string>): { state: MatchState; leadId: string | null; explanation: string } {
  const hits = refs.map((r) => ({ r, leadId: linkages.get(`${r.kind}|${r.value}`) ?? null }));
  const leads = [...new Set(hits.map((h) => h.leadId).filter((x): x is string => Boolean(x)))];
  if (leads.length === 1) {
    const via = hits.filter((h) => h.leadId).map((h) => `${h.r.kind}=${h.r.value}`).join(', ');
    return { state: 'MATCHED', leadId: leads[0] as string, explanation: `Exact reference match on ${via}.` };
  }
  if (leads.length === 0) return { state: 'UNMATCHED', leadId: null, explanation: `No lead carries ${refs.map((r) => `${r.kind}=${r.value}`).join(' or ')}.` };
  return { state: 'CONFLICT', leadId: null, explanation: `REFERENCE_DISAGREEMENT: ${hits.filter((h) => h.leadId).map((h) => `${h.r.kind}=${h.r.value}`).join(' and ')} point to different leads.` };
}

/** F-503 preview + F-504 match/resolve + F-505 apply. `apply()` is the ONLY code path that writes bank status (INV-01). */
@Injectable()
export class MisPipelineService {
  private readonly log = new Logger(MisPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private blankTokens(): string[] {
    return this.config.getJson<string[]>('mis.blankValueTokens') ?? ['', '#N/A', 'N/A', 'NA', '-', '#REF!', 'NULL'];
  }

  private async linkageMap(bankId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.client.bankApplicationLinkage.findMany({ where: { bankId, supersededAt: null, verificationStatus: { not: 'REJECTED' } }, select: { referenceKind: true, referenceValue: true, leadId: true } });
    return new Map(rows.map((l) => [`${l.referenceKind}|${l.referenceValue}`, l.leadId]));
  }

  /** Runs matching for every row that is not already resolved (MATCHED by Admin / IGNORED keep their state). */
  async match(batchId: string) {
    const batch = await this.prisma.client.misImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    if (!['MAPPED', 'PREVIEWED'].includes(batch.stage)) throw new AppError('MIS_BATCH_STAGE_INVALID', `Batch is ${batch.stage}; matching runs on MAPPED/PREVIEWED batches.`);
    const linkages = await this.linkageMap(batch.bankId);
    const rows = await this.prisma.client.misRow.findMany({ where: { batchId, matchState: { in: ['PENDING', 'MATCHED', 'UNMATCHED', 'CONFLICT'] }, resolution: null }, select: { id: true, referenceValues: true, mapped: true } });
    // divergent duplicates: same reference on ≥2 rows with different mapped status values
    const byRef = new Map<string, { id: string; sig: string }[]>();
    for (const r of rows) {
      const refs = (r.referenceValues as unknown as RefValue[]) ?? [];
      const m = (r.mapped as Record<string, string>) ?? {};
      const sig = MIS_STATUS_FIELDS.map((f) => m[f] ?? '').join('|');
      for (const ref of refs) {
        const k = `${ref.kind}|${ref.value}`;
        byRef.set(k, [...(byRef.get(k) ?? []), { id: r.id, sig }]);
      }
    }
    const divergent = new Set<string>();
    for (const [, list] of byRef) if (new Set(list.map((l) => l.sig)).size > 1) list.forEach((l) => divergent.add(l.id));
    let matched = 0;
    for (const r of rows) {
      const refs = (r.referenceValues as unknown as RefValue[]) ?? [];
      const res = divergent.has(r.id) ? { state: 'CONFLICT' as MatchState, leadId: null, explanation: 'DUPLICATE_IN_BATCH_DIVERGENT: the same reference appears on several rows with different status values.' } : matchRow(refs, linkages);
      if (res.state === 'MATCHED') matched++;
      await this.prisma.client.misRow.update({ where: { id: r.id }, data: { matchState: res.state, matchedLeadId: res.leadId, matchExplanation: res.explanation } });
    }
    return { rows: rows.length, matched };
  }

  /** F-503: dry-run match + anomaly report; never returns PII unmasked. */
  async preview(batchId: string) {
    await this.match(batchId);
    const batch = await this.prisma.client.misImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { profile: { select: { knownValues: true } } } });
    const rows = await this.prisma.client.misRow.findMany({ where: { batchId }, select: { id: true, sourceRowNumber: true, matchState: true, matchExplanation: true, mapped: true, referenceValues: true, matchedLeadId: true } });
    const blankTokens = this.blankTokens();
    const known = ((batch.profile.knownValues as Record<string, string[]> | null) ?? {}) as Record<string, string[]>;
    const counts: Record<string, number> = {};
    const blank: Record<string, number> = {};
    const newValues: Record<string, string[]> = {};
    const refCount = new Map<string, number>();
    for (const r of rows) {
      counts[r.matchState] = (counts[r.matchState] ?? 0) + 1;
      const m = (r.mapped as Record<string, string>) ?? {};
      for (const f of MIS_TEXT_FIELDS) {
        if (!(f in m)) continue;
        const v = m[f] ?? '';
        if (isBlankBankValue(v, blankTokens)) blank[f] = (blank[f] ?? 0) + 1;
        else if (!MIS_PII_FIELDS.includes(f) && known[f] && !known[f].includes(v)) newValues[f] = [...new Set([...(newValues[f] ?? []), v])];
      }
      for (const ref of (r.referenceValues as unknown as RefValue[]) ?? []) refCount.set(`${ref.kind}|${ref.value}`, (refCount.get(`${ref.kind}|${ref.value}`) ?? 0) + 1);
    }
    const duplicateReferences = [...refCount.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ reference: k.replace('|', '='), rows: n }));
    const sample = (state: MatchState) =>
      rows
        .filter((r) => r.matchState === state)
        .slice(0, 20)
        .map((r) => ({ id: r.id, row: r.sourceRowNumber, customer: maskName(((r.mapped as Record<string, string>) ?? {}).customerName) ?? '', references: (r.referenceValues as unknown as RefValue[]) ?? [], explanation: r.matchExplanation }));
    const preview = {
      generatedAt: new Date().toISOString(),
      totals: { rows: rows.length, ...counts },
      referenceCoverage: rows.length ? Math.round(((rows.length - (counts.INVALID ?? 0)) / rows.length) * 100) : 0,
      blankStatusCounts: blank,
      newValues,
      duplicateReferences,
      samples: { unmatched: sample('UNMATCHED'), conflicts: sample('CONFLICT'), matched: sample('MATCHED') },
    };
    const existing = (batch.preview as Record<string, unknown> | null) ?? {};
    await this.prisma.client.misImportBatch.update({ where: { id: batchId }, data: { stage: 'PREVIEWED', preview: { ...existing, report: preview } as object } });
    RequestContextStore.audit({ entityId: batchId, after: { stage: 'PREVIEWED', totals: preview.totals } });
    return preview;
  }

  // ── F-504 resolution ──
  async resolve(actor: Actor, rowId: string, body: MisResolveBody) {
    const row = await this.prisma.client.misRow.findUnique({ where: { id: rowId }, include: { batch: { select: { id: true, bankId: true, stage: true } } } });
    if (!row) throw AppError.notFound('MIS row');
    if (row.batch.stage === 'APPLYING') throw new AppError('MIS_BATCH_STAGE_INVALID', 'Batch is being applied.');
    const before = { matchState: row.matchState, matchedLeadId: row.matchedLeadId };
    if (body.action === 'IGNORE') {
      await this.prisma.client.misRow.update({ where: { id: rowId }, data: { matchState: 'IGNORED', matchedLeadId: null, resolution: `IGNORE: ${body.reason}`, reviewedByUserId: actor.userId, reviewedAt: new Date() } });
    } else if (body.action === 'PREFER_ROW') {
      const other = await this.prisma.client.misRow.findUnique({ where: { id: body.rowId } });
      if (!other || other.batchId !== row.batchId) throw new AppError('VALIDATION_FAILED', 'rowId must be another row of the same batch.');
      // the preferred row goes back through matching; this row is ignored
      await this.prisma.client.$transaction([
        this.prisma.client.misRow.update({ where: { id: rowId }, data: { matchState: 'IGNORED', matchedLeadId: null, resolution: `PREFER_ROW ${other.sourceRowNumber}: ${body.reason}`, reviewedByUserId: actor.userId, reviewedAt: new Date() } }),
        this.prisma.client.misRow.update({ where: { id: other.id }, data: { matchState: 'PENDING', resolution: `PREFERRED over row ${row.sourceRowNumber}: ${body.reason}`, reviewedByUserId: actor.userId, reviewedAt: new Date() } }),
      ]);
      const linkages = await this.linkageMap(row.batch.bankId);
      const res = matchRow(((other.referenceValues as unknown as RefValue[]) ?? []), linkages);
      await this.prisma.client.misRow.update({ where: { id: other.id }, data: { matchState: res.state, matchedLeadId: res.leadId, matchExplanation: res.explanation } });
    } else {
      const lead = await this.prisma.client.lead.findUnique({ where: { id: body.leadId } });
      if (!lead || lead.bankId !== row.batch.bankId) throw new AppError('VALIDATION_FAILED', 'Lead must belong to the same bank as the batch.');
      const ref = ((row.referenceValues as unknown as RefValue[]) ?? []).find((r) => r.kind === body.referenceKind);
      if (!ref) throw new AppError('VALIDATION_FAILED', `This row has no ${body.referenceKind} reference.`);
      const clash = await this.prisma.client.bankApplicationLinkage.findUnique({ where: { bankId_referenceKind_referenceValue: { bankId: row.batch.bankId, referenceKind: ref.kind, referenceValue: ref.value } } });
      if (clash && clash.leadId !== lead.id && !clash.supersededAt) throw new AppError('CONFLICT', 'That reference is already linked to another lead; supersede it there first.');
      await this.prisma.client.$transaction(async (tx) => {
        if (clash) await tx.bankApplicationLinkage.delete({ where: { id: clash.id } });
        await tx.bankApplicationLinkage.updateMany({ where: { leadId: lead.id, referenceKind: ref.kind, supersededAt: null }, data: { supersededAt: new Date() } });
        await tx.bankApplicationLinkage.create({ data: { leadId: lead.id, bankId: row.batch.bankId, referenceKind: ref.kind, referenceValue: ref.value, source: 'MIS_RESOLVED_BY_ADMIN', verificationStatus: 'VERIFIED_BY_MIS_MATCH', enteredByUserId: actor.userId } });
        await tx.misRow.update({ where: { id: rowId }, data: { matchState: 'MATCHED', matchedLeadId: lead.id, matchExplanation: `Linked by Admin via ${ref.kind}=${ref.value}.`, resolution: `LINK_TO_LEAD ${lead.publicRef}: ${body.reason}`, reviewedByUserId: actor.userId, reviewedAt: new Date() } });
      });
      // an APPLIED batch re-applies just this row
      if (row.batch.stage === 'APPLIED') await this.apply(actor, row.batch.id, { onlyRowIds: [rowId] });
    }
    const after = await this.prisma.client.misRow.findUniqueOrThrow({ where: { id: rowId }, select: { matchState: true, matchedLeadId: true } });
    RequestContextStore.audit({ entityId: rowId, before, after, reason: body.reason });
    return after;
  }

  // ── F-505 apply ──
  /**
   * Per MATCHED row, per mapped field: compare with the snapshot → history row (SET / CHANGED / CONFIRMED_SAME / REPORTED_BLANK);
   * snapshot updated only for non-blank values (or blankOverwrites). Row-level `appliedAt` makes retries resume; identical
   * re-processing writes no new history because the (leadId, batchId, field) unique already exists.
   */
  async apply(actor: Actor, batchId: string, opts: { onlyRowIds?: string[] } = {}) {
    const batch = await this.prisma.client.misImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { profile: true } });
    if (!opts.onlyRowIds && !['PREVIEWED', 'MAPPED', 'APPLYING', 'FAILED'].includes(batch.stage)) throw new AppError('MIS_BATCH_STAGE_INVALID', `Batch is ${batch.stage}.`);
    if (!opts.onlyRowIds && batch.stage !== 'APPLYING') await this.match(batchId);
    await this.prisma.client.misImportBatch.update({ where: { id: batchId }, data: opts.onlyRowIds ? {} : { stage: 'APPLYING', error: null } });
    const blankTokens = this.blankTokens();
    const rows = await this.prisma.client.misRow.findMany({ where: { batchId, matchState: 'MATCHED', appliedAt: null, ...(opts.onlyRowIds ? { id: { in: opts.onlyRowIds } } : {}) }, orderBy: { sourceRowNumber: 'asc' } });
    const changedLeads = new Map<string, string[]>();
    const reviewEntitlements = new Set<string>();
    let updatedChanged = 0;
    let updatedNoChange = 0;

    await withMisApplyContext(batchId, async () => {
      for (const row of rows) {
        const leadId = row.matchedLeadId as string;
        const mapped = (row.mapped as Record<string, string>) ?? {};
        const dates = (row.mappedDates as Record<string, { text: string; iso: string | null }>) ?? {};
        const changed: string[] = [];
        await this.prisma.client.$transaction(async (tx) => {
          const snap = await tx.bankStatusSnapshot.findUnique({ where: { leadId } });
          const textUpdates: Record<string, string | null> = {};
          const dateUpdates: Record<string, Date | null> = {};
          const history: Array<{ field: string; oldValue: string | null; newValue: string | null; changeKind: 'SET' | 'CHANGED' | 'CONFIRMED_SAME' | 'REPORTED_BLANK'; reportedEventDate: Date | null }> = [];
          const reportedDate = dates.finalDecisionDate?.iso ? new Date(dates.finalDecisionDate.iso) : dates.creationDateTime?.iso ? new Date(dates.creationDateTime.iso) : null;
          for (const f of MIS_TEXT_FIELDS) {
            if (!(f in mapped) || MIS_PII_FIELDS.includes(f)) continue; // PII columns stay in rawLatest only
            const raw = mapped[f] ?? '';
            const old = (snap as Record<string, unknown> | null)?.[f] as string | null | undefined;
            if (isBlankBankValue(raw, blankTokens)) {
              history.push({ field: f, oldValue: old ?? null, newValue: null, changeKind: 'REPORTED_BLANK', reportedEventDate: reportedDate });
              if (batch.profile.blankOverwrites && old) {
                textUpdates[f] = null;
                changed.push(f);
              }
              continue;
            }
            const v = raw.trim();
            if (old === undefined || old === null) {
              history.push({ field: f, oldValue: null, newValue: v, changeKind: 'SET', reportedEventDate: reportedDate });
              textUpdates[f] = v;
              changed.push(f);
            } else if (old !== v) {
              history.push({ field: f, oldValue: old, newValue: v, changeKind: 'CHANGED', reportedEventDate: reportedDate });
              textUpdates[f] = v;
              changed.push(f);
            } else history.push({ field: f, oldValue: old, newValue: v, changeKind: 'CONFIRMED_SAME', reportedEventDate: reportedDate });
          }
          const dateCol: Record<string, string> = { creationDateTime: 'bankCreationDateTime', creationDate: 'bankCreationDate', finalDecisionDate: 'finalDecisionDate', vkycConsentDate: 'vkycConsentDate', vkycExpiryDate: 'vkycExpiryDate' };
          for (const f of MIS_DATE_FIELDS) {
            if (!(f in dates)) continue;
            const iso = dates[f]?.iso ?? null;
            if (iso) dateUpdates[dateCol[f] as string] = new Date(iso);
          }
          const data = { ...textUpdates, ...dateUpdates, rawLatest: row.raw as object, lastMatchedBatchId: batchId, lastMatchedAt: batch.uploadedAt };
          if (snap) await tx.bankStatusSnapshot.update({ where: { leadId }, data });
          else await tx.bankStatusSnapshot.create({ data: { leadId, bankId: batch.bankId, firstMatchedAt: batch.uploadedAt, ...data } });
          for (const h of history) {
            await tx.bankStatusHistory.upsert({ where: { leadId_batchId_field: { leadId, batchId, field: h.field } }, create: { leadId, batchId, misRowId: row.id, field: h.field, oldValue: h.oldValue, newValue: h.newValue, changeKind: h.changeKind, reportedEventDate: h.reportedEventDate, importedAt: batch.uploadedAt, uploaderUserId: batch.uploaderUserId }, update: {} });
          }
          // verify the linkage that matched (F-407 §3)
          await tx.bankApplicationLinkage.updateMany({ where: { leadId, bankId: batch.bankId, supersededAt: null, verificationStatus: 'UNVERIFIED' }, data: { verificationStatus: 'VERIFIED_BY_MIS_MATCH' } });
          await tx.misRow.update({ where: { id: row.id }, data: { appliedAt: new Date() } });
          if (changed.length) {
            changedLeads.set(leadId, changed);
            if (snap && changed.some((f) => PAYOUT_TRIGGER_FIELDS.has(f))) {
              const ents = await tx.payoutEntitlement.findMany({ where: { leadId }, select: { id: true } });
              ents.forEach((e) => reviewEntitlements.add(e.id));
            }
          }
        });
        if (changed.length) updatedChanged++;
        else updatedNoChange++;
      }

      // FULL_SNAPSHOT: leads matched by an earlier batch of this bank but absent now → ABSENT_FROM_BATCH (values untouched)
      if (!opts.onlyRowIds && batch.profile.snapshotMode === 'FULL_SNAPSHOT') {
        const present = new Set((await this.prisma.client.misRow.findMany({ where: { batchId, matchState: 'MATCHED' }, select: { matchedLeadId: true } })).map((r) => r.matchedLeadId));
        const others = await this.prisma.client.bankStatusSnapshot.findMany({ where: { bankId: batch.bankId, lastMatchedBatchId: { not: batchId } }, select: { leadId: true } });
        for (const o of others) {
          if (present.has(o.leadId)) continue;
          await this.prisma.client.bankStatusHistory.upsert({ where: { leadId_batchId_field: { leadId: o.leadId, batchId, field: '*' } }, create: { leadId: o.leadId, batchId, field: '*', changeKind: 'ABSENT_FROM_BATCH', importedAt: batch.uploadedAt, uploaderUserId: batch.uploaderUserId }, update: {} });
        }
      }
    });

    // post-apply: outbox events only when something actually changed (MIS-08)
    if (changedLeads.size) {
      await this.prisma.client.outboxEvent.createMany({ data: [...changedLeads.entries()].map(([leadId, changedFields]) => ({ type: 'mis.lead.changed', payload: { leadId, batchId, changedFields, jobId: `mis.lead.changed:${batchId}:${leadId}` } })) });
      for (const [leadId, changedFields] of changedLeads) {
        const lead = await this.prisma.client.lead.findUniqueOrThrow({ where: { id: leadId }, select: { publicRef: true, advisorUserId: true, reportingParentUserIdSnapshot: true } });
        const body = `Bank MIS reported an update for ${lead.publicRef} (${changedFields.filter((f) => (MIS_STATUS_FIELDS as readonly string[]).includes(f)).join(', ') || changedFields.length + ' fields'}).`;
        await this.notifications.notify({ recipientUserId: lead.advisorUserId, kind: 'MIS_CHANGED', title: 'Bank status updated', body, deepLink: { entityType: 'Lead', entityId: leadId }, dedupeKey: `mis:changed:${batchId}:${leadId}` });
      }
      if (reviewEntitlements.size) await this.prisma.client.outboxEvent.createMany({ data: [...reviewEntitlements].map((entitlementId) => ({ type: 'payouts.review', payload: { entitlementId, batchId, jobId: `payouts.review:${batchId}:${entitlementId}` } })) });
    }
    if (!opts.onlyRowIds) {
      const counts = Object.fromEntries((await this.prisma.client.misRow.groupBy({ by: ['matchState'], where: { batchId }, _count: { _all: true } })).map((g) => [g.matchState, g._count._all]));
      const totals = { ...((batch.totals as Record<string, unknown>) ?? {}), updatedChanged, updatedNoChange, unmatched: counts.UNMATCHED ?? 0, conflicts: counts.CONFLICT ?? 0, invalid: counts.INVALID ?? 0, ignored: counts.IGNORED ?? 0, needsReview: (counts.UNMATCHED ?? 0) + (counts.CONFLICT ?? 0), appliedRows: rows.length };
      await this.prisma.client.misImportBatch.update({ where: { id: batchId }, data: { stage: 'APPLIED', appliedAt: batch.appliedAt ?? new Date(), totals } });
      await this.notifications.notify({ recipientUserId: actor.userId, kind: 'MIS_IMPORT_RESULT', title: `MIS batch ${batch.publicRef} applied`, body: `${updatedChanged} lead(s) changed, ${updatedNoChange} confirmed, ${totals.needsReview} row(s) need review.`, deepLink: { entityType: 'MisImportBatch', entityId: batchId }, dedupeKey: `mis:applied:${batchId}:${rows.length}` });
      RequestContextStore.audit({ entityId: batchId, after: { stage: 'APPLIED', totals } });
      return totals;
    }
    return { updatedChanged, updatedNoChange, appliedRows: rows.length };
  }

  /** F-408 §3: change history grouped by batch for one lead. */
  async leadHistory(leadId: string) {
    const rows = await this.prisma.client.bankStatusHistory.findMany({ where: { leadId }, orderBy: [{ importedAt: 'desc' }, { field: 'asc' }], include: { batch: { select: { publicRef: true, uploadedAt: true, uploader: { select: { role: true } } } } } });
    const groups = new Map<string, { batchId: string; publicRef: string; importedAt: string; uploaderRole: string; changes: Array<{ field: string; oldValue: string | null; newValue: string | null; changeKind: string; reportedEventDate: string | null }> }>();
    for (const r of rows) {
      const g = groups.get(r.batchId) ?? { batchId: r.batchId, publicRef: r.batch.publicRef, importedAt: r.importedAt.toISOString(), uploaderRole: r.batch.uploader.role, changes: [] };
      g.changes.push({ field: r.field, oldValue: r.oldValue, newValue: r.newValue, changeKind: r.changeKind, reportedEventDate: r.reportedEventDate?.toISOString() ?? null });
      groups.set(r.batchId, g);
    }
    return [...groups.values()];
  }
}
