import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);

describe('F-108 files', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
  });
  afterAll(async () => app.close());

  it('rejects a file whose bytes do not match the purpose, accepts a matching one, and presigns for readers', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const bad = await request(app.getHttpServer()).post('/api/v1/files/training_video').set(auth(admin.accessToken)).attach('file', PNG, { filename: 'video.mp4', contentType: 'video/mp4' }).expect(400);
    expect(bad.body.error.code).toBe('FILE_TYPE_REJECTED');
    const ok = await request(app.getHttpServer()).post('/api/v1/files/training_video').set(auth(admin.accessToken)).attach('file', MP4, { filename: 'm1.mp4', contentType: 'video/mp4' }).expect(201);
    expect(ok.body.data).toMatchObject({ purpose: 'TRAINING_VIDEO', contentType: 'video/mp4', scanStatus: 'SKIPPED' });
    const { telecallerMobile } = await setupManagerAndTelecaller(app, prisma, '31');
    const t = await loginAs(app, prisma, telecallerMobile);
    const url = await request(app.getHttpServer()).get(`/api/v1/files/${ok.body.data.id}/url`).set(auth(t.accessToken)).expect(200);
    expect(url.body.data.url).toContain('memory://');
    // Telecaller cannot upload training videos
    await request(app.getHttpServer()).post('/api/v1/files/training_video').set(auth(t.accessToken)).attach('file', MP4, { filename: 'x.mp4', contentType: 'video/mp4' }).expect(403);
  });

  it('RBAC-02: another Advisor cannot obtain a URL for someone else\'s cheque; the owner and Accounts can; downloads are logged', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const mkAdvisor = async (mobile: string) => {
      await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${mobile}` } });
      const r = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile, purpose: 'ADVISOR_SIGNUP' }).expect(201);
      const v = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ challengeId: r.body.data.challengeId, code: '000000', platform: 'ANDROID' }).expect(201);
      return v.body.data as { accessToken: string; user: { id: string } };
    };
    const a = await mkAdvisor('9444400001');
    const b = await mkAdvisor('9444400002');
    const up = await request(app.getHttpServer()).post('/api/v1/files/cheque').set(auth(a.accessToken)).attach('file', PNG, { filename: 'cheque.png', contentType: 'image/png' }).expect(201);
    await request(app.getHttpServer()).get(`/api/v1/files/${up.body.data.id}/url`).set(auth(b.accessToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/files/${up.body.data.id}/url`).set(auth(a.accessToken)).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/files/${up.body.data.id}/url`).set(auth(admin.accessToken)).expect(200);
    const logs = await prisma.sensitiveAccessLog.findMany({ where: { entityId: up.body.data.id, field: 'CHEQUE' } });
    expect(logs.length).toBe(2);
  });
});
