import type { FilePurpose } from '@kbs/shared';
import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, RequirePermission } from '../../common/decorators';
import { AppError } from '../../common/errors/app-error';

import { FilesService } from './files.service';

/** F-108: `POST /files/:purpose` (multipart field `file`), `GET /files/:id`, `GET /files/:id/url`. */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post(':purpose')
  @RequirePermission('FILE_UPLOAD')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
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
