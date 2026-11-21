import { randomUUID } from 'node:crypto';

import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { type Observable, defer, finalize, from, of, switchMap } from 'rxjs';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import type { Actor } from '../actor';
import { IDEMPOTENT_KEY } from '../decorators';
import { AppError } from '../errors/app-error';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** F-908 S9: long enough for the slowest handler (imports, PDFs); the lock is released as soon as the request ends. */
export const IDEMPOTENCY_LOCK_TTL_MS = 120_000;
const WAIT_FOR_LOCK_MS = 10_000;
/** Deletes the lock only while it is still ours, so an expired lock re-taken by a retry is never released by us. */
const RELEASE_IF_OWNER = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

/**
 * F-107: stores the first response for (userId, key, route) for 24h and replays it. A Redis lock
 * serialises concurrent requests with the same key so only one side effect happens.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Idempotency');

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

    const owner = randomUUID();
    return from(this.acquire(lockKey, owner)).pipe(
      // from here on the lock is ours: release it however the request ends (success, replay, error or client abort),
      // so a failed request can be retried with the same key at once
      switchMap(() =>
        defer(async () => this.prisma.client.idempotencyRecord.findUnique({ where: { userId_key_route: { userId, key, route } } })).pipe(
          switchMap((existing) => {
            if (existing) {
              res.status(existing.responseStatus);
              return of({ __envelope: true, data: (existing.responseBody as { data: unknown }).data, meta: { idempotentReplay: true } });
            }
            return next.handle().pipe(
              switchMap(async (result) => {
                const status = res.statusCode || 200;
                await this.prisma.client.idempotencyRecord
                  .create({ data: { userId, key, route, responseStatus: status, responseBody: { data: result } as object } })
                  .catch(() => undefined);
                return result;
              }),
            );
          }),
          finalize(() => void this.release(lockKey, owner)),
        ),
      ),
    );
  }

  private async acquire(lockKey: string, owner: string): Promise<void> {
    const deadline = Date.now() + WAIT_FOR_LOCK_MS;
    while (Date.now() < deadline) {
      let ok: string | null;
      try {
        ok = await this.redis.client.set(lockKey, owner, 'PX', IDEMPOTENCY_LOCK_TTL_MS, 'NX');
      } catch (err) {
        // Redis unavailable: run without the lock rather than stop every money action (F-908 review). Duplicates are still
        // refused by the database (row locks, one-live-payment / one-active-item unique indexes, the stored replay record).
        this.logger.warn(`idempotency lock unavailable (${(err as Error)?.name ?? 'Redis error'}); continuing without it`);
        return;
      }
      if (ok === 'OK') return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new AppError('IDEMPOTENCY_IN_PROGRESS', 'A request with this key is still being processed.');
  }
  private async release(lockKey: string, owner: string): Promise<void> {
    await this.redis.client.eval(RELEASE_IF_OWNER, 1, lockKey, owner).catch(() => undefined);
  }
}
