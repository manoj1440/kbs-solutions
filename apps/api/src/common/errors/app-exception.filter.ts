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
    const isProd = process.env.NODE_ENV === 'production';

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
          message: 'Some fields are invalid.',
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
      body = { error: { code, message, details }, meta: { requestId } };
    } else {
      this.logger.error({ requestId, err: exception instanceof Error ? { name: exception.name, message: exception.message, stack: isProd ? undefined : exception.stack } : exception });
      if (!isProd && exception instanceof Error) body.error.details = { name: exception.name, message: exception.message };
    }
    res.status(status).json(body);
  }
}
