import { CONFIG_KEYS } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { ConfigService } from '../src/modules/config/config.service';

import { ADMIN_MOBILE, auth, bootTestApp, loginAs, resetDatabase } from './helpers';

const unsetDefault = (v: unknown) => v === null || v === undefined || v === false || (Array.isArray(v) && v.length === 0);

describe('F-104 SystemConfig: reason + history, cross-instance invalidation, launch gates (REQ-28 §28.2)', () => {
  let a: INestApplication;
  let b: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app: a, prisma } = await bootTestApp());
    ({ app: b } = await bootTestApp()); // a second API instance sharing Postgres + Redis
    admin = (await loginAs(a, prisma, ADMIN_MOBILE)).accessToken;
  });
  afterAll(async () => {
    await b.close();
    await a.close();
  });

  it('F-104: on a fresh seed the launch-gate list is exactly the ★ keys, set only where the default is a real value', async () => {
    const gates = (await request(a.getHttpServer()).get('/api/v1/config/launch-gates').set(auth(admin)).expect(200)).body.data as { key: string; isSet: boolean }[];
    const starred = CONFIG_KEYS.filter((k) => k.requiresValueBeforeProd);
    expect(gates.map((g) => g.key).sort()).toEqual(starred.map((k) => k.key).sort());
    for (const k of starred) expect(gates.find((g) => g.key === k.key)?.isSet).toBe(!unsetDefault(k.defaultValue));
    expect(gates.filter((g) => !g.isSet).length).toBeGreaterThan(0); // BLOCKED items stay visible until KBS decides
  });

  it('F-104: a change without a reason is rejected and leaves no history; with a reason it records old/new/actor', async () => {
    const key = 'payouts.requestStaleDays';
    await request(a.getHttpServer()).put(`/api/v1/config/${key}`).set(auth(admin)).send({ value: 14 }).expect(400);
    expect(await prisma.systemConfigHistory.count({ where: { key } })).toBe(0);
    await request(a.getHttpServer()).put(`/api/v1/config/${key}`).set(auth(admin)).send({ value: 14, reason: 'pilot policy' }).expect(200);
    const hist = (await request(a.getHttpServer()).get(`/api/v1/config/${key}/history`).set(auth(admin)).expect(200)).body.data;
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ newValue: 14, reason: 'pilot policy', changedBy: { role: 'ADMIN' } });
    await request(a.getHttpServer()).get('/api/v1/config/no.such.key/history').set(auth(admin)).expect(404);
    await request(a.getHttpServer()).put(`/api/v1/config/${key}`).set(auth(admin)).send({ value: 'fourteen', reason: 'wrong type' }).expect(400);
  });

  it('F-104: a change on instance A is visible on instance B within 1 s (Redis pub/sub invalidation)', async () => {
    const key = 'training.windowHours';
    const cfgB = b.get(ConfigService);
    const before = cfgB.getInt(key);
    const next = (before ?? 72) + 1;
    await request(a.getHttpServer()).put(`/api/v1/config/${key}`).set(auth(admin)).send({ value: next, reason: 'invalidation test' }).expect(200);
    const started = Date.now();
    while (cfgB.getInt(key) !== next && Date.now() - started < 1000) await new Promise((r) => setTimeout(r, 25));
    expect(cfgB.getInt(key)).toBe(next);
    expect(Date.now() - started).toBeLessThan(1000);
    await request(a.getHttpServer()).put(`/api/v1/config/${key}`).set(auth(admin)).send({ value: before, reason: 'restore' }).expect(200);
  });
});
