import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { resolveClientIp } from '../client-ip';
import { RequestContextStore } from '../request-context';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly trustProxyHops: number) {}
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const requestId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const ip = resolveClientIp(req, this.trustProxyHops);
    RequestContextStore.run({ requestId, ip }, () => next());
  }
}
