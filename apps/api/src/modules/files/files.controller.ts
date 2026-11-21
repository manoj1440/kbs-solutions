import type { FilePurpose } from '@kbs/shared';
import { type CallHandler, Controller, type ExecutionContext, Get, Injectable, type NestInterceptor, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';
import type { Observable } from 'rxjs';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';
import { AppError } from '../../common/errors/app-error';
import { ConfigService } from '../config/config.service';

import { FilesService } from './files.service';

/** Training videos (Admin only) may be large; the service still applies `files.maxUploadMb` afterwards. */
export const TRAINING_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/**
 * F-908 S5: multipart parsing with a buffer limit chosen per request. Every upload is held in memory, so the limit is
 * the normal maximum (`files.maxUploadMb`) unless an Admin uploads a training video. Guards have already run, so the
 * actor is known before a single byte is buffered.
 */
@Injectable()
export class UploadLimitInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { actor?: Actor }>();
    const normal = (this.config.getInt('files.maxUploadMb') ?? 25) * 1024 * 1024;
    const video = String(req.params.purpose ?? '').toUpperCase() === 'TRAINING_VIDEO' && req.actor?.role === 'ADMIN';
    const limit = video ? Math.max(TRAINING_VIDEO_MAX_BYTES, normal) : normal;
    await new Promise<void>((resolve, reject) => {
      multer({ storage: multer.memoryStorage(), limits: { fileSize: limit, files: 1 } }).single('file')(req, http.getResponse<Response>(), (err: unknown) => {
        if (!err) return resolve();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return reject(new AppError('FILE_TOO_LARGE', `Files must be at most ${Math.round(limit / 1024 / 1024)} MB.`));
        if (err instanceof multer.MulterError) return reject(new AppError('VALIDATION_FAILED', 'Send one file in the "file" field.'));
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
    return next.handle();
  }
}

/** F-108: `POST /files/:purpose` (multipart field `file`), `GET /files/:id`, `GET /files/:id/url`. */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post(':purpose')
  @RequirePermission('FILE_UPLOAD')
  @UseInterceptors(UploadLimitInterceptor)
  @Audited({ action: 'files.upload', entityType: 'StoredFile', entityIdFrom: 'id' })
  upload(@CurrentActor() actor: Actor, @Param('purpose') purpose: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new AppError('VALIDATION_FAILED', 'Attach a file in the "file" field.');
    return this.files.upload(actor, { purpose: purpose.toUpperCase() as FilePurpose, originalName: file.originalname, declaredType: file.mimetype, body: file.buffer });
  }

  @Get(':id')
  @RequirePermission('FILE_UPLOAD', 'CATALOGUE_READ', 'PAYMENT_QUEUE_READ')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.files.get(actor, id);
  }

  @Get(':id/url')
  @RequirePermission('FILE_UPLOAD', 'CATALOGUE_READ', 'PAYMENT_QUEUE_READ')
  url(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.files.downloadUrl(actor, id);
  }

  /** F-902: Admin re-scan of a file whose scan failed (PENDING) or was skipped. */
  @Post(':id/rescan')
  @RequirePermission('CONFIG_MANAGE')
  @Audited({ action: 'files.rescan', entityType: 'StoredFile', entityIdFrom: 'params.id' })
  rescan(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.files.rescan(actor, id);
  }
}
