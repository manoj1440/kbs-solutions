import { AUDIT_ACTION_GROUPS, type AuditActionGroup, PaginationQuery } from '@kbs/shared';
import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import { z } from 'zod';

import { Audited, RequirePermission } from '../../common/decorators';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
const AuditQuery = PaginationQuery.extend({
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(64).optional(),
  actorUserId: z.string().uuid().optional(),
  /** Exact action key, or a prefix ending with '.' (e.g. `payment.`). */
  action: z.string().max(80).optional(),
  group: z.enum(Object.keys(AUDIT_ACTION_GROUPS) as [AuditActionGroup, ...AuditActionGroup[]]).optional(),
  from: day.optional(),
  to: day.optional(),
});
type AuditQuery = z.infer<typeof AuditQuery>;
const actorSel = { actor: { select: { id: true, fullName: true, role: true, publicRef: true } } } as const;

/**
 * F-103 audit trail + F-704 audit dashboard API (REQ-24 §24.3, REQ-16 §16.2). Read-only; export is disabled unless
 * `audit.exportEnabled` (policy OPEN) and every export is itself audited.
 */
@Controller('audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private where(q: AuditQuery) {
    const groupActions = q.group ? (AUDIT_ACTION_GROUPS[q.group].actions as readonly string[]) : null;
    const action = q.action ? (q.action.endsWith('.') ? { startsWith: q.action } : { equals: q.action }) : groupActions ? { in: [...groupActions] } : undefined;
    return {
      entityType: q.entityType,
      entityId: q.entityId,
      actorUserId: q.actorUserId,
      action,
      at: q.from || q.to ? { ...(q.from ? { gte: istStart(q.from) } : {}), ...(q.to ? { lt: new Date(istStart(q.to).getTime() + 86_400_000) } : {}) } : undefined,
    };
  }

  @Get()
  @RequirePermission('AUDIT_READ')
  async list(@Query() raw: unknown) {
    const q = AuditQuery.parse(raw);
    const where = this.where(q);
    const [rows, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({ where, orderBy: { at: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: actorSel }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total, { exportEnabled: this.config.getBool('audit.exportEnabled') === true });
  }

  /** Catalogue for the filter UI: REQ-24 §24.3 groups plus every action key present in the log with its count. */
  @Get('actions')
  @RequirePermission('AUDIT_READ')
  async actions() {
    const present = await this.prisma.client.auditLog.groupBy({ by: ['action'], _count: { _all: true } });
    const counts = Object.fromEntries(present.map((p) => [p.action, p._count._all]));
    return {
      groups: Object.entries(AUDIT_ACTION_GROUPS).map(([key, g]) => ({ key, label: g.label, actions: g.actions.map((a) => ({ action: a, count: counts[a] ?? 0 })) })),
      other: present.filter((p) => !Object.values(AUDIT_ACTION_GROUPS).some((g) => (g.actions as readonly string[]).includes(p.action))).map((p) => ({ action: p.action, count: p._count._all })),
      entityTypes: (await this.prisma.client.auditLog.findMany({ where: { entityType: { not: null } }, distinct: ['entityType'], select: { entityType: true } })).map((e) => e.entityType),
    };
  }

  @Get('sensitive-access')
  @RequirePermission('AUDIT_READ')
  async sensitive(@Query() raw: unknown) {
    const q = AuditQuery.parse(raw);
    const w = this.where(q);
    const where = { entityType: w.entityType, entityId: w.entityId, actorUserId: w.actorUserId, at: w.at };
    const [rows, total] = await Promise.all([
      this.prisma.client.sensitiveAccessLog.findMany({ where, orderBy: { at: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: actorSel }),
      this.prisma.client.sensitiveAccessLog.count({ where }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total);
  }

  /** CSV export — disabled by default (audit.exportEnabled, policy OPEN). */
  @Get('export')
  @RequirePermission('AUDIT_READ')
  @Audited({ action: 'audit.export', entityType: 'AuditLog' })
  async export(@Query() raw: unknown) {
    if (this.config.getBool('audit.exportEnabled') !== true) throw new AppError('RBAC_FORBIDDEN', 'Audit export is disabled (audit.exportEnabled). KBS has not approved an export policy.');
    const q = AuditQuery.parse(raw);
    const rows = await this.prisma.client.auditLog.findMany({ where: this.where(q), orderBy: { at: 'desc' }, take: 10_000, include: actorSel });
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['at,action,actor,actorRole,entityType,entityId,reason', ...rows.map((r) => [r.at.toISOString(), r.action, r.actor?.publicRef ?? '', r.actorRole ?? '', r.entityType ?? '', r.entityId ?? '', r.reason ?? ''].map(esc).join(','))];
    return new StreamableFile(Buffer.from(lines.join('\n'), 'utf8'), { type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="kbs-audit.csv"' });
  }

  @Get(':id')
  @RequirePermission('AUDIT_READ')
  async detail(@Param('id') id: string) {
    const row = await this.prisma.client.auditLog.findUnique({ where: { id }, include: actorSel });
    if (!row) throw AppError.notFound('Audit entry');
    const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : v === null || v === undefined ? {} : { value: v });
    const before = obj(row.before);
    const after = obj(row.after);
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const diff = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((k) => ({ field: k, before: before[k] ?? null, after: after[k] ?? null }));
    return { ...row, diff };
  }
}
