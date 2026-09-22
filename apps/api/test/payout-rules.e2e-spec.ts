import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-601 payout rules and rates (versioned, per bank)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let adminToken: string;
  let hdfcId: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    adminToken = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
  });
  afterAll(async () => app.close());

  it('seed has no rules; Admin creates DRAFT → approve (reason, audited) → edit creates v2 DRAFT carrying rates; approving v2 retires v1', async () => {
    expect((await api().get('/api/v1/payouts/rules').set(auth(adminToken)).expect(200)).body.data).toEqual([]);
    // Manager cannot manage rules
    const mgr = await setupManagerAndTelecaller(app, prisma, '80001');
    await api().post('/api/v1/payouts/rules').set(auth(mgr.manager.accessToken)).set('idempotency-key', idem()).send({}).expect(403);
    // validation: PII trigger field, bad regex, bad window
    await api().post('/api/v1/payouts/rules').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'x', triggerField: 'customerName', triggerValues: ['a'], effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(400);
    await api().post('/api/v1/payouts/rules').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'Bad regex', triggerValues: ['V + ACTIVE'], productCodePattern: '(', effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(400);
    await api().post('/api/v1/payouts/rules').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'Bad window', triggerValues: ['V + ACTIVE'], effectiveFrom: '2026-02-01T00:00:00.000Z', effectiveTo: '2026-01-01T00:00:00.000Z' }).expect(400);

    const r = await api().post('/api/v1/payouts/rules').set(auth(adminToken)).set('idempotency-key', idem()).send({ bankId: hdfcId, name: 'HDFC activation', triggerValues: [' V + ACTIVE '], holdDays: 7, effectiveFrom: '2026-01-01T00:00:00.000Z', notes: 'V + ACTIVE only; TXN ACTIVE - Rs 100 deliberately excluded until KBS confirms' }).expect(201);
    expect(r.body.data).toMatchObject({ version: 1, status: 'DRAFT', triggerField: 'cardActivationStatus', triggerValues: ['V + ACTIVE'], holdDays: 7, currentRate: null, entitlementCount: 0 });
    const ruleId = r.body.data.id as string;
    // rate as DRAFT, then approve
    const withRate = await api().post(`/api/v1/payouts/rules/${ruleId}/rates`).set(auth(adminToken)).set('idempotency-key', idem()).send({ amountInr: 1500, effectiveFrom: '2026-01-01T00:00:00.000Z' }).expect(201);
    const rateId = withRate.body.data.rates[0].id as string;
    expect(withRate.body.data.currentRate).toBeNull(); // DRAFT rate is not in force
    await api().post(`/api/v1/payouts/rates/${rateId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'agreed with HDFC' }).expect(201);
    expect((await api().get(`/api/v1/payouts/rules/${ruleId}`).set(auth(adminToken)).expect(200)).body.data.currentRate.amountInr).toBe(1500);
    // approve the rule
    await api().post(`/api/v1/payouts/rules/${ruleId}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'signed commission sheet Sep-2026' }).expect(201);
    expect(await prisma.auditLog.count({ where: { action: 'payoutRule.approve', entityId: ruleId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'payoutRate.approve', entityId: rateId } })).toBe(1);
    // editing an APPROVED rule → new DRAFT version with rates carried over; v1 still APPROVED
    const v2 = await api().patch(`/api/v1/payouts/rules/${ruleId}`).set(auth(adminToken)).send({ triggerValues: ['V + ACTIVE', 'TXN ACTIVE - Rs 100'] }).expect(200);
    expect(v2.body.data).toMatchObject({ version: 2, status: 'DRAFT', triggerValues: ['V + ACTIVE', 'TXN ACTIVE - Rs 100'] });
    expect(v2.body.data.currentRate.amountInr).toBe(1500);
    expect((await api().get(`/api/v1/payouts/rules/${ruleId}`).set(auth(adminToken)).expect(200)).body.data.status).toBe('APPROVED');
    await api().post(`/api/v1/payouts/rules/${v2.body.data.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'KBS confirmed TXN ACTIVE counts' }).expect(201);
    const list = (await api().get(`/api/v1/payouts/rules?bankId=${hdfcId}`).set(auth(adminToken)).expect(200)).body.data as Array<{ version: number; status: string }>;
    expect(list.map((x) => [x.version, x.status])).toEqual([
      [2, 'APPROVED'],
      [1, 'RETIRED'],
    ]);
    // retired rule is read-only
    await api().patch(`/api/v1/payouts/rules/${ruleId}`).set(auth(adminToken)).send({ holdDays: 1 }).expect(409);
  });

  it('rate versioning: a new approved rate closes the previous one at its effectiveFrom; seen-values picker lists MIS values', async () => {
    const rule = (await api().get(`/api/v1/payouts/rules?bankId=${hdfcId}&status=APPROVED`).set(auth(adminToken)).expect(200)).body.data[0];
    const nr = await api().post(`/api/v1/payouts/rules/${rule.id}/rates`).set(auth(adminToken)).set('idempotency-key', idem()).send({ amountInr: 1800, effectiveFrom: '2026-10-01T00:00:00.000Z' }).expect(201);
    const newRate = nr.body.data.rates.find((x: { amountInr: number }) => x.amountInr === 1800);
    await api().post(`/api/v1/payouts/rates/${newRate.id}/approve`).set(auth(adminToken)).set('idempotency-key', idem()).send({ reason: 'Oct revision' }).expect(201);
    const after = (await api().get(`/api/v1/payouts/rules/${rule.id}`).set(auth(adminToken)).expect(200)).body.data;
    const old = after.rates.find((x: { amountInr: number }) => x.amountInr === 1500);
    expect(old.effectiveTo).toBe('2026-10-01T00:00:00.000Z');
    expect(after.currentRate.amountInr).toBe(1500); // today (Sep 2026) the old rate still applies
    const seen = await api().get(`/api/v1/payouts/rules/seen-values?bankId=${hdfcId}&field=cardActivationStatus`).set(auth(adminToken)).expect(200);
    expect(seen.body.data).toEqual({ field: 'cardActivationStatus', values: [] });
  });
});
