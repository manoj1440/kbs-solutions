import { createHash } from 'node:crypto';

import {
  type ConfirmCustomerBatchBody,
  type CustomerHeaderMapping,
  makePublicRef,
  maskMobile,
  maskPan,
  normalizePan,
  normalizePincode,
  RefPrefix,
  type ReviewRecordBody,
  RowIssue,
  toE164India,
} from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppError } from '../../common/errors/app-error';
import { findHeader, type ParsedSheet, parseTabular } from '../../common/import/tabular';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { FilesService } from '../files/files.service';

import { AllocationService } from './allocation.service';
import { PincodeMasterService } from './pincode-master.service';
import { SuppressionService } from './suppression.service';

const HEADER_ALIASES = {
  name: ['NAME', 'Name', 'Customer Name', 'CUSTOMER NAME', 'Full Name'],
  mobile: ['MOBILE', 'Mobile', 'Mobile No', 'MOBILE NO', 'Phone', 'Contact'],
  pincode: ['Pincode', 'PINCODE', 'Pin Code', 'PIN', 'Pin'],
  pan: ['PAN NO', 'PAN', 'Pan No', 'PAN Number'],
};

interface RowEval {
  sourceRowNumber: number;
  fullName: string;
  mobile: string | null;
  pincode: string | null;
  pan: string | null;
  issues: string[];
}

/** F-303: Admin customer calling-list import (REQ-06 §6.1–6.3, REQ-21 §21.2). */
@Injectable()
export class CustomerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly suppression: SuppressionService,
    private readonly pincodes: PincodeMasterService,
    private readonly allocation: AllocationService,
  ) {}

  private async load(fileId: string, sheetName?: string, maxRows?: number) {
    const { file, body } = await this.files.readBytes(fileId);
    if (file.purpose !== 'CUSTOMER_LIST') throw new AppError('VALIDATION_FAILED', 'Upload the workbook with purpose CUSTOMER_LIST first.');
    const checksum = createHash('sha256').update(body).digest('hex');
    const parsed = await parseTabular(body, file.contentType, { sheetName, maxRows });
    return { file, checksum, ...parsed };
  }

  autoMap(headers: string[]): Partial<CustomerHeaderMapping> {
    return {
      name: findHeader(headers, HEADER_ALIASES.name) ?? undefined,
      mobile: findHeader(headers, HEADER_ALIASES.mobile) ?? undefined,
      pincode: findHeader(headers, HEADER_ALIASES.pincode) ?? undefined,
      pan: findHeader(headers, HEADER_ALIASES.pan),
    };
  }

  /** Step (a)+(b)+(c): create the batch, detect headers, propose a mapping, masked preview. Identical file → prior batch. */
  async create(actor: Actor, input: { fileId: string; sheetName?: string }) {
    const { file, checksum, sheets, sheet } = await this.load(input.fileId, input.sheetName, 20);
    const existing = await this.prisma.client.customerImportBatch.findUnique({ where: { checksum } });
    if (existing) return { ...(await this.get(existing.id)), duplicateOf: existing.publicRef };
    const mapping = this.autoMap(sheet.headers);
    const batch = await this.prisma.client.customerImportBatch.create({
      data: {
        publicRef: makePublicRef(RefPrefix.IMPORT_BATCH),
        fileId: file.id,
        uploaderUserId: actor.userId,
        checksum,
        sheetName: sheet.name,
        headerMapping: { headers: sheet.headers, sheets, proposed: mapping, confirmed: null },
        status: 'UPLOADED',
      },
    });
    RequestContextStore.audit({ entityId: batch.id, after: { publicRef: batch.publicRef, fileId: file.id, sheet: sheet.name, headers: sheet.headers } });
    return { ...(await this.get(batch.id)), preview: this.maskedPreview(sheet, mapping) };
  }

  private maskedPreview(sheet: ParsedSheet, mapping: Partial<CustomerHeaderMapping>) {
    return sheet.rows.slice(0, 20).map((r, i) => ({
      row: i + 2,
      name: mapping.name ? r[mapping.name] : undefined,
      mobile: mapping.mobile ? maskMobile(safeE164(r[mapping.mobile] ?? '')) ?? '(invalid)' : undefined,
      pincode: mapping.pincode ? r[mapping.pincode] : undefined,
      pan: mapping.pan ? maskPan(r[mapping.pan]) : undefined,
    }));
  }

  /** Step (d)+(e): confirm mapping and produce the validation report (nothing written to CallingRecord yet). */
  async setMapping(id: string, mapping: CustomerHeaderMapping) {
    const batch = await this.prisma.client.customerImportBatch.findUnique({ where: { id } });
    if (!batch) throw AppError.notFound('Batch');
    if (batch.status === 'IMPORTED') throw new AppError('CONFLICT', 'This batch is already imported.');
    const { sheet } = await this.load(batch.fileId, batch.sheetName ?? undefined);
    for (const h of [mapping.name, mapping.mobile, mapping.pincode, mapping.pan].filter(Boolean) as string[]) {
      if (!sheet.headers.includes(h)) throw new AppError('VALIDATION_FAILED', `Column "${h}" is not in the sheet.`, { headers: sheet.headers });
    }
    const evals = await this.evaluate(sheet, mapping);
    const report = this.summarise(evals);
    const hm = batch.headerMapping as Record<string, unknown>;
    await this.prisma.client.customerImportBatch.update({
      where: { id },
      data: { headerMapping: { ...hm, confirmed: mapping }, totals: { rows: evals.length, validation: report }, status: 'VALIDATED' },
    });
    RequestContextStore.audit({ entityId: id, after: { mapping, report } });
    return { ...(await this.get(id)), preview: this.maskedPreview(sheet, mapping) };
  }

  private async evaluate(sheet: ParsedSheet, mapping: CustomerHeaderMapping): Promise<RowEval[]> {
    const dedupeKey = this.config.getJson<string[]>('allocation.dedupeKey');
    const rows: RowEval[] = sheet.rows.map((r, i) => {
      const issues: string[] = [];
      const fullName = (r[mapping.name] ?? '').trim();
      if (!fullName) issues.push(RowIssue.BLANK_NAME);
      let mobile: string | null = null;
      try {
        mobile = toE164India(r[mapping.mobile] ?? '');
      } catch {
        issues.push(RowIssue.INVALID_MOBILE);
      }
      let pincode: string | null = null;
      try {
        pincode = normalizePincode(r[mapping.pincode] ?? '', { padNumeric: true });
      } catch {
        issues.push(RowIssue.INVALID_PINCODE);
      }
      let pan: string | null = null;
      const rawPan = mapping.pan ? (r[mapping.pan] ?? '').trim() : '';
      if (rawPan) {
        try {
          pan = normalizePan(rawPan);
        } catch {
          issues.push(RowIssue.INVALID_PAN);
        }
      }
      return { sourceRowNumber: i + 2, fullName, mobile, pincode, pan, issues };
    });
    // in-batch duplicates on the configured key (default mobile)
    const seen = new Map<string, number>();
    for (const row of rows) {
      const key = dedupeKey.map((k) => (k === 'mobile' ? row.mobile : k === 'pan' ? row.pan : k === 'name' ? row.fullName.toLowerCase() : '')).join('|');
      if (!row.mobile || key.includes('null')) continue;
      if (seen.has(key)) row.issues.push(RowIssue.DUPLICATE_IN_BATCH);
      else seen.set(key, row.sourceRowNumber);
    }
    const mobiles = rows.map((r) => r.mobile).filter((m): m is string => Boolean(m));
    const [suppressed, existing] = await Promise.all([
      this.suppression.suppressedSet(mobiles),
      this.prisma.client.callingRecord.findMany({ where: { mobile: { in: mobiles }, reviewStatus: 'ACCEPTED' }, select: { mobile: true }, distinct: ['mobile'] }),
    ]);
    const existingSet = new Set(existing.map((e) => e.mobile));
    for (const row of rows) {
      if (row.mobile && suppressed.has(row.mobile)) row.issues.push(RowIssue.SUPPRESSED);
      else if (row.mobile && existingSet.has(row.mobile)) row.issues.push(RowIssue.DUPLICATE_OF_EXISTING);
    }
    return rows;
  }

  private summarise(evals: RowEval[]) {
    const byIssue: Record<string, number> = {};
    let accepted = 0;
    let needsReview = 0;
    let excluded = 0;
    for (const e of evals) {
      for (const i of e.issues) byIssue[i] = (byIssue[i] ?? 0) + 1;
      const s = this.classify(e.issues);
      if (s === 'ACCEPTED') accepted++;
      else if (s === 'NEEDS_REVIEW') needsReview++;
      else excluded++;
    }
    return { accepted, needsReview, excluded, byIssue };
  }

  /** Blocking issues exclude; suspicious ones go to review; PAN format is a warning only (PAN optional for calling). */
  private classify(issues: string[]): 'ACCEPTED' | 'NEEDS_REVIEW' | 'EXCLUDED' {
    if (issues.includes(RowIssue.SUPPRESSED) || issues.includes(RowIssue.DUPLICATE_OF_EXISTING) || issues.includes(RowIssue.DUPLICATE_IN_BATCH)) return 'EXCLUDED';
    if (issues.includes(RowIssue.INVALID_MOBILE) || issues.includes(RowIssue.INVALID_PINCODE) || issues.includes(RowIssue.BLANK_NAME)) return 'NEEDS_REVIEW';
    return 'ACCEPTED';
  }

  /** Step (f): write CallingRecord rows, store totals, run allocation when the compliance gate allows it. */
  async confirm(actor: Actor, id: string, body: ConfirmCustomerBatchBody) {
    const batch = await this.prisma.client.customerImportBatch.findUnique({ where: { id } });
    if (!batch) throw AppError.notFound('Batch');
    if (batch.status !== 'VALIDATED') throw new AppError('CONFLICT', 'Confirm the header mapping first.');
    const mapping = (batch.headerMapping as { confirmed: CustomerHeaderMapping | null }).confirmed;
    if (!mapping) throw new AppError('CONFLICT', 'Header mapping missing.');
    const { sheet } = await this.load(batch.fileId, batch.sheetName ?? undefined);
    const evals = await this.evaluate(sheet, mapping);
    const locations = await this.pincodes.lookupMany([...new Set(evals.map((e) => e.pincode).filter((p): p is string => Boolean(p)))]);
    const report = this.summarise(evals);
    const attested = Boolean(body.consentRepresentationConfirmed);

    await this.prisma.client.$transaction(async (tx) => {
      for (const e of evals) {
        const status = this.classify(e.issues);
        const loc = e.pincode ? locations.get(e.pincode) : undefined;
        await tx.callingRecord.create({
          data: {
            batchId: id,
            sourceRowNumber: e.sourceRowNumber,
            fullName: e.fullName || '(blank)',
            mobile: e.mobile ?? `invalid:${id}:${e.sourceRowNumber}`,
            panEncrypted: e.pan ? this.crypto.encrypt(e.pan) : null,
            panLast4: e.pan ? e.pan.slice(-4) : null,
            pincode: e.pincode ?? '000000',
            resolvedCity: loc?.district ?? null,
            resolvedState: loc?.state ?? null,
            locationResolved: Boolean(loc),
            reviewStatus: status,
            reviewReason: e.issues.length ? e.issues.join(',') : null,
            suppressed: e.issues.includes(RowIssue.SUPPRESSED),
            hiddenAt: status === 'EXCLUDED' ? new Date() : null,
            hiddenReason: status === 'EXCLUDED' ? e.issues.join(',') : null,
          },
        });
      }
      await tx.customerImportBatch.update({
        where: { id },
        data: {
          status: 'IMPORTED',
          totals: { rows: evals.length, imported: report.accepted, needsReview: report.needsReview, excluded: report.excluded, byIssue: report.byIssue },
          consentRepresentationConfirmed: attested,
          sourceVendor: body.sourceVendor,
          permittedUseBasis: body.permittedUseBasis,
        },
      });
    });
    RequestContextStore.audit({ entityId: id, after: { imported: report.accepted, needsReview: report.needsReview, excluded: report.excluded, attested } });

    const allocation = await this.allocation.allocateBatchIfAllowed(actor, id);
    return { ...(await this.get(id)), allocation };
  }

  async get(id: string) {
    const b = await this.prisma.client.customerImportBatch.findUnique({ where: { id }, include: { file: { select: { originalName: true, sizeBytes: true } }, uploader: { select: { id: true, fullName: true } } } });
    if (!b) throw AppError.notFound('Batch');
    const compliance = this.config.getBool('compliance.callingListConsentConfirmedByCompliance');
    return {
      id: b.id,
      publicRef: b.publicRef,
      status: b.status,
      file: b.file,
      uploader: b.uploader,
      uploadedAt: b.uploadedAt.toISOString(),
      sheetName: b.sheetName,
      headerMapping: b.headerMapping,
      totals: b.totals,
      consentRepresentationConfirmed: b.consentRepresentationConfirmed,
      sourceVendor: b.sourceVendor,
      permittedUseBasis: b.permittedUseBasis,
      allocatedAt: b.allocatedAt?.toISOString() ?? null,
      allocationAllowed: compliance || b.consentRepresentationConfirmed,
      complianceGlobalConfirmed: compliance,
    };
  }

  async list(page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      this.prisma.client.customerImportBatch.findMany({ orderBy: { uploadedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { file: { select: { originalName: true } }, uploader: { select: { fullName: true } } } }),
      this.prisma.client.customerImportBatch.count(),
    ]);
    return new Paginated(
      rows.map((b) => ({ id: b.id, publicRef: b.publicRef, status: b.status, file: b.file.originalName, uploader: b.uploader.fullName, uploadedAt: b.uploadedAt.toISOString(), totals: b.totals, allocatedAt: b.allocatedAt?.toISOString() ?? null, attested: b.consentRepresentationConfirmed })),
      page,
      pageSize,
      total,
    );
  }

  /** Review queue rows (masked). */
  async rows(id: string, reviewStatus: 'ACCEPTED' | 'NEEDS_REVIEW' | 'EXCLUDED' | undefined, page: number, pageSize: number) {
    const where = { batchId: id, ...(reviewStatus ? { reviewStatus } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.client.callingRecord.findMany({ where, orderBy: { sourceRowNumber: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.client.callingRecord.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => ({
        id: r.id,
        sourceRowNumber: r.sourceRowNumber,
        fullName: r.fullName,
        mobileMasked: r.mobile.startsWith('+') ? maskMobile(r.mobile) : '(invalid)',
        pincode: r.pincode === '000000' ? '(invalid)' : r.pincode,
        location: r.locationResolved ? `${r.resolvedCity}, ${r.resolvedState}` : 'Location unavailable',
        panLast4: r.panLast4,
        reviewStatus: r.reviewStatus,
        reviewReason: r.reviewReason,
        assignedTelecallerUserId: r.assignedTelecallerUserId,
      })),
      page,
      pageSize,
      total,
    );
  }

  async review(actor: Actor, recordId: string, body: ReviewRecordBody) {
    const r = await this.prisma.client.callingRecord.findUnique({ where: { id: recordId } });
    if (!r) throw AppError.notFound('Record');
    if (r.reviewStatus !== 'NEEDS_REVIEW') throw new AppError('CONFLICT', 'Only records in the review queue can be reviewed.');
    if (body.action === 'ACCEPT') {
      if (!r.mobile.startsWith('+') || r.pincode === '000000' || r.fullName === '(blank)') throw new AppError('VALIDATION_FAILED', 'This row has invalid mandatory data and cannot be accepted; exclude it and fix the source file.');
      if (await this.suppression.isSuppressed(r.mobile)) throw new AppError('CALLING_SUPPRESSED', 'This mobile is suppressed.');
      await this.prisma.client.callingRecord.update({ where: { id: recordId }, data: { reviewStatus: 'ACCEPTED', reviewReason: `${r.reviewReason ?? ''} | accepted: ${body.reason}` } });
      RequestContextStore.audit({ entityId: recordId, before: { reviewStatus: r.reviewStatus }, after: { reviewStatus: 'ACCEPTED' }, reason: body.reason });
      const allocation = await this.allocation.allocateBatchIfAllowed(actor, r.batchId);
      return { id: recordId, reviewStatus: 'ACCEPTED', allocation };
    }
    await this.prisma.client.callingRecord.update({ where: { id: recordId }, data: { reviewStatus: 'EXCLUDED', hiddenAt: new Date(), hiddenReason: `EXCLUDED_BY_ADMIN`, reviewReason: `${r.reviewReason ?? ''} | excluded: ${body.reason}` } });
    RequestContextStore.audit({ entityId: recordId, before: { reviewStatus: r.reviewStatus }, after: { reviewStatus: 'EXCLUDED' }, reason: body.reason });
    return { id: recordId, reviewStatus: 'EXCLUDED' };
  }
}

function safeE164(v: string): string | null {
  try {
    return toE164India(v);
  } catch {
    return null;
  }
}
