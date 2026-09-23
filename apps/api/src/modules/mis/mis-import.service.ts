import { createHash } from 'node:crypto';

import { type CreateMisBatchBody, makePublicRef, maskName, MIS_DATE_FIELDS, MIS_PII_FIELDS, type MisBatchListQuery, type MisRowsQuery, RefPrefix } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { type ParsedSheet, parseTabular } from '../../common/import/tabular';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';

import { parseBankDate } from './mis-dates';

type Profile = { id: string; fieldMap: unknown; headerAliases: unknown; referenceFields: unknown; dateFormats: unknown; timezone: string; sheetSelector: string | null; knownValues: unknown };
interface RefField {
  kind: 'APPLICATION_NO' | 'APPLICATION_REFERENCE_NUMBER' | 'OTHER';
  header: string;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Resolves a profile header (exact, then alias, then tolerant normalised match) to the raw header actually in the sheet.
 * The raw header text is what gets stored; the profile only says which column feeds which internal field.
 */
export function resolveHeaders(profile: Pick<Profile, 'fieldMap' | 'headerAliases' | 'referenceFields'>, headers: string[]) {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const aliases = (profile.headerAliases as Record<string, string[]> | null) ?? {};
  const find = (wanted: string): string | null => {
    if (headers.includes(wanted)) return wanted;
    for (const a of aliases[wanted] ?? []) {
      if (headers.includes(a)) return a;
      const n = byNorm.get(norm(a));
      if (n) return n;
    }
    return byNorm.get(norm(wanted)) ?? null;
  };
  const fieldMap = (profile.fieldMap as Record<string, string>) ?? {};
  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  for (const [field, header] of Object.entries(fieldMap)) {
    const h = find(header);
    if (h) resolved[field] = h;
    else missing.push(header);
  }
  const refs = ((profile.referenceFields as RefField[]) ?? []).map((r) => ({ ...r, resolved: find(r.header) }));
  const used = new Set([...Object.values(resolved), ...refs.map((r) => r.resolved).filter(Boolean)]);
  const unmapped = headers.filter((h) => !used.has(h));
  return { resolved, missing, refs, unmapped };
}

/** F-502: immutable upload → parse (raw text, row hash) → map (internal fields, dates, references). Stages are idempotent. */
@Injectable()
export class MisImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  private async load(fileId: string, sheetName?: string | null) {
    const { file, body } = await this.files.readBytes(fileId);
    if (file.purpose !== 'MIS') throw new AppError('MIS_FILE_REJECTED', 'Upload the MIS workbook with purpose MIS first.');
    const checksum = createHash('sha256').update(body).digest('hex');
    let parsed;
    try {
      parsed = await parseTabular(body, file.contentType, { sheetName: sheetName ?? undefined });
    } catch (e) {
      if (!sheetName) throw new AppError('MIS_FILE_REJECTED', e instanceof Error ? e.message : 'Could not read the workbook.');
      parsed = await parseTabular(body, file.contentType, {}); // selector sheet absent → first sheet (header check decides)
    }
    return { file, checksum, ...parsed };
  }

  async create(actor: Actor, body: CreateMisBatchBody) {
    const profile = await this.prisma.client.misImportProfile.findUnique({ where: { id: body.profileId } });
    if (!profile || profile.bankId !== body.bankId) throw new AppError('VALIDATION_FAILED', 'Profile does not belong to that bank.');
    if (profile.status !== 'APPROVED') throw new AppError('MIS_PROFILE_NOT_APPROVED', 'The MIS profile for this bank is not approved yet.');
    const { file, checksum, sheets, sheet } = await this.load(body.fileId, body.sheetName ?? profile.sheetSelector);
    const existing = await this.prisma.client.misImportBatch.findUnique({ where: { bankId_checksum: { bankId: body.bankId, checksum } } });
    if (existing && ['PARSED', 'MAPPED', 'PREVIEWED', 'APPLYING', 'APPLIED'].includes(existing.stage)) return { ...(await this.get(existing.id)), duplicateOf: existing.publicRef };
    // header validation: reference + status headers must be present; a pincode sheet or calling list fails here
    const check = resolveHeaders(profile, sheet.headers);
    const refPresent = check.refs.some((r) => r.resolved);
    const statusPresent = ['currentStage', 'finalDecision', 'cardActivationStatus'].some((f) => check.resolved[f]);
    const batch = existing ?? (await this.prisma.client.misImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.MIS_BATCH), bankId: body.bankId, profileId: profile.id, fileId: file.id, checksum, sheetName: sheet.name, uploaderUserId: actor.userId, stage: 'UPLOADED' } }));
    if (!refPresent || !statusPresent) {
      const reason = !refPresent ? `No reference column found (expected one of: ${check.refs.map((r) => r.header).join(', ')}). Is this a pincode or calling-list workbook?` : 'No status column found (CURRENT_STAGE / FINAL_DECISION / Card Activation Staus).';
      await this.prisma.client.misImportBatch.update({ where: { id: batch.id }, data: { stage: 'REJECTED', rejectReason: reason, preview: { headers: sheet.headers, sheets, missing: check.missing, unmapped: check.unmapped } } });
      RequestContextStore.audit({ entityId: batch.id, after: { stage: 'REJECTED', reason } });
      return this.get(batch.id);
    }
    RequestContextStore.audit({ entityId: batch.id, after: { publicRef: batch.publicRef, fileId: file.id, sheet: sheet.name, rows: sheet.rows.length, missingHeaders: check.missing, unmappedColumns: check.unmapped } });
    await this.parse(batch.id, profile, sheet, check);
    return this.get(batch.id);
  }

  /** Parse + map in one pass (rows are small); re-runnable while the batch is not APPLIED. */
  private async parse(batchId: string, profile: Profile, sheet: ParsedSheet, check: ReturnType<typeof resolveHeaders>) {
    const formats = (profile.dateFormats as string[] | null) ?? [];
    const seen = new Set<string>();
    const rows = sheet.rows.map((raw, i) => {
      const ordered = sheet.headers.map((h) => raw[h] ?? '');
      const rowHash = createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
      const mapped: Record<string, string> = {};
      for (const [field, header] of Object.entries(check.resolved)) mapped[field] = raw[header] ?? '';
      const mappedDates: Record<string, { text: string; iso: string | null }> = {};
      for (const f of MIS_DATE_FIELDS) {
        if (f in mapped) mappedDates[f] = { text: mapped[f] as string, iso: parseBankDate(mapped[f], formats, profile.timezone)?.toISOString() ?? null };
      }
      const referenceValues = check.refs.filter((r) => r.resolved).map((r) => ({ kind: r.kind, value: (raw[r.resolved as string] ?? '').trim() })).filter((r) => r.value !== '');
      const duplicate = seen.has(rowHash);
      seen.add(rowHash);
      return { batchId, sourceRowNumber: i + 2, rowHash, raw, mapped, mappedDates, referenceValues, matchState: duplicate ? ('DUPLICATE_IN_BATCH' as const) : referenceValues.length ? ('PENDING' as const) : ('INVALID' as const), matchExplanation: duplicate ? 'Identical row appears earlier in this batch.' : referenceValues.length ? null : 'NO_REFERENCE: no usable bank reference in this row.', duplicate };
    });
    await this.prisma.client.$transaction(async (tx) => {
      await tx.misRow.deleteMany({ where: { batchId } });
      const unique = rows.filter((r) => !r.duplicate);
      for (let i = 0; i < unique.length; i += 500) {
        await tx.misRow.createMany({ data: unique.slice(i, i + 500).map(({ duplicate: _d, ...r }) => ({ ...r, raw: r.raw as object, mapped: r.mapped as object, mappedDates: r.mappedDates as object, referenceValues: r.referenceValues as object[] })) });
      }
      const totals = { rows: rows.length, unique: unique.length, duplicateRows: rows.length - unique.length, invalid: unique.filter((r) => r.matchState === 'INVALID').length, missingHeaders: check.missing, unmappedColumns: check.unmapped };
      await tx.misImportBatch.update({ where: { id: batchId }, data: { stage: 'MAPPED', totals, error: null, preview: { headers: sheet.headers, resolved: check.resolved, references: check.refs.map((r) => ({ kind: r.kind, header: r.header, resolved: r.resolved })) } } });
      // F-905 finding: the default 5 s interactive-transaction timeout failed a 100k-row HDFC sheet. Budget scales with rows.
    }, { timeout: Math.max(30_000, rows.length * 5), maxWait: 10_000 });
  }

  async get(id: string) {
    const b = await this.prisma.client.misImportBatch.findUnique({ where: { id }, include: { bank: { select: { id: true, code: true, displayName: true } }, profile: { select: { id: true, name: true, version: true, snapshotMode: true } }, file: { select: { originalName: true, sizeBytes: true } }, uploader: { select: { id: true, fullName: true, role: true } } } });
    if (!b) throw AppError.notFound('MIS batch');
    return b;
  }

  async list(q: MisBatchListQuery) {
    const where = { ...(q.bankId ? { bankId: q.bankId } : {}), ...(q.stage ? { stage: q.stage as 'UPLOADED' } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.client.misImportBatch.findMany({ where, orderBy: { uploadedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { bank: { select: { code: true, displayName: true } }, profile: { select: { name: true, version: true } }, file: { select: { originalName: true } }, uploader: { select: { fullName: true } } } }),
      this.prisma.client.misImportBatch.count({ where }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total);
  }

  /** Rows with PII masked unless `reveal` (MIS_RAW_ROW_VIEW; logged as sensitive access MIS_RAW_ROW). */
  async rows(actor: Actor, batchId: string, q: MisRowsQuery) {
    const where = { batchId, ...(q.matchState ? { matchState: q.matchState } : {}) };
    const [rows, total] = await Promise.all([this.prisma.client.misRow.findMany({ where, orderBy: { sourceRowNumber: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { matchedLead: { select: { id: true, publicRef: true } } } }), this.prisma.client.misRow.count({ where })]);
    const reveal = Boolean(q.reveal) && actor.permissions.includes('MIS_RAW_ROW_VIEW');
    if (reveal) await this.audit.sensitiveAccess({ entityType: 'MisImportBatch', entityId: batchId, field: 'MIS_RAW_ROW', purpose: 'ROW_VIEW' });
    const batch = await this.prisma.client.misImportBatch.findUniqueOrThrow({ where: { id: batchId }, select: { preview: true } });
    const resolved = ((batch.preview as { resolved?: Record<string, string> } | null)?.resolved ?? {}) as Record<string, string>;
    const piiHeaders = new Set(MIS_PII_FIELDS.map((f) => resolved[f]).filter(Boolean));
    return new Paginated(
      rows.map((r) => ({
        id: r.id,
        sourceRowNumber: r.sourceRowNumber,
        matchState: r.matchState,
        matchExplanation: r.matchExplanation,
        matchedLead: r.matchedLead,
        resolution: r.resolution,
        appliedAt: r.appliedAt?.toISOString() ?? null,
        referenceValues: r.referenceValues,
        mapped: this.maskMapped(r.mapped as Record<string, string>, reveal),
        raw: reveal ? r.raw : Object.fromEntries(Object.entries(r.raw as Record<string, string>).map(([h, v]) => [h, piiHeaders.has(h) ? (maskName(v) ?? '') : v])),
      })),
      q.page,
      q.pageSize,
      total,
      { revealed: reveal },
    );
  }

  maskMapped(mapped: Record<string, string> | null, reveal: boolean) {
    if (!mapped) return mapped;
    if (reveal) return mapped;
    return Object.fromEntries(Object.entries(mapped).map(([k, v]) => [k, MIS_PII_FIELDS.includes(k) ? (maskName(v) ?? '') : v]));
  }

  async reject(actor: Actor, id: string, reason: string) {
    const b = await this.get(id);
    if (b.stage === 'APPLIED' || b.stage === 'APPLYING') throw new AppError('MIS_BATCH_STAGE_INVALID', 'Applied batches cannot be rejected.');
    await this.prisma.client.misImportBatch.update({ where: { id }, data: { stage: 'REJECTED', rejectReason: reason } });
    RequestContextStore.audit({ entityId: id, before: { stage: b.stage }, after: { stage: 'REJECTED' }, reason });
    void actor;
    return this.get(id);
  }
}
