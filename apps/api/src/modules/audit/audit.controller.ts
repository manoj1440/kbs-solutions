import { PaginationQuery } from '@kbs/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';

import { RequirePermission } from '../../common/decorators';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';

const AuditQuery = PaginationQuery.extend({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('AUDIT_READ')
  async list(@Query() raw: unknown) {
    const q = AuditQuery.parse(raw);
    const where = {
      entityType: q.entityType,
      entityId: q.entityId,
      actorUserId: q.actorUserId,
      action: q.action ? { startsWith: q.action } : undefined,
      at: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({ where, orderBy: { at: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total);
  }

  @Get('sensitive-access')
  @RequirePermission('AUDIT_READ')
  async sensitive(@Query() raw: unknown) {
    const q = AuditQuery.parse(raw);
    const where = { entityType: q.entityType, entityId: q.entityId, actorUserId: q.actorUserId, at: q.from || q.to ? { gte: q.from, lte: q.to } : undefined };
    const [rows, total] = await Promise.all([
      this.prisma.client.sensitiveAccessLog.findMany({ where, orderBy: { at: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.sensitiveAccessLog.count({ where }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total);
  }
}
