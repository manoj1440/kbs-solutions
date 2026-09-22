import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
const Q = (n: number) => ({ text: `Question ${n}?`, options: [{ key: 'A', text: 'right' }, { key: 'B', text: 'wrong' }], correctKey: 'A' });

async function publishAll(app: INestApplication, adminToken: string, threshold = 70) {
  for (const seq of [1, 2, 3]) {
    const v = await request(app.getHttpServer()).post('/api/v1/files/training_video').set(auth(adminToken)).attach('file', MP4, { filename: `m${seq}.mp4`, contentType: 'video/mp4' }).expect(201);
    await request(app.getHttpServer()).put(`/api/v1/training/modules/${seq}`).set(auth(adminToken)).send({ title: `M${seq}`, videoFileId: v.body.data.id, passThresholdPct: threshold }).expect(200);
    await request(app.getHttpServer()).put(`/api/v1/training/modules/${seq}/questions`).set(auth(adminToken)).send({ questions: [Q(1), Q(2), Q(3), Q(4), Q(5)] }).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/training/modules/${seq}/publish`).set(auth(adminToken)).expect(201);
  }
}

/** Answers `correctCount` questions right, the rest wrong. */
function answersFor(questions: Array<{ id: string }>, correctCount: number) {
  return Object.fromEntries(questions.map((q, i) => [q.id, i < correctCount ? 'A' : 'B']));
}

describe('F-203 training flow', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    await publishAll(app, admin.accessToken);
  });
  afterAll(async () => app.close());

  it('TRAIN-03: modules are sequential, video gate applies, pass at exact threshold, no regression, queue opens after M3', async () => {
    const { telecallerMobile, manager } = await setupManagerAndTelecaller(app, prisma, '51');
    const t = await loginAs(app, prisma, telecallerMobile);
    const me = await request(app.getHttpServer()).get('/api/v1/training/me').set(auth(t.accessToken)).expect(200);
    expect(me.body.data.modules.map((m: { status: string }) => m.status)).toEqual(['IN_PROGRESS', 'LOCKED', 'LOCKED']);
    expect(me.body.data.modules[0].assessmentAvailable).toBe(false); // video not watched

    const locked = await request(app.getHttpServer()).post('/api/v1/training/modules/2/attempts').set(auth(t.accessToken)).expect(403);
    expect(locked.body.error.code).toBe('TRAINING_MODULE_LOCKED');
    const noVideo = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(400);
    expect(noVideo.body.error.message).toMatch(/video/i);

    await request(app.getHttpServer()).post('/api/v1/training/modules/1/video-progress').set(auth(t.accessToken)).send({ positionSec: 100, durationSec: 100, completed: true }).expect(201);
    const a1 = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(201);
    expect(a1.body.data.questions).toHaveLength(5);
    expect(a1.body.data.questions[0].correctKey).toBeUndefined();

    // 3/5 = 60% < 70 → fail
    const fail = await request(app.getHttpServer()).post(`/api/v1/training/attempts/${a1.body.data.attemptId}/submit`).set(auth(t.accessToken)).send({ answers: answersFor(a1.body.data.questions, 3) }).expect(201);
    expect(fail.body.data).toMatchObject({ scorePct: 60, passed: false, retryAvailable: true });
    // exactly threshold: set threshold 80 and score 4/5
    await prisma.trainingModule.update({ where: { sequence: 1 }, data: { passThresholdPct: 80 } });
    const a2 = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(201);
    const pass = await request(app.getHttpServer()).post(`/api/v1/training/attempts/${a2.body.data.attemptId}/submit`).set(auth(t.accessToken)).send({ answers: answersFor(a2.body.data.questions, 4) }).expect(201);
    expect(pass.body.data).toMatchObject({ scorePct: 80, passed: true, nextModuleSequence: 2, allModulesPassed: false });

    // still blocked from calling queue until M3 passes
    let gates = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(t.accessToken)).expect(200);
    expect(gates.body.data.gates.training).toMatchObject({ passed: false, currentModuleSequence: 2 });

    for (const seq of [2, 3]) {
      await request(app.getHttpServer()).post(`/api/v1/training/modules/${seq}/video-progress`).set(auth(t.accessToken)).send({ positionSec: 10, durationSec: 10, completed: true }).expect(201);
      const a = await request(app.getHttpServer()).post(`/api/v1/training/modules/${seq}/attempts`).set(auth(t.accessToken)).expect(201);
      const r = await request(app.getHttpServer()).post(`/api/v1/training/attempts/${a.body.data.attemptId}/submit`).set(auth(t.accessToken)).send({ answers: answersFor(a.body.data.questions, 5) }).expect(201);
      expect(r.body.data.passed).toBe(true);
      if (seq === 3) expect(r.body.data.allModulesPassed).toBe(true);
    }
    gates = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(t.accessToken)).expect(200);
    expect(gates.body.data.gates.training).toMatchObject({ passed: true, status: 'PASSED' });
    const mgrNotif = await prisma.notification.findFirst({ where: { recipientUserId: manager.user.id, kind: 'TRAINING_PASSED' } });
    expect(mgrNotif).toBeTruthy();
    // no regression: a passed module cannot be re-attempted
    const again = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(409);
    expect(again.body.error.code).toBe('CONFLICT');
  });

  it('attempt limit is honoured when configured; deadline passed blocks new attempts', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    await request(app.getHttpServer()).put('/api/v1/config/training.attemptLimit').set(auth(admin.accessToken)).send({ value: 1, reason: 'test limit' }).expect(200);
    const { telecallerMobile } = await setupManagerAndTelecaller(app, prisma, '52');
    const t = await loginAs(app, prisma, telecallerMobile);
    await request(app.getHttpServer()).post('/api/v1/training/modules/1/video-progress').set(auth(t.accessToken)).send({ positionSec: 10, durationSec: 10, completed: true }).expect(201);
    const a = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/training/attempts/${a.body.data.attemptId}/submit`).set(auth(t.accessToken)).send({ answers: answersFor(a.body.data.questions, 0) }).expect(201);
    const limited = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(403);
    expect(limited.body.error.code).toBe('TRAINING_ATTEMPT_LIMIT');
    await request(app.getHttpServer()).put('/api/v1/config/training.attemptLimit').set(auth(admin.accessToken)).send({ value: null, reason: 'restore' }).expect(200);

    await prisma.trainingEnrollment.update({ where: { telecallerUserId: t.user.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    const blocked = await request(app.getHttpServer()).post('/api/v1/training/modules/1/attempts').set(auth(t.accessToken)).expect(403);
    expect(blocked.body.error.code).toBe('GATE_TRAINING_BLOCKED');
  });
});
