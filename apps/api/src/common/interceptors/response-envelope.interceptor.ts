import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { type Observable, map } from 'rxjs';

import { RequestContextStore } from '../request-context';

/** Marker for paginated results returned by services. */
export class Paginated<T> {
  constructor(
    public readonly data: T[],
    public readonly page: number,
    public readonly pageSize: number,
    public readonly total: number,
    public readonly extraMeta: Record<string, unknown> = {},
  ) {}
}

/** Wraps every successful response as { data, meta } (DOCS/architecture/04-api-conventions.md). */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        const requestId = RequestContextStore.requestId() ?? 'unknown';
        const asOf = new Date().toISOString();
        if (result instanceof Paginated) {
          return { data: result.data, meta: { requestId, asOf, page: result.page, pageSize: result.pageSize, total: result.total, ...result.extraMeta } };
        }
        if (result && typeof result === 'object' && '__envelope' in (result as object)) {
          const r = result as { __envelope: true; data: unknown; meta?: Record<string, unknown> };
          return { data: r.data, meta: { requestId, asOf, ...(r.meta ?? {}) } };
        }
        return { data: result ?? null, meta: { requestId, asOf } };
      }),
    );
  }
}
