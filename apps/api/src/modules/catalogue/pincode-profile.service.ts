import { createHash } from 'node:crypto';

import { type CreatePincodeBatchBody, normalizePincode, type SourceabilityRule, type UpdatePincodeProfileBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { type ParsedSheet, parseTabular } from '../../common/import/tabular';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FilesService } from '../files/files.service';

type Sourceability = 'SOURCEABLE' | 'NOT_SOURCEABLE' | 'REQUIRES_BANK_MAPPING';

/** `headerMapping` is `{ headers: string[] }`; older rows stored `{ header: header }` — both are read. */
function headersOf(hm: unknown): string[] {
  const o = (hm ?? {}) as { headers?: unknown };
  if (Array.isArray(o.headers)) return o.headers as string[];
  return Object.keys(o).filter((k) => k !== 'headers');
}

/** Evaluate one raw row against a profile's semantics (REQ-07 §7.2/§7.3). Pure so it is unit-testable. */
export function evaluateSourceability(rule: SourceabilityRule, pincode: string | null, raw: Record<string, string>): Sourceability {
  if (!pincode) return 'NOT_SOURCEABLE';
  switch (rule.rule) {
    case 'PRESENT_PINCODE_IS_SOURCEABLE':
      return 'SOURCEABLE';
    case 'FLAG_EQUALS': {
      const v = (raw[rule.column] ?? '').trim().toUpperCase();
      if (!v) return 'REQUIRES_BANK_MAPPING';
      return rule.trueValues.some((t) => t.toUpperCase() === v) ? 'SOURCEABLE' : 'NOT_SOURCEABLE';
    }
    case 'REQUIRES_BANK_MAPPING':
    default:
      return 'REQUIRES_BANK_MAPPING';
  }
}

/**
 * F-404: bank-specific pincode profiles (versioned, DRAFT → APPROVED), batch import preserving raw rows,
 * and the sourceability lookup that F-308 reads (latest IMPORTED batch under an APPROVED profile per bank).
 */
@Injectable()
export class PincodeProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list() {
    const rows = await this.prisma.client.bankPincodeProfile.findMany({ orderBy: [{ bank: { code: 'asc' } }, { version: 'desc' }], include: { bank: { select: { id: true, code: true, displayName: true } }, _count: { select: { batches: true } } } });
    return rows.map((p) => ({ ...p, headers: headersOf(p.headerMapping) }));
  }

  async get(id: string) {
    const p = await this.prisma.client.bankPincodeProfile.findUnique({ where: { id }, include: { bank: { select: { id: true, code: true, displayName: true } }, batches: { orderBy: { uploadedAt: 'desc' }, include: { file: { select: { originalName: true } }, uploader: { select: { fullName: true } } } } } });
    if (!p) throw AppError.notFound('Profile');
    return { ...p, headers: headersOf(p.headerMapping) };
  }

  /** DRAFT profiles are edited in place; editing an APPROVED profile creates the next DRAFT version (history preserved). */
  async update(id: string, body: UpdatePincodeProfileBody) {
    const p = await this.prisma.client.bankPincodeProfile.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('Profile');
    if (p.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired profiles are read-only.');
    const headers = body.headers ?? headersOf(p.headerMapping);
    const pincodeColumn = body.pincodeColumn ?? p.pincodeColumn;
    if (!headers.includes(pincodeColumn)) throw new AppError('VALIDATION_FAILED', `pincodeColumn "${pincodeColumn}" must be one of the headers.`);
    const semantics = body.semantics ?? (p.semantics as SourceabilityRule);
    if (semantics.rule === 'FLAG_EQUALS' && !headers.includes(semantics.column)) throw new AppError('VALIDATION_FAILED', `Flag column "${semantics.column}" must be one of the headers.`);
    const data = { name: body.name ?? p.name, sheetName: body.sheetName === undefined ? p.sheetName : body.sheetName, headerMapping: { headers }, pincodeColumn, semantics, padNumericPincodes: body.padNumericPincodes ?? p.padNumericPincodes };
    if (p.status === 'DRAFT') {
      const u = await this.prisma.client.bankPincodeProfile.update({ where: { id }, data });
      RequestContextStore.audit({ entityId: id, before: { version: p.version, pincodeColumn: p.pincodeColumn, semantics: p.semantics }, after: data });
      return this.get(u.id);
    }
    const latest = await this.prisma.client.bankPincodeProfile.aggregate({ where: { bankId: p.bankId }, _max: { version: true } });
    const next = await this.prisma.client.bankPincodeProfile.create({ data: { ...data, bankId: p.bankId, version: (latest._max.version ?? p.version) + 1, status: 'DRAFT' } });
    RequestContextStore.audit({ entityId: next.id, after: { ...data, supersedes: id, version: next.version } });
    return this.get(next.id);
  }

  /** Approval makes the profile live for F-308; the previous APPROVED version of the same bank is retired. */
  async approve(actor: Actor, id: string) {
    const p = await this.prisma.client.bankPincodeProfile.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('Profile');
    if (p.status !== 'DRAFT') throw new AppError('CONFLICT', 'Only DRAFT profiles can be approved.');
    await this.prisma.client.$transaction([
      this.prisma.client.bankPincodeProfile.updateMany({ where: { bankId: p.bankId, status: 'APPROVED', id: { not: id } }, data: { status: 'RETIRED' } }),
      this.prisma.client.bankPincodeProfile.update({ where: { id }, data: { status: 'APPROVED', approvedByUserId: actor.userId, approvedAt: new Date() } }),
    ]);
    RequestContextStore.audit({ entityId: id, before: { status: 'DRAFT' }, after: { status: 'APPROVED', semantics: p.semantics } });
    return this.get(id);
  }

  // ── batches ──
  private async load(fileId: string, sheetName?: string | null, maxRows?: number) {
    const { file, body } = await this.files.readBytes(fileId);
    if (file.purpose !== 'BANK_PINCODE') throw new AppError('VALIDATION_FAILED', 'Upload the workbook with purpose BANK_PINCODE first.');
    const checksum = createHash('sha256').update(body).digest('hex');
    const parsed = await parseTabular(body, file.contentType, { sheetName: sheetName ?? undefined, maxRows });
    return { file, checksum, ...parsed };
  }

  /** Header check against the profile: unknown and missing headers are surfaced, never silently mapped (REQ-07 §7.3). */
  private headerCheck(profile: { headerMapping: unknown; pincodeColumn: string; semantics: unknown }, sheet: ParsedSheet) {
    const expected = headersOf(profile.headerMapping);
    const sem = profile.semantics as SourceabilityRule;
    const actual = sem.ignoreEmptyAutoHeaders ? sheet.headers.filter((h) => h && !/^(Column|__EMPTY)/i.test(h)) : sheet.headers;
    const missing = expected.filter((h) => !actual.includes(h));
    const unknown = actual.filter((h) => h && !expected.includes(h));
    const pincodePresent = actual.includes(profile.pincodeColumn);
    return { expected, actual, missing, unknown, pincodePresent, ok: pincodePresent && missing.length === 0 };
  }

  private evaluateRows(profile: { pincodeColumn: string; semantics: unknown; padNumericPincodes: boolean }, sheet: ParsedSheet) {
    const sem = profile.semantics as SourceabilityRule;
    return sheet.rows.map((raw, i) => {
      const cell = (raw[profile.pincodeColumn] ?? '').trim();
      let pincode: string | null = null;
      let wasPadded = false;
      if (/^\d{6}$/.test(cell)) pincode = cell;
      else if (/^\d{1,5}$/.test(cell) && profile.padNumericPincodes) {
        pincode = normalizePincode(Number(cell), { padNumeric: true });
        wasPadded = true;
      } else if (/^\d+\.0+$/.test(cell) && profile.padNumericPincodes) {
        pincode = normalizePincode(Number(cell.split('.')[0]), { padNumeric: true });
        wasPadded = pincode !== cell.split('.')[0];
      }
      return { sourceRowNumber: i + 2, pincode, wasPadded, raw, sourceability: evaluateSourceability(sem, pincode, raw) };
    });
  }

  async createBatch(actor: Actor, profileId: string, body: CreatePincodeBatchBody) {
    const profile = await this.prisma.client.bankPincodeProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw AppError.notFound('Profile');
    if (profile.status === 'RETIRED') throw new AppError('CONFLICT', 'Profile is retired.');
    const { file, checksum, sheets, sheet } = await this.load(body.fileId, body.sheetName ?? profile.sheetName);
    const existing = await this.prisma.client.bankPincodeBatch.findUnique({ where: { profileId_checksum: { profileId, checksum } } });
    if (existing) return { ...(await this.batch(existing.id)), duplicateOf: existing.id };
    const check = this.headerCheck(profile, sheet);
    const evals = this.evaluateRows(profile, sheet);
    const preview = this.preview(profile, evals, check, sheets, sheet.name);
    const b = await this.prisma.client.bankPincodeBatch.create({ data: { profileId, fileId: file.id, checksum, uploaderUserId: actor.userId, rowCount: evals.length, status: check.ok ? 'VALIDATED' : 'UPLOADED', error: check.ok ? null : JSON.stringify({ missing: check.missing, pincodePresent: check.pincodePresent }) } });
    RequestContextStore.audit({ entityId: b.id, after: { profileId, fileId: file.id, sheet: sheet.name, check } });
    return { ...(await this.batch(b.id)), preview };
  }

  private preview(profile: { semantics: unknown }, evals: ReturnType<PincodeProfileService['evaluateRows']>, check: ReturnType<PincodeProfileService['headerCheck']>, sheets: string[], sheetName: string) {
    const counts = { rows: evals.length, sourceable: 0, notSourceable: 0, requiresBankMapping: 0, invalidPincode: 0, padded: 0 };
    for (const e of evals) {
      if (!e.pincode) counts.invalidPincode++;
      if (e.wasPadded) counts.padded++;
      if (e.sourceability === 'SOURCEABLE') counts.sourceable++;
      else if (e.sourceability === 'NOT_SOURCEABLE') counts.notSourceable++;
      else counts.requiresBankMapping++;
    }
    const sem = profile.semantics as SourceabilityRule;
    const flagColumns = [...(sem.preserve ?? []), ...(sem.rule === 'FLAG_EQUALS' ? [sem.column] : [])];
    const distinct: Record<string, Record<string, number>> = {};
    for (const col of flagColumns) {
      const m: Record<string, number> = {};
      for (const e of evals) {
        const v = (e.raw[col] ?? '').trim() || '(blank)';
        m[v] = (m[v] ?? 0) + 1;
      }
      distinct[col] = Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25));
    }
    return { sheetName, sheets, headerCheck: check, counts, distinctFlagValues: distinct, sample: evals.slice(0, 10).map((e) => ({ row: e.sourceRowNumber, pincode: e.pincode, wasPadded: e.wasPadded, sourceability: e.sourceability })) };
  }

  async confirmBatch(id: string) {
    const b = await this.prisma.client.bankPincodeBatch.findUnique({ where: { id }, include: { profile: true } });
    if (!b) throw AppError.notFound('Batch');
    if (b.status === 'IMPORTED') throw new AppError('CONFLICT', 'Batch already imported.');
    if (b.status !== 'VALIDATED') throw new AppError('CONFLICT', 'Header check failed for this batch; fix the profile mapping or the file and upload again.', { error: b.error });
    const { sheet } = await this.load(b.fileId, b.profile.sheetName);
    const evals = this.evaluateRows(b.profile, sheet);
    await this.prisma.client.$transaction(async (tx) => {
      const chunk = 500;
      for (let i = 0; i < evals.length; i += chunk) {
        await tx.bankPincodeRow.createMany({
          data: evals.slice(i, i + chunk).map((e) => ({ batchId: id, bankId: b.profile.bankId, sourceRowNumber: e.sourceRowNumber, pincode: e.pincode ?? '', wasPadded: e.wasPadded, raw: e.raw, sourceability: e.sourceability })),
        });
      }
      await tx.bankPincodeBatch.update({ where: { id }, data: { status: 'IMPORTED', rowCount: evals.length } });
    });
    const counts = { rows: evals.length, sourceable: evals.filter((e) => e.sourceability === 'SOURCEABLE').length, requiresBankMapping: evals.filter((e) => e.sourceability === 'REQUIRES_BANK_MAPPING').length };
    RequestContextStore.audit({ entityId: id, after: counts });
    return { ...(await this.batch(id)), counts };
  }

  async batch(id: string) {
    const b = await this.prisma.client.bankPincodeBatch.findUnique({ where: { id }, include: { file: { select: { originalName: true } }, uploader: { select: { fullName: true } }, profile: { select: { id: true, name: true, version: true, status: true, bankId: true } } } });
    if (!b) throw AppError.notFound('Batch');
    const [sourceable, requires, notSourceable] = b.status === 'IMPORTED' ? await Promise.all((['SOURCEABLE', 'REQUIRES_BANK_MAPPING', 'NOT_SOURCEABLE'] as const).map((s) => this.prisma.client.bankPincodeRow.count({ where: { batchId: id, sourceability: s } }))) : [0, 0, 0];
    return { ...b, error: b.error ? JSON.parse(b.error) : null, counts: b.status === 'IMPORTED' ? { sourceable, requiresBankMapping: requires, notSourceable } : null };
  }

  /** Raw-row explorer (audited by the controller as a sensitive read). */
  async rows(batchId: string, page: number, pageSize: number, pincode?: string) {
    const where = { batchId, ...(pincode ? { pincode } : {}) };
    const [rows, total] = await Promise.all([this.prisma.client.bankPincodeRow.findMany({ where, orderBy: { sourceRowNumber: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }), this.prisma.client.bankPincodeRow.count({ where })]);
    return new Paginated(rows, page, pageSize, total);
  }

  /** Latest IMPORTED batch under the APPROVED profile of each active bank. */
  async liveBatches(): Promise<Array<{ bankId: string; batchId: string }>> {
    const profiles = await this.prisma.client.bankPincodeProfile.findMany({ where: { status: 'APPROVED', bank: { active: true } }, select: { bankId: true, batches: { where: { status: 'IMPORTED' }, orderBy: { uploadedAt: 'desc' }, take: 1, select: { id: true } } } });
    return profiles.filter((p) => p.batches.length).map((p) => ({ bankId: p.bankId, batchId: p.batches[0].id }));
  }

  /** Sourceability of one pincode per bank (F-308). Banks without an approved+imported profile are omitted (never "available"). */
  async sourceability(pincode: string): Promise<Array<{ bankId: string; sourceability: Sourceability; batchId: string }>> {
    const live = await this.liveBatches();
    if (!live.length) return [];
    const rows = await this.prisma.client.bankPincodeRow.findMany({ where: { pincode, batchId: { in: live.map((l) => l.batchId) } }, select: { bankId: true, batchId: true, sourceability: true } });
    // several rows for the same pincode (multiple offices): SOURCEABLE wins, then REQUIRES_BANK_MAPPING, then NOT
    const rank: Record<Sourceability, number> = { SOURCEABLE: 0, REQUIRES_BANK_MAPPING: 1, NOT_SOURCEABLE: 2 };
    const best = new Map<string, { bankId: string; sourceability: Sourceability; batchId: string }>();
    for (const r of rows) {
      const cur = best.get(r.bankId);
      if (!cur || rank[r.sourceability] < rank[cur.sourceability]) best.set(r.bankId, r);
    }
    return [...best.values()];
  }
}
