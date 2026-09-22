import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
const Q = (n: number) => ({ text: `Question ${n}?`, options: [{ key: 'A', text: 'yes' }, { key: 'B', text: 'no' }], correctKey: 'A' });

describe('F-202 training content', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
  });
  afterAll(async () => app.close());

  it('three modules exist; publish requires questions + video; versions increment; learners never see correctKey', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const list = await request(app.getHttpServer()).get('/api/v1/training/modules').set(auth(admin.accessToken)).expect(200);
    expect(list.body.data.map((m: { sequence: number }) => m.sequence)).toEqual([1, 2, 3]);

    const noQ = await request(app.getHttpServer()).post('/api/v1/training/modules/1/publish').set(auth(admin.accessToken)).expect(400);
    expect(noQ.body.error.message).toMatch(/question/i);

    const badQ = await request(app.getHttpServer()).put('/api/v1/training/modules/1/questions').set(auth(admin.accessToken)).send({ questions: [{ ...Q(1), correctKey: 'C' }] }).expect(400);
    expect(badQ.body.error.code).toBe('VALIDATION_FAILED');

    await request(app.getHttpServer()).put('/api/v1/training/modules/1/questions').set(auth(admin.accessToken)).send({ questions: [Q(1), Q(2), Q(3)] }).expect(200);
    const noVideo = await request(app.getHttpServer()).post('/api/v1/training/modules/1/publish').set(auth(admin.accessToken)).expect(400);
    expect(noVideo.body.error.message).toMatch(/video/i);

    const video = await request(app.getHttpServer()).post('/api/v1/files/training_video').set(auth(admin.accessToken)).attach('file', MP4, { filename: 'm1.mp4', contentType: 'video/mp4' }).expect(201);
    await request(app.getHttpServer()).put('/api/v1/training/modules/1').set(auth(admin.accessToken)).send({ title: 'Welcome to KBS', videoFileId: video.body.data.id, passThresholdPct: 60 }).expect(200);
    const pub = await request(app.getHttpServer()).post('/api/v1/training/modules/1/publish').set(auth(admin.accessToken)).expect(201);
    expect(pub.body.data).toMatchObject({ status: 'PUBLISHED', version: 1, questionCount: 3, draftVersion: null });

    // edit after publish → draft v2, live stays v1 until published again
    await request(app.getHttpServer()).put('/api/v1/training/modules/1/questions').set(auth(admin.accessToken)).send({ questions: [Q(1), Q(2)] }).expect(200);
    const adminView = await request(app.getHttpServer()).get('/api/v1/training/modules/1').set(auth(admin.accessToken)).expect(200);
    expect(adminView.body.data).toMatchObject({ version: 1, draftVersion: 2, questionsVersion: 2, questionCount: 3, draftQuestionCount: 2 });
    expect(adminView.body.data.questions[0].correctKey).toBe('A');

    const { manager } = await setupManagerAndTelecaller(app, prisma, '41');
    const mgrView = await request(app.getHttpServer()).get('/api/v1/training/modules/1').set(auth(manager.accessToken)).expect(200);
    expect(mgrView.body.data.questionsVersion).toBe(1);
    expect(mgrView.body.data.questions).toHaveLength(3);
    expect(mgrView.body.data.questions[0].correctKey).toBeUndefined();

    const pub2 = await request(app.getHttpServer()).post('/api/v1/training/modules/1/publish').set(auth(admin.accessToken)).expect(201);
    expect(pub2.body.data).toMatchObject({ version: 2, questionCount: 2 });
    const audit = await prisma.auditLog.count({ where: { action: 'training.module.publish' } });
    expect(audit).toBe(2);
  });
});
