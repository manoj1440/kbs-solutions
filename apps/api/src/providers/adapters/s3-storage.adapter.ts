import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { StorageProvider } from '../ports';

/** S3-compatible object storage (MinIO in dev). Private bucket; access only through presigned URLs (REQ-21 §21.1). */
export class S3StorageAdapter implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;
  constructor(opts: { endpoint?: string; region: string; accessKeyId?: string; secretAccessKey?: string; forcePathStyle: boolean }) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      forcePathStyle: opts.forcePathStyle,
      credentials: opts.accessKeyId && opts.secretAccessKey ? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } : undefined,
    });
  }
  async put(input: { bucket: string; key: string; body: Buffer; contentType: string }) {
    await this.client.send(new PutObjectCommand({ Bucket: input.bucket, Key: input.key, Body: input.body, ContentType: input.contentType }));
  }
  async get(input: { bucket: string; key: string }) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: input.bucket, Key: input.key }));
    const bytes = await res.Body?.transformToByteArray();
    return Buffer.from(bytes ?? new Uint8Array());
  }
  async presignGet(input: { bucket: string; key: string; expiresInSec: number; fileName?: string }) {
    const cmd = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ResponseContentDisposition: input.fileName ? `inline; filename="${input.fileName.replace(/"/g, '')}"` : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: input.expiresInSec });
  }
}
