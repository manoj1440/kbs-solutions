import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
const Q = (n: number) => ({ text: `Question ${n}?`, options: [{ key: 'A', text: 'right' }, { key: 'B', text: 'wrong' }], correctKey: 'A' });

async function publishAll(app: INestApplication, adminToken: string) {
  for (const seq of [1, 2, 3]) {
    const v = await request(app.getHttpServer()).post('/api/v1/files/training_video').set(auth(adminToken)).attach('file', MP4, { filename: `m${seq}.mp4`, contentType: 'video/mp4' }).expect(201);
    await request(app.getHttpServer()).put(`/api/v1/training/modules/${seq}`).set(auth(adminToken)).send({ videoFileId: v.body.data.id }).expect(200);
    await request(app.getHttpServer()).put(`/api/v1/training/modules/${seq}/questions`).set(auth(adminToken)).send({ questions: [Q(1), Q(2)] }).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/training/modules/${seq}/publish`).set(auth(adminToken)).expect(201);
  }
}
async function passModule(app: INestApplication, token: string, seq: number) {
  await request(app.getHttpServer()).post(`/api/v1/training/modules/${seq}/video-progress`).set(auth(token)).send({ positionSec: 10, durationSec: 10, completed: true }).expect(201);
  const a = await request(app.getHttpServer()).post(`/api/v1/training/modules/${seq}/attempts`).set(auth(token)).expect(201);
  const answers = Object.fromEntries(a.body.data.questions.map((q: { id: string }) => [q.id, 'A']));
  await request(app.getHttpServer()).post(`/api/v1/training/attempts/${a.body.data.attemptId}/submit`).set(auth(token)).send({ answers }).expect(201);
}

describe('F-204 expiry and reactivation / F-205 visibility', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    await publishAll(app, admin.accessToken);
  });
  afterAll(async () => app.close());

  it('TRAIN-04/05/06: sweep deactivates at deadline, only the assigned Manager reactivates, resume at Module 3 with M1/M2 kept', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const a = await setupManagerAndTelecaller(app, prisma, '61');
    const b = await setupManagerAndTelecaller(app, prisma, '62');
    const t = await loginAs(app, prisma, a.telecallerMobile);
    await passModule(app, t.accessToken, 1);
    await passModule(app, t.accessToken, 2);

    // deadline elapses
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: a.telecallerId }, data: { deadlineAt: new Date(Date.now() - 60_000) } });
    // lazy gate blocks immediately
    const blocked = await request(app.getHttpServer()).post('/api/v1/training/modules/3/attempts').set(auth(t.accessToken)).expect(403);
    expect(blocked.body.error.code).toBe('GATE_TRAINING_BLOCKED');
    // sweep materialises deactivation
    const sweep = await request(app.getHttpServer()).post('/api/v1/training/sweep').set(auth(admin.accessToken)).expect(201);
    expect(sweep.body.data.expired).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: a.telecallerId } });
    expect(user.status).toBe('DEACTIVATED');
    await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(t.accessToken)).expect(401);
    expect(await prisma.notification.count({ where: { recipientUserId: a.manager.user.id, kind: 'TRAINING_DEACTIVATED' } })).toBe(1);
    // second sweep is a no-op
    const sweep2 = await request(app.getHttpServer()).post('/api/v1/training/sweep').set(auth(admin.accessToken)).expect(201);
    expect(sweep2.body.data.expired).toBe(0);

    // TRAIN-06: another Manager cannot reactivate
    const cross = await request(app.getHttpServer()).post(`/api/v1/telecallers/${a.telecallerId}/training/reactivate`).set(auth(b.manager.accessToken)).send({ reason: 'not mine' }).expect(404);
    expect(cross.body.error.code).toBe('NOT_FOUND');
    // Admin generic reactivate is refused for training-expired Telecallers
    const adminTry = await request(app.getHttpServer()).post(`/api/v1/users/${a.telecallerId}/reactivate`).set(auth(admin.accessToken)).send({ reason: 'admin override attempt' }).expect(409);
    expect(adminTry.body.error.code).toBe('CONFLICT');

    // window not configured → reactivation succeeds but gate stays closed with explicit reason
    const re1 = await request(app.getHttpServer()).post(`/api/v1/telecallers/${a.telecallerId}/training/reactivate`).set(auth(a.manager.accessToken)).send({ reason: 'second chance' }).expect(201);
    expect(re1.body.data).toMatchObject({ resumedAtModuleSequence: 3, newDeadlineAt: null, windowConfigured: false });
    const t2 = await loginAs(app, prisma, a.telecallerMobile);
    expect(t2.gates.training).toMatchObject({ passed: false, reason: 'REACTIVATION_WINDOW_NOT_CONFIGURED', currentModuleSequence: 3 });
    const me = await request(app.getHttpServer()).get('/api/v1/training/me').set(auth(t2.accessToken)).expect(200);
    expect(me.body.data.modules.map((m: { status: string }) => m.status)).toEqual(['PASSED', 'PASSED', 'IN_PROGRESS']);

    // Admin configures the window → subsequent reactivation grants a deadline (simulate a second expiry)
    await request(app.getHttpServer()).put('/api/v1/config/training.reactivationWindowHours').set(auth(admin.accessToken)).send({ value: 24, reason: 'policy set' }).expect(200);
    await prisma.trainingEnrollment.update({ where: { telecallerUserId: a.telecallerId }, data: { status: 'EXPIRED_DEACTIVATED', deadlineAt: new Date(Date.now() - 1000) } });
    const re2 = await request(app.getHttpServer()).post(`/api/v1/telecallers/${a.telecallerId}/training/reactivate`).set(auth(a.manager.accessToken)).send({ reason: 'window configured now' }).expect(201);
    expect(re2.body.data.windowConfigured).toBe(true);
    expect(new Date(re2.body.data.newDeadlineAt).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    const t3 = await loginAs(app, prisma, a.telecallerMobile);
    expect(t3.gates.training).toMatchObject({ passed: false, reason: 'IN_PROGRESS', currentModuleSequence: 3 });
    await passModule(app, t3.accessToken, 3);
    const done = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(t3.accessToken)).expect(200);
    expect(done.body.data.gates.training.passed).toBe(true);

    // F-205 visibility
    const detail = await request(app.getHttpServer()).get(`/api/v1/telecallers/${a.telecallerId}/training`).set(auth(a.manager.accessToken)).expect(200);
    expect(detail.body.data.reactivations).toHaveLength(2);
    expect(detail.body.data.modules.map((m: { status: string }) => m.status)).toEqual(['PASSED', 'PASSED', 'PASSED']);
    await request(app.getHttpServer()).get(`/api/v1/telecallers/${a.telecallerId}/training`).set(auth(b.manager.accessToken)).expect(404);
    const team = await request(app.getHttpServer()).get('/api/v1/training/team').set(auth(a.manager.accessToken)).expect(200);
    expect(team.body.data.map((r: { telecaller: { id: string } }) => r.telecaller.id)).toEqual([a.telecallerId]);
    expect(team.body.meta.byStatus.PASSED).toBe(1);
    const all = await request(app.getHttpServer()).get('/api/v1/training/team').set(auth(admin.accessToken)).expect(200);
    expect(all.body.meta.population).toBeGreaterThanOrEqual(2);
    const filtered = await request(app.getHttpServer()).get(`/api/v1/training/team?managerId=${b.managerId}`).set(auth(admin.accessToken)).expect(200);
    expect(filtered.body.data.map((r: { telecaller: { id: string } }) => r.telecaller.id)).toEqual([b.telecallerId]);
    await request(app.getHttpServer()).put('/api/v1/config/training.reactivationWindowHours').set(auth(admin.accessToken)).send({ value: null, reason: 'restore' }).expect(200);
  });
});
