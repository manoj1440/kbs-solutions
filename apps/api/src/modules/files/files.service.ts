import { createHash, randomUUID } from 'node:crypto';

import { type FilePurpose, FilePurpose as FilePurposeEnum } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SCAN_PROVIDER, STORAGE_PROVIDER, type ScanProvider, type StorageProvider } from '../../providers/ports';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';

import { ALLOWED_BY_PURPOSE, canonicalContentType, sniff } from './sniff';

/** Which roles may upload for a purpose (F-108 §1). */
const UPLOAD_ROLES: Record<FilePurpose, ReadonlyArray<Actor['role']>> = {
  CUSTOMER_LIST: ['ADMIN'],
  BANK_PINCODE: ['ADMIN'],
  PINCODE_MASTER: ['ADMIN'],
  MIS: ['ADMIN'],
  DND_LIST: ['ADMIN'],
  TRAINING_VIDEO: ['ADMIN'],
  CARD_IMAGE: ['ADMIN'],
  BENEFIT_PDF: ['ADMIN'],
  CHEQUE: ['ADVISOR', 'ADMIN'],
  PAYMENT_PROOF: ['ACCOUNTS', 'ADMIN'],
  ID_CARD: ['ADMIN'],
  RECORDING: ['ADMIN'],
};

/** Purposes whose downloads are sensitive and logged (REQ-21 §21.1). */
const SENSITIVE: Partial<Record<FilePurpose, 'CHEQUE' | 'PROOF' | 'RECORDING' | 'ID_CARD'>> = { CHEQUE: 'CHEQUE', PAYMENT_PROOF: 'PROOF', RECORDING: 'RECORDING', ID_CARD: 'ID_CARD' };

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(SCAN_PROVIDER) private readonly scanner: ScanProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async upload(actor: Actor, input: { purpose: FilePurpose; originalName: string; declaredType: string; body: Buffer }) {
    if (!(Object.values(FilePurposeEnum) as string[]).includes(input.purpose)) throw new AppError('VALIDATION_FAILED', 'Unknown file purpose.');
    if (!UPLOAD_ROLES[input.purpose].includes(actor.role)) throw new AppError('RBAC_FORBIDDEN', 'Your role cannot upload this kind of file.');
    const maxBytes = (this.config.getInt('files.maxUploadMb') ?? 25) * 1024 * 1024;
    if (input.body.length === 0) throw new AppError('VALIDATION_FAILED', 'The file is empty.');
    if (input.body.length > maxBytes) throw new AppError('FILE_TOO_LARGE', `Files must be at most ${maxBytes / 1024 / 1024} MB.`);
    const sniffed = sniff(input.body);
    if (!ALLOWED_BY_PURPOSE[input.purpose]?.includes(sniffed)) {
      throw new AppError('FILE_TYPE_REJECTED', `This file type is not accepted for ${input.purpose.toLowerCase().replace(/_/g, ' ')}.`, { detected: sniffed });
    }
    const contentType = canonicalContentType(sniffed, input.declaredType);
    const sha256 = createHash('sha256').update(input.body).digest('hex');
    const key = `private/${input.purpose.toLowerCase()}/${randomUUID()}`;
    const bucket = this.env.S3_BUCKET;
    await this.storage.put({ bucket, key, body: input.body, contentType });
    const scan = await this.scanner.scan({ body: input.body });
    const file = await this.prisma.client.storedFile.create({
      data: {
        bucket,
        key,
        originalName: input.originalName.slice(0, 200),
        contentType,
        sizeBytes: input.body.length,
        sha256,
        uploadedByUserId: actor.userId,
        purpose: input.purpose,
        scanStatus: scan.status,
        scannedAt: new Date(),
      },
    });
    RequestContextStore.audit({ entityId: file.id, after: { purpose: file.purpose, sizeBytes: file.sizeBytes, sha256, scanStatus: file.scanStatus } });
    return this.toDto(file);
  }

  async get(actor: Actor, id: string) {
    const file = await this.prisma.client.storedFile.findUnique({ where: { id } });
    if (!file || !(await this.canRead(actor, file))) throw AppError.notFound('File');
    return this.toDto(file);
  }

  /** Presigned URL, gated by scan status and purpose-specific access; sensitive purposes are logged. */
  async downloadUrl(actor: Actor, id: string) {
    const file = await this.prisma.client.storedFile.findUnique({ where: { id } });
    if (!file || !(await this.canRead(actor, file))) throw AppError.notFound('File');
    if (file.scanStatus === 'INFECTED') throw new AppError('FILE_NOT_CLEAN', 'This file failed the malware scan.');
    const requireClean = this.config.getBool('files.requireCleanScanForNonAdmin');
    if (file.scanStatus !== 'CLEAN' && actor.role !== 'ADMIN' && requireClean && file.scanStatus !== 'SKIPPED') {
      throw new AppError('FILE_NOT_CLEAN', 'This file has not been scanned yet.');
    }
    if (file.scanStatus === 'SKIPPED' && actor.role !== 'ADMIN' && requireClean && this.env.NODE_ENV === 'production') {
      throw new AppError('FILE_NOT_CLEAN', 'File scanning is not configured; downloads are restricted.');
    }
    const expiresInSec = this.config.getInt('files.presignExpirySec') ?? 300;
    const url = await this.storage.presignGet({ bucket: file.bucket, key: file.key, expiresInSec, fileName: file.originalName });
    const sensitive = SENSITIVE[file.purpose as FilePurpose];
    if (sensitive) await this.audit.sensitiveAccess({ entityType: 'StoredFile', entityId: file.id, field: sensitive, purpose: 'download' });
    return { url, expiresInSec, contentType: file.contentType, fileName: file.originalName, scanStatus: file.scanStatus };
  }

  /** Raw bytes for server-side processing (imports). Never exposed over HTTP. */
  async readBytes(id: string): Promise<{ file: { id: string; purpose: string; originalName: string; contentType: string }; body: Buffer }> {
    const file = await this.prisma.client.storedFile.findUniqueOrThrow({ where: { id } });
    const body = await this.storage.get({ bucket: file.bucket, key: file.key });
    return { file, body };
  }

  /**
   * Purpose-based read rules. Ownership of cheques/proofs/recordings is refined by the owning features
   * (F-401, F-605, F-309); until then only the uploader and Admin (and Accounts for cheques/proofs) may read them.
   */
  private async canRead(actor: Actor, file: { purpose: string; uploadedByUserId: string }): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    if (file.uploadedByUserId === actor.userId) return true;
    switch (file.purpose) {
      case 'TRAINING_VIDEO':
      case 'CARD_IMAGE':
      case 'BENEFIT_PDF':
        return true;
      case 'CHEQUE':
      case 'PAYMENT_PROOF':
        return actor.role === 'ACCOUNTS';
      default:
        return false;
    }
  }

  private toDto(f: { id: string; originalName: string; contentType: string; sizeBytes: number; sha256: string; purpose: string; scanStatus: string; createdAt: Date }) {
    return { id: f.id, originalName: f.originalName, contentType: f.contentType, sizeBytes: f.sizeBytes, sha256: f.sha256, purpose: f.purpose, scanStatus: f.scanStatus, createdAt: f.createdAt.toISOString() };
  }
}
