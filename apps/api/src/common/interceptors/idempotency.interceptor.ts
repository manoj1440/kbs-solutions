import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { type Observable, from, of, switchMap, tap } from 'rxjs';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import type { Actor } from '../actor';
import { IDEMPOTENT_KEY } from '../decorators';
import { AppError } from '../errors/app-error';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * F-107: stores the first response for (userId, key, route) for 24h and replays it. A Redis lock
 * serialises concurrent requests with the same key so only one side effect happens.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.header('idempotency-key');
    if (!key || !UUID.test(key)) {
      throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (UUID) with this request.');
    }
    const userId = req.actor?.userId ?? 'anonymous';
    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const lockKey = `idem:lock:${userId}:${key}:${route}`;

    return from(this.acquire(lockKey)).pipe(
      switchMap(async () => {
        const existing = await this.prisma.client.idempotencyRecord.findUnique({ where: { userId_key_route: { userId, key, route } } });
        return existing;
      }),
      switchMap((existing) => {
        if (existing) {
          res.status(existing.responseStatus);
          return of({ __envelope: true, data: (existing.responseBody as { data: unknown }).data, meta: { idempotentReplay: true } }).pipe(
            tap(() => void this.release(lockKey)),
          );
        }
        return next.handle().pipe(
          switchMap(async (result) => {
            const status = res.statusCode || 200;
            await this.prisma.client.idempotencyRecord
              .create({ data: { userId, key, route, responseStatus: status, responseBody: { data: result } as object } })
              .catch(() => undefined);
            await this.release(lockKey);
            return result;
          }),
        );
      }),
    );
  }

  private async acquire(lockKey: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const ok = await this.redis.client.set(lockKey, '1', 'PX', 15_000, 'NX').catch(() => 'OK');
      if (ok === 'OK') return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new AppError('IDEMPOTENCY_IN_PROGRESS', 'A request with this key is still being processed.');
  }
  private async release(lockKey: string): Promise<void> {
    await this.redis.client.del(lockKey).catch(() => undefined);
  }
}
