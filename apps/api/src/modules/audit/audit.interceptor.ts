import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { AUDIT_KEY, type AuditMeta } from '../../common/decorators';
import { RequestContextStore } from '../../common/request-context';

import { AuditService } from './audit.service';

function pick(obj: unknown, path: string): string | undefined {
  const v = path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);
  return typeof v === 'string' ? v : undefined;
}

/** Writes an AuditLog row for every route decorated with @Audited (all mutations must be). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!meta) return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      tap((result) => {
        const extra = RequestContextStore.get()?.audit ?? {};
        const entityId =
          (extra.entityId as string | undefined) ??
          (meta.entityIdFrom?.startsWith('params.') ? pick(req.params, meta.entityIdFrom.slice(7)) : meta.entityIdFrom ? pick(result, meta.entityIdFrom) : undefined);
        void this.audit.record({
          action: meta.action,
          entityType: (extra.entityType as string | undefined) ?? meta.entityType,
          entityId,
          before: extra.before,
          after: extra.after,
          reason: (extra.reason as string | undefined) ?? (typeof req.body?.reason === 'string' ? req.body.reason : undefined),
          metadata: extra.metadata as Record<string, unknown> | undefined,
        });
      }),
    );
  }
}
