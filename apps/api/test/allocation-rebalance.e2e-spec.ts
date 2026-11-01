import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
const Q = (n: number) => ({ text: `Question ${n}?`, options: [{ key: 'A', text: 'right' }, { key: 'B', text: 'wrong' }], correctKey: 'A' });

describe('A20 rebalance when a Telecaller passes training', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    for (const seq of [1, 2, 3]) {
      const video = await api().post('/api/v1/files/training_video').set(auth(adminToken)).attach('file', MP4, { filename: `m${seq}.mp4`, contentType: 'video/mp4' }).expect(201);
      await api().put(`/api/v1/training/modules/${seq}/questions`).set(auth(adminToken)).send({ questions: [Q(1), Q(2), Q(3)] }).expect(200);
      await api().put(`/api/v1/training/modules/${seq}`).set(auth(adminToken)).send({ title: `Module ${seq}`, videoFileId: video.body.data.id, passThresholdPct: 70 }).expect(200);
      await api().post(`/api/v1/training/modules/${seq}/publish`).set(auth(adminToken)).expect(201);
    }
  });
  afterAll(async () => app.close());

  async function passTraining(mobile: string) {
    const t = await loginAs(app, prisma, mobile);
    for (const seq of [1, 2, 3]) {
      await api().post(`/api/v1/training/modules/${seq}/video-progress`).set(auth(t.accessToken)).send({ positionSec: 10, durationSec: 10, completed: true }).expect(201);
      const a = await api().post(`/api/v1/training/modules/${seq}/attempts`).set(auth(t.accessToken)).expect(201);
      const answers = Object.fromEntries(a.body.data.questions.map((q: { id: string; options: { key: string; text: string }[] }) => [q.id, q.options.find((o) => o.text === 'right')?.key]));
      await api().post(`/api/v1/training/attempts/${a.body.data.attemptId}/submit`).set(auth(t.accessToken)).send({ answers }).expect(201);
    }
  }

  it('100 records over 4 → a 5th passes training → 20 each; worked records stay put', async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 't', key: 't/r.csv', originalName: 'r.csv', contentType: 'text/csv', sizeBytes: 1, sha256: 'e'.repeat(64), uploadedByUserId: admin.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: admin.id, checksum: 'e'.repeat(64), status: 'IMPORTED' } });
    const four = [];
    for (const n of [1, 2, 3, 4]) {
      const s = await setupManagerAndTelecaller(app, prisma, `6100${n}`);
      await prisma.trainingEnrollment.update({ where: { telecallerUserId: s.telecallerId }, data: { status: 'PASSED', passedAt: new Date(), firstLoginAt: new Date() } });
      await prisma.callingRecord.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ batchId: batch.id, sourceRowNumber: n * 100 + i, fullName: `C${n}-${i}`, mobile: `+9195559${n}${String(i).padStart(4, '0')}`, pincode: '302001', assignedTelecallerUserId: s.telecallerId, assignedAt: new Date() })) });
      four.push(s);
    }
    // agent 1 has already worked ten customers: they must never move
    const worked = await prisma.callingRecord.findMany({ where: { assignedTelecallerUserId: four[0]?.telecallerId }, take: 10, select: { id: true } });
    await prisma.callingRecord.updateMany({ where: { id: { in: worked.map((w) => w.id) } }, data: { interactionStatus: 'FOLLOW_UP' } });

    const fifth = await setupManagerAndTelecaller(app, prisma, '61005');
    await passTraining(fifth.telecallerMobile);

    const counts = await prisma.callingRecord.groupBy({ by: ['assignedTelecallerUserId'], _count: { _all: true } });
    expect(counts.map((c) => c._count._all).sort()).toEqual([20, 20, 20, 20, 20]);
    expect(await prisma.callingRecord.count({ where: { id: { in: worked.map((w) => w.id) }, assignedTelecallerUserId: four[0]?.telecallerId } })).toBe(10);
    expect(await prisma.callingRecord.count({ where: { assignedTelecallerUserId: fifth.telecallerId, interactionStatus: { not: 'UNTOUCHED' } } })).toBe(0);
    expect(await prisma.allocationEvent.count({ where: { toTelecallerUserId: fifth.telecallerId, reason: { startsWith: 'REBALANCE' } } })).toBe(20);
    expect(await prisma.notification.count({ where: { recipientUserId: fifth.telecallerId, kind: 'ASSIGNMENT_NEW' } })).toBe(1);
  });
});
