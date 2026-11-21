import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { RedisThrottlerStorage } from '../src/common/throttle/redis-throttler.storage';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { RedisService } from '../src/infra/redis/redis.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);

/** F-908 S3: the request budget follows the signed-in user; anonymous traffic is counted per client IP. */
describe('F-908 security: rate limits, idempotency lock, upload limits (SEC-06..SEC-09)', () => {
  const LIMIT = 10;
  const previous = process.env.THROTTLE_LIMIT_PER_MIN;
  let app: INestApplication;
  let prisma: PrismaService['client'];
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT_PER_MIN = String(LIMIT); // read once when the app boots
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
  });
  afterAll(async () => {
    if (previous === undefined) delete process.env.THROTTLE_LIMIT_PER_MIN;
    else process.env.THROTTLE_LIMIT_PER_MIN = previous;
    await app.close();
  });

  it('SEC-06: one user exhausting their budget does not block another user, and forged tokens count against the IP', async () => {
    for (const mobile of ['9822200001', '9822200002']) await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: `+91${mobile}`, role: 'ADVISOR', status: 'ACTIVE', fullName: `Advisor ${mobile}` } });
    const a = await loginAs(app, prisma, '9822200001');
    const b = await loginAs(app, prisma, '9822200002');

    for (let i = 0; i < LIMIT; i++) await api().get('/api/v1/auth/me').set(auth(a.accessToken)).expect(200);
    const limited = await api().get('/api/v1/auth/me').set(auth(a.accessToken)).expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    await api().get('/api/v1/auth/me').set(auth(b.accessToken)).expect(200); // same IP, own budget

    // anonymous budget is per client IP (and per route)
    for (let i = 0; i < LIMIT; i++) await api().get('/api/v1/health').expect(200);
    await api().get('/api/v1/health').expect(429);
    await api().get('/api/v1/health').set(auth('not-a-real-token')).expect(429); // a forged token does not buy a new budget
    await api().get('/api/v1/health').set(auth(b.accessToken)).expect(200); // signed-in users are not affected by it
  });

  it('SEC-07: the Redis throttler storage counts across calls, blocks over the limit and falls back when Redis fails', async () => {
    const redis = app.get(RedisService).client;
    const fallback = { increment: jest.fn(async () => ({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 })) };
    const storage = new RedisThrottlerStorage(redis, fallback, `throttle-test-${Date.now()}`);
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await storage.increment('k', 60_000, 3, 0, 'global'));
    expect(hits.map((h) => h.totalHits)).toEqual([1, 2, 3, 4]);
    expect(hits.map((h) => h.isBlocked)).toEqual([false, false, false, true]);
    expect(hits[3]?.timeToBlockExpire).toBeGreaterThan(0);
    const broken = new RedisThrottlerStorage({ eval: async () => Promise.reject(new Error('down')) } as never, fallback);
    expect((await broken.increment('k', 60_000, 3, 0, 'global')).totalHits).toBe(1);
    expect(fallback.increment).toHaveBeenCalledTimes(1);
  });

  it('SEC-08: idempotency — Redis down still serves the request (DB guards hold); a failed request frees its key at once', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const redis = app.get(RedisService).client;
    const spy = jest.spyOn(redis, 'set').mockRejectedValueOnce(new Error('redis down'));
    await api().post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ role: 'MANAGER', fullName: 'Down', mobile: '9833300001' }).expect(201);
    spy.mockRestore();
    const key = idem();
    // invalid body → 400; the same key is usable again immediately (the old lock lingered 15 s → 409)
    const started = Date.now();
    await api().post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', key).send({ role: 'MANAGER' }).expect(400);
    await api().post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', key).send({ role: 'MANAGER' }).expect(400);
    expect(Date.now() - started).toBeLessThan(5_000);
    await api().post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', key).send({ role: 'MANAGER', fullName: 'Retry Ok', mobile: '9833300002' }).expect(201);
    const replay = await api().post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', key).send({ role: 'MANAGER', fullName: 'Retry Ok', mobile: '9833300002' }).expect(201);
    expect(replay.body.meta.idempotentReplay).toBe(true);
  });

  it('SEC-09: uploads are buffered only up to the normal maximum; training videos (Admin) keep the large limit', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    await api().post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ role: 'ACCOUNTS', fullName: 'Acc Upload', mobile: '9833300003' }).expect(201);
    const acc = await loginAs(app, prisma, '9833300003');
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(26 * 1024 * 1024)]);
    const res = await api().post('/api/v1/files/payment_proof').set(auth(acc.accessToken)).attach('file', big, { filename: 'big.png', contentType: 'image/png' }).catch((e: { response?: request.Response }) => e.response);
    if (res) {
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    }
    // a small training video still uploads; a non-Admin still cannot upload one
    await api().post('/api/v1/files/training_video').set(auth(admin.accessToken)).attach('file', MP4, { filename: 'm.mp4', contentType: 'video/mp4' }).expect(201);
    await api().post('/api/v1/files/training_video').set(auth(acc.accessToken)).attach('file', MP4, { filename: 'm.mp4', contentType: 'video/mp4' }).expect(403);
  });
});
