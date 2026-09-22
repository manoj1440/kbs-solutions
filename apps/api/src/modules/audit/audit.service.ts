import type { Role, SensitiveField } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditRecordInput {
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Override the actor (jobs). Defaults to the request actor. */
  actor?: { userId: string | null; role: Role | null };
}

/** F-103: append-only audit + sensitive access logs. Never updated or deleted by application code. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    const ctx = RequestContextStore.get();
    const actor = input.actor ?? { userId: ctx?.actor?.userId ?? null, role: ctx?.actor?.role ?? null };
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: ctx?.requestId,
        ip: ctx?.ip,
        before: input.before === undefined ? undefined : (input.before as object),
        after: input.after === undefined ? undefined : (input.after as object),
        reason: input.reason,
        metadata: input.metadata === undefined ? undefined : (input.metadata as object),
      },
    });
  }

  async sensitiveAccess(input: { entityType: string; entityId: string; field: SensitiveField; purpose?: string }): Promise<void> {
    const ctx = RequestContextStore.get();
    const actorUserId = ctx?.actor?.userId;
    if (!actorUserId) return;
    await this.prisma.client.sensitiveAccessLog.create({
      data: { actorUserId, entityType: input.entityType, entityId: input.entityId, field: input.field, purpose: input.purpose, requestId: ctx?.requestId },
    });
  }
}
