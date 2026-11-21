import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { RequestContextStore } from '../request-context';

import { AppError } from './app-error';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown; recovery?: string };
  meta: { requestId: string };
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = RequestContextStore.requestId() ?? 'unknown';
    const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = { error: { code: 'INTERNAL', message: 'Something went wrong.' }, meta: { requestId } };

    if (exception instanceof AppError) {
      status = exception.status;
      body = { error: { code: exception.code, message: exception.message, details: exception.details, recovery: exception.recovery }, meta: { requestId } };
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      body = {
        error: {
          code: 'VALIDATION_FAILED',
          // name the fields so every screen shows something actionable ("Check: email.") without per-screen mapping
          message: `Check: ${[...new Set(exception.issues.map((i) => String(i.path.at(-1) ?? 'input').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()))].join(', ')}.`,
          details: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        meta: { requestId },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse() as string | { message?: string | string[]; error?: string; errors?: unknown };
      const message = typeof resp === 'string' ? resp : Array.isArray(resp.message) ? resp.message.join(', ') : (resp.message ?? exception.message);
      const code =
        status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'RBAC_FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : status === 400 ? 'VALIDATION_FAILED' : 'INTERNAL';
      const details = typeof resp === 'object' && resp && 'errors' in resp ? (resp as { errors: unknown }).errors : undefined;
      body = { error: { code, message, details, recovery: status === HttpStatus.SERVICE_UNAVAILABLE ? 'RETRY_LATER' : undefined }, meta: { requestId } };
    } else {
      this.logger.error({ requestId, err: describeUnknownError(exception, isProd) });
      if (!isProd && exception instanceof Error) body.error.details = { name: exception.name, message: exception.message };
    }
    res.status(status).json(body);
  }
}

/**
 * F-908 S10: what an unexpected error contributes to the log. Database and library messages often quote the values
 * that failed (names, mobiles, PAN), so deployed environments log only the error's class, its machine code (Prisma
 * `P2002` …), the model / fields involved and the stack frames — never the message.
 */
export function describeUnknownError(exception: unknown, deployed: boolean): Record<string, unknown> {
  if (!(exception instanceof Error)) return { type: typeof exception };
  const e = exception as Error & { code?: unknown; meta?: { modelName?: unknown; target?: unknown } };
  const frames = (e.stack ?? '').split('\n').filter((l) => /^\s+at /.test(l)).slice(0, 10).map((l) => l.trim());
  return {
    name: e.name,
    code: typeof e.code === 'string' ? e.code : undefined,
    model: typeof e.meta?.modelName === 'string' ? e.meta.modelName : undefined,
    target: Array.isArray(e.meta?.target) ? e.meta.target.filter((t) => typeof t === 'string') : undefined,
    frames,
    ...(deployed ? {} : { message: e.message }),
  };
}
