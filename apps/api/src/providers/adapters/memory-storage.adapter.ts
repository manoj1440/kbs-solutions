import type { StorageProvider } from '../ports';

/** In-memory object store for tests/dev without MinIO. */
export class MemoryStorageAdapter implements StorageProvider {
  readonly name = 'memory';
  private readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  async put(input: { bucket: string; key: string; body: Buffer; contentType: string }) {
    this.objects.set(`${input.bucket}/${input.key}`, { body: input.body, contentType: input.contentType });
  }
  async get(input: { bucket: string; key: string }) {
    const o = this.objects.get(`${input.bucket}/${input.key}`);
    if (!o) throw new Error('object not found');
    return o.body;
  }
  async presignGet(input: { bucket: string; key: string; expiresInSec: number }) {
    return `memory://${input.bucket}/${input.key}?expires=${Date.now() + input.expiresInSec * 1000}`;
  }
  async delete(input: { bucket: string; key: string }) {
    this.objects.delete(`${input.bucket}/${input.key}`);
  }
  has(bucket: string, key: string) {
    return this.objects.has(`${bucket}/${key}`);
  }
}
