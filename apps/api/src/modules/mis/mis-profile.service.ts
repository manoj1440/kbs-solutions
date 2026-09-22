import { MIS_DATE_FIELDS, MIS_TEXT_FIELDS, type UpdateMisProfileBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';

const ALL_FIELDS = new Set<string>([...MIS_TEXT_FIELDS, ...MIS_DATE_FIELDS]);

/** F-501: per-bank, versioned MIS import profiles (DRAFT → APPROVED → RETIRED). HDFC v1 is seeded as DRAFT. */
@Injectable()
export class MisProfileService {
  constructor(private readonly prisma: PrismaService) {}

  list(bankId?: string) {
    return this.prisma.client.misImportProfile.findMany({ where: bankId ? { bankId } : {}, orderBy: [{ bank: { code: 'asc' } }, { version: 'desc' }], include: { bank: { select: { id: true, code: true, displayName: true } }, _count: { select: { batches: true } } } });
  }

  async get(id: string) {
    const p = await this.prisma.client.misImportProfile.findUnique({ where: { id }, include: { bank: { select: { id: true, code: true, displayName: true } } } });
    if (!p) throw AppError.notFound('MIS profile');
    return { ...p, internalFields: { text: [...MIS_TEXT_FIELDS], date: [...MIS_DATE_FIELDS] } };
  }

  /** Approved profile for a bank (the one imports run under). */
  async approvedFor(bankId: string) {
    return this.prisma.client.misImportProfile.findFirst({ where: { bankId, status: 'APPROVED' }, orderBy: { version: 'desc' } });
  }

  private validate(body: UpdateMisProfileBody, current: { fieldMap: unknown; referenceFields: unknown }) {
    const fieldMap = (body.fieldMap ?? (current.fieldMap as Record<string, string>)) ?? {};
    const bad = Object.keys(fieldMap).filter((k) => !ALL_FIELDS.has(k));
    if (bad.length) throw new AppError('VALIDATION_FAILED', `Unknown internal fields: ${bad.join(', ')}`, { allowed: [...ALL_FIELDS] });
    const refs = (body.referenceFields ?? (current.referenceFields as Array<{ kind: string; header: string }>)) ?? [];
    if (!refs.length) throw new AppError('VALIDATION_FAILED', 'At least one reference field is required (REQ-13 §13.5).');
    return { fieldMap, refs };
  }

  /** DRAFT: edit in place. APPROVED: create next DRAFT version (batches already applied keep pointing at their version). */
  async update(id: string, body: UpdateMisProfileBody) {
    const p = await this.prisma.client.misImportProfile.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('MIS profile');
    if (p.status === 'RETIRED') throw new AppError('CONFLICT', 'Retired profiles are read-only.');
    const { fieldMap, refs } = this.validate(body, p);
    const data = {
      name: body.name ?? p.name,
      sheetSelector: body.sheetSelector === undefined ? p.sheetSelector : body.sheetSelector,
      headerAliases: (body.headerAliases ?? (p.headerAliases as object)) as object,
      fieldMap: fieldMap as object,
      referenceFields: refs as object[],
      snapshotMode: body.snapshotMode ?? p.snapshotMode,
      blankOverwrites: body.blankOverwrites ?? p.blankOverwrites,
      timezone: body.timezone ?? p.timezone,
      timezoneAssumed: body.timezoneAssumed ?? p.timezoneAssumed,
      dateFormats: (body.dateFormats ?? (p.dateFormats as object)) as object,
      knownValues: (body.knownValues ?? (p.knownValues as object)) as object,
    };
    if (p.status === 'DRAFT') {
      await this.prisma.client.misImportProfile.update({ where: { id }, data });
      RequestContextStore.audit({ entityId: id, before: { fieldMap: p.fieldMap, referenceFields: p.referenceFields, snapshotMode: p.snapshotMode }, after: body });
      return this.get(id);
    }
    const max = await this.prisma.client.misImportProfile.aggregate({ where: { bankId: p.bankId }, _max: { version: true } });
    const next = await this.prisma.client.misImportProfile.create({ data: { ...data, bankId: p.bankId, version: (max._max.version ?? p.version) + 1, status: 'DRAFT' } });
    RequestContextStore.audit({ entityId: next.id, after: { ...body, supersedes: id, version: next.version } });
    return this.get(next.id);
  }

  async approve(actor: Actor, id: string, reason: string) {
    const p = await this.prisma.client.misImportProfile.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('MIS profile');
    if (p.status !== 'DRAFT') throw new AppError('CONFLICT', 'Only DRAFT profiles can be approved.');
    await this.prisma.client.$transaction([
      this.prisma.client.misImportProfile.updateMany({ where: { bankId: p.bankId, status: 'APPROVED', id: { not: id } }, data: { status: 'RETIRED' } }),
      this.prisma.client.misImportProfile.update({ where: { id }, data: { status: 'APPROVED', approvedByUserId: actor.userId, approvedAt: new Date() } }),
    ]);
    RequestContextStore.audit({ entityId: id, before: { status: 'DRAFT' }, after: { status: 'APPROVED', fieldMap: p.fieldMap, referenceFields: p.referenceFields }, reason });
    return this.get(id);
  }

  /** Records values seen in a batch as known (Admin confirms after preview) — never translates them (MIS-11). */
  async acknowledgeValues(id: string, values: Record<string, string[]>, reason: string) {
    const p = await this.prisma.client.misImportProfile.findUnique({ where: { id } });
    if (!p) throw AppError.notFound('MIS profile');
    const known = ((p.knownValues as Record<string, string[]> | null) ?? {}) as Record<string, string[]>;
    for (const [field, vals] of Object.entries(values)) known[field] = [...new Set([...(known[field] ?? []), ...vals])];
    await this.prisma.client.misImportProfile.update({ where: { id }, data: { knownValues: known } });
    RequestContextStore.audit({ entityId: id, after: { acknowledged: values }, reason });
    return known;
  }
}
