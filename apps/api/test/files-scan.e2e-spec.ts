import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { SCAN_PROVIDER, type ScanProvider } from '../src/providers/ports';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase } from './helpers';

const PNG = (tail: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]), Buffer.from(tail)]);

describe('F-902 malware scanning: quarantine, fail-closed, rescan (REQ-24 §24.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let accounts: string;
  let scanner: ScanProvider;
  let mode: 'ok' | 'down' = 'ok';
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    await api().post('/api/v1/users').set(auth(admin)).set('idempotency-key', crypto.randomUUID()).send({ role: 'ACCOUNTS', fullName: 'Acc Scan', mobile: '9666600039' }).expect(201);
    accounts = (await loginAs(app, prisma, '9666600039')).accessToken;
    scanner = app.get(SCAN_PROVIDER);
    // test double standing in for clamd (the TCP adapter has its own unit tests)
    scanner.scan = async ({ body }) => {
      if (mode === 'down') throw new Error('clamd unreachable');
      return body.includes(Buffer.from('EICAR')) ? { status: 'INFECTED', detail: 'Win.Test.EICAR_HDB-1' } : { status: 'CLEAN' };
    };
  });
  afterAll(async () => app.close());

  it('infected upload → FILE_NOT_CLEAN, stored under quarantine/, audited, Admin alerted, never served', async () => {
    const r = await api().post('/api/v1/files/payment_proof').set(auth(accounts)).attach('file', PNG('EICAR'), { filename: 'bad.png', contentType: 'image/png' });
    expect(r.body.error.code).toBe('FILE_NOT_CLEAN');
    const f = await prisma.storedFile.findUniqueOrThrow({ where: { id: r.body.error.details.fileId } });
    expect(f).toMatchObject({ scanStatus: 'INFECTED' });
    expect(f.key.startsWith('quarantine/')).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'files.quarantine', entityId: f.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { kind: 'SECURITY_EVENT', dedupeKey: `security:quarantine:${f.id}` } })).toBe(1);
    expect((await api().get(`/api/v1/files/${f.id}/url`).set(auth(admin))).body.error.code).toBe('FILE_NOT_CLEAN'); // not even Admin
    expect((await api().post(`/api/v1/files/${f.id}/rescan`).set(auth(admin)).expect(403)).body.error.code).toBe('FILE_NOT_CLEAN');
  });

  it('scanner down → PENDING (fail closed) until an Admin rescan returns CLEAN', async () => {
    mode = 'down';
    const up = (await api().post('/api/v1/files/payment_proof').set(auth(accounts)).attach('file', PNG('fine'), { filename: 'ok.png', contentType: 'image/png' }).expect(201)).body.data;
    expect(up.scanStatus).toBe('PENDING');
    expect((await api().get(`/api/v1/files/${up.id}/url`).set(auth(accounts))).body.error.code).toBe('FILE_NOT_CLEAN');
    await api().post(`/api/v1/files/${up.id}/rescan`).set(auth(accounts)).expect(403);
    await api().post(`/api/v1/files/${up.id}/rescan`).set(auth(admin)).expect(500); // still down: explicit error, status unchanged
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: up.id } })).scanStatus).toBe('PENDING');
    mode = 'ok';
    expect((await api().post(`/api/v1/files/${up.id}/rescan`).set(auth(admin)).expect(201)).body.data.scanStatus).toBe('CLEAN');
    await api().get(`/api/v1/files/${up.id}/url`).set(auth(accounts)).expect(200);
    expect(await prisma.auditLog.count({ where: { action: 'files.rescan', entityId: up.id } })).toBe(1);
  });
});
