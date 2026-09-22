import { type SuppressionReason, toE164India } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { parseTabular } from '../../common/import/tabular';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FilesService } from '../files/files.service';

/** F-306: do-not-contact suppression keyed on E.164 mobile (REQ-08 §8.6, REQ-21 §21.2). Never deletes records. */
@Injectable()
export class SuppressionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async isSuppressed(mobileE164: string): Promise<boolean> {
    const s = await this.prisma.client.contactSuppression.findUnique({ where: { mobile: mobileE164 }, select: { liftedAt: true } });
    return Boolean(s && !s.liftedAt);
  }

  async suppressedSet(mobiles: string[]): Promise<Set<string>> {
    const rows = await this.prisma.client.contactSuppression.findMany({ where: { mobile: { in: mobiles }, liftedAt: null }, select: { mobile: true } });
    return new Set(rows.map((r) => r.mobile));
  }

  /** Suppress a mobile and hide all its active calling records (kept, never deleted — INV-07). */
  async suppress(actor: Actor | null, mobileE164: string, reason: SuppressionReason, sourceCallingRecordId?: string) {
    const existing = await this.prisma.client.contactSuppression.findUnique({ where: { mobile: mobileE164 } });
    const row = existing
      ? existing.liftedAt
        ? await this.prisma.client.contactSuppression.update({ where: { mobile: mobileE164 }, data: { reason, sourceCallingRecordId, createdByUserId: actor?.userId, at: new Date(), liftedAt: null, liftedByUserId: null, liftReason: null } })
        : existing
      : await this.prisma.client.contactSuppression.create({ data: { mobile: mobileE164, reason, sourceCallingRecordId, createdByUserId: actor?.userId } });
    await this.prisma.client.callingRecord.updateMany({ where: { mobile: mobileE164, suppressed: false }, data: { suppressed: true, hiddenAt: new Date(), hiddenReason: `SUPPRESSED:${reason}` } });
    return row;
  }

  async list(actor: Actor, page: number, pageSize: number, includeLifted = false) {
    const where = includeLifted ? {} : { liftedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.client.contactSuppression.findMany({ where, orderBy: { at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.client.contactSuppression.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => ({ ...r, mobile: `+91••••••${r.mobile.slice(-4)}`, mobileFull: actor.role === 'ADMIN' ? r.mobile : undefined })),
      page,
      pageSize,
      total,
    );
  }

  async add(actor: Actor, mobile: string, reason: SuppressionReason) {
    const e164 = toE164India(mobile);
    const row = await this.suppress(actor, e164, reason);
    RequestContextStore.audit({ entityId: row.id, after: { mobileLast4: e164.slice(-4), reason } });
    return { id: row.id, mobileLast4: e164.slice(-4), reason: row.reason };
  }

  /** Bulk DND list (CSV/XLSX with a column containing mobiles). */
  async importDnd(actor: Actor, fileId: string) {
    const { file, body } = await this.files.readBytes(fileId);
    if (file.purpose !== 'DND_LIST') throw new AppError('VALIDATION_FAILED', 'Upload the list with purpose DND_LIST first.');
    const parsed = await parseTabular(body, file.contentType);
    const col = parsed.sheet.headers.find((h) => /mobile|phone|msisdn|number/i.test(h)) ?? parsed.sheet.headers[0];
    if (!col) throw new AppError('VALIDATION_FAILED', 'No mobile column found.');
    let added = 0;
    let invalid = 0;
    for (const r of parsed.sheet.rows) {
      try {
        await this.suppress(actor, toE164India(r[col] ?? ''), 'DND_LIST');
        added++;
      } catch {
        invalid++;
      }
    }
    RequestContextStore.audit({ entityId: fileId, metadata: { added, invalid, column: col } });
    return { added, invalid, column: col };
  }

  async lift(actor: Actor, id: string, reason: string) {
    const s = await this.prisma.client.contactSuppression.findUnique({ where: { id } });
    if (!s) throw AppError.notFound('Suppression');
    if (s.liftedAt) return { id, liftedAt: s.liftedAt };
    const r = await this.prisma.client.contactSuppression.update({ where: { id }, data: { liftedAt: new Date(), liftedByUserId: actor.userId, liftReason: reason } });
    // Records stay hidden; the Manager/Admin re-surfaces them deliberately (F-307 unhide) — lifting never re-queues automatically.
    await this.prisma.client.callingRecord.updateMany({ where: { mobile: s.mobile, suppressed: true }, data: { suppressed: false } });
    RequestContextStore.audit({ entityId: id, before: { liftedAt: null }, after: { liftedAt: r.liftedAt }, reason });
    return { id, liftedAt: r.liftedAt };
  }
}
