import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ALL_AUDIT_ACTIONS, AUDIT_ACTION_GROUPS } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('F-704 audit dashboard (REQ-24 §24.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  let managerToken: string;
  let telecallerId: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    const m = await setupManagerAndTelecaller(app, prisma, '95001');
    managerToken = m.manager.accessToken;
    telecallerId = m.telecallerId;
  });
  afterAll(async () => app.close());

  it('every catalogued REQ-24 §24.3 action key is written by an @Audited route (no dead filters)', () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (n.endsWith('.ts')) out.push(readFileSync(p, 'utf8'));
      }
      return out;
    };
    const src = walk(join(__dirname, '../src')).join('\n');
    const written = new Set([...src.matchAll(/action: '([a-zA-Z.]+)'/g)].map((x) => x[1]));
    expect(ALL_AUDIT_ACTIONS.filter((a) => !written.has(a))).toEqual([]);
  });

  it('filters by exact action, prefix, group, actor and date; detail shows a before/after diff; managers are refused', async () => {
    const wfh = await api().post('/api/v1/access-policy/wfh').set(auth(managerToken)).send({ telecallerUserId: telecallerId, reason: 'site visit' }).expect(201);
    await api().post(`/api/v1/access-policy/wfh/${wfh.body.data.id}/revoke`).set(auth(managerToken)).send({ reason: 'back' }).expect(201);
    await api().put('/api/v1/config/payouts.requestStaleDays').set(auth(admin)).send({ value: 21, reason: 'policy change' }).expect(200);
    const byAction = (await api().get('/api/v1/audit?action=wfh.grant').set(auth(admin)).expect(200)).body;
    expect(byAction.data).toHaveLength(1);
    expect(byAction.data[0]).toMatchObject({ action: 'wfh.grant', actor: { role: 'MANAGER' } });
    expect(byAction.meta.exportEnabled).toBe(false);
    expect((await api().get('/api/v1/audit?action=wfh.').set(auth(admin)).expect(200)).body.data.map((r: { action: string }) => r.action).sort()).toEqual(['wfh.grant', 'wfh.revoke']);
    const grp = (await api().get('/api/v1/audit?group=assignmentsAndWfh').set(auth(admin)).expect(200)).body.data.map((r: { action: string }) => r.action);
    expect(grp).toEqual(expect.arrayContaining(['wfh.grant', 'wfh.revoke']));
    expect(grp.every((a: string) => (AUDIT_ACTION_GROUPS.assignmentsAndWfh.actions as readonly string[]).includes(a))).toBe(true);
    const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    expect((await api().get(`/api/v1/audit?action=wfh.grant&from=${today}&to=${today}`).set(auth(admin)).expect(200)).body.data).toHaveLength(1);
    expect((await api().get('/api/v1/audit?action=wfh.grant&from=2020-01-01&to=2020-01-02').set(auth(admin)).expect(200)).body.data).toHaveLength(0);
    const cfg = (await api().get('/api/v1/audit?action=config.update').set(auth(admin)).expect(200)).body.data[0];
    const detail = (await api().get(`/api/v1/audit/${cfg.id}`).set(auth(admin)).expect(200)).body.data;
    expect(detail.diff.length).toBeGreaterThan(0);
    expect(detail.reason).toBe('policy change');
    // catalogue shows counts for the groups
    const cat = (await api().get('/api/v1/audit/actions').set(auth(admin)).expect(200)).body.data;
    const wfhGroup = cat.groups.find((g: { key: string }) => g.key === 'assignmentsAndWfh');
    expect(wfhGroup.actions.find((a: { action: string }) => a.action === 'wfh.grant').count).toBe(1);
    await api().get('/api/v1/audit').set(auth(managerToken)).expect(403);
    await api().get('/api/v1/audit/sensitive-access').set(auth(managerToken)).expect(403);
  });

  it('export is disabled by default and audited when KBS enables it', async () => {
    await api().get('/api/v1/audit/export').set(auth(admin)).expect(403);
    await api().put('/api/v1/config/audit.exportEnabled').set(auth(admin)).send({ value: true, reason: 'KBS approved export for audit' }).expect(200);
    const csv = await api().get('/api/v1/audit/export?group=assignmentsAndWfh').set(auth(admin)).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n')[0]).toBe('at,action,actor,actorRole,entityType,entityId,reason');
    expect(csv.text).toContain('wfh.grant');
    expect(await prisma.auditLog.count({ where: { action: 'audit.export' } })).toBe(1);
    await api().put('/api/v1/config/audit.exportEnabled').set(auth(admin)).set('idempotency-key', idem()).send({ value: false, reason: 'reset' }).expect(200);
  });
});
