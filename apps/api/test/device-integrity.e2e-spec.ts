import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { auth, bootTestApp, resetDatabase, setupManagerAndTelecaller, loginAs } from './helpers';

describe('F-302 device integrity report (REQ-09 §9.3 — warn, never block)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let tc: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const s = await setupManagerAndTelecaller(app, prisma, '302');
    tc = (await loginAs(app, prisma, s.telecallerMobile)).accessToken;
  });
  afterAll(async () => app.close());

  it('F-302: a clean device is audited without alerting anyone', async () => {
    const r = await api().post('/api/v1/auth/device-integrity').set(auth(tc)).send({ rooted: false, platform: 'ANDROID', appVersion: '0.1.0' }).expect(201);
    expect(r.body.data).toEqual({ recorded: true, warning: null });
    expect(await prisma.auditLog.count({ where: { action: 'security.deviceIntegrity' } })).toBe(1);
    expect(await prisma.notification.count({ where: { kind: 'SECURITY_EVENT', dedupeKey: { startsWith: 'security:rooted:' } } })).toBe(0);
  });

  it('F-302: a rooted device returns a warning, is audited and alerts the Admin once per session — access is not blocked', async () => {
    for (let i = 0; i < 2; i++) {
      const r = await api().post('/api/v1/auth/device-integrity').set(auth(tc)).send({ rooted: true, platform: 'ANDROID', deviceModel: 'Pixel test' }).expect(201);
      expect(r.body.data.warning).toMatch(/rooted/);
    }
    expect(await prisma.notification.count({ where: { kind: 'SECURITY_EVENT', dedupeKey: { startsWith: 'security:rooted:' } } })).toBe(1);
    const row = await prisma.auditLog.findFirstOrThrow({ where: { action: 'security.deviceIntegrity' }, orderBy: { at: 'desc' } });
    expect(row).toMatchObject({ entityType: 'Session', after: { rooted: true, platform: 'ANDROID' } });
    await api().get('/api/v1/auth/me').set(auth(tc)).expect(200);
    await api().post('/api/v1/auth/device-integrity').set(auth(tc)).send({ rooted: 'yes', platform: 'ANDROID' }).expect(400);
  });
});
