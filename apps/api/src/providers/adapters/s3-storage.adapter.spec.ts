import { S3StorageAdapter } from './s3-storage.adapter';

/** UAT-01: with the storage host unreachable an upload used to hang for minutes (no socket timeout). */
describe('S3StorageAdapter timeouts', () => {
  it('fails within seconds when the endpoint does not answer', async () => {
    // 10.255.255.1 is a non-routable address: the TCP connect never completes
    const s3 = new S3StorageAdapter({ endpoint: 'http://10.255.255.1:9000', region: 'ap-south-1', accessKeyId: 'x', secretAccessKey: 'y', forcePathStyle: true });
    const started = Date.now();
    await expect(s3.put({ bucket: 'b', key: 'k', body: Buffer.from('x'), contentType: 'text/plain' })).rejects.toBeDefined();
    expect(Date.now() - started).toBeLessThan(20_000);
  }, 30_000);
});
