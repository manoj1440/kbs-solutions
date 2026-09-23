import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { AccessPolicyService } from '../src/modules/access-policy/access-policy.service';
import { ConfigService } from '../src/modules/config/config.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('core foundation (F-101…F-111)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('health reports db and redis', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.data).toMatchObject({ status: 'ok', db: true });
    expect(res.body.meta.requestId).toBeTruthy();
  });

  describe('AUTH-01 / AUTH-02', () => {
    it('AUTH-01: Admin logs in with mobile + OTP and receives gates + permissions; no password route exists', async () => {
      const s = await loginAs(app, prisma, ADMIN_MOBILE);
      expect(s.user.role).toBe('ADMIN');
      expect(s.gates).toMatchObject({ account: { active: true }, training: { required: false }, network: { required: false } });
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ mobile: ADMIN_MOBILE, password: 'x' }).expect(404);
    });

    it('AUTH-02: unknown mobile gets the same response shape; wrong code is rejected; resend cooldown enforced', async () => {
      const unknown = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile: '9111111111' }).expect(201);
      expect(Object.keys(unknown.body.data).sort()).toEqual(['challengeId', 'expiresInSec', 'resendAfterSec']);
      const phantom = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: unknown.body.data.challengeId, code: '000000', platform: 'ANDROID' })
        .expect(400);
      expect(phantom.body.error.code).toBe('AUTH_OTP_INVALID');
      const again = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile: '9111111111' }).expect(429);
      expect(again.body.error.code).toBe('AUTH_OTP_RESEND_TOO_SOON');
    });

    it('AUTH-02: five wrong codes lock the mobile', async () => {
      await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${ADMIN_MOBILE}` } });
      const req = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile: ADMIN_MOBILE }).expect(201);
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/otp/verify')
          .send({ challengeId: req.body.data.challengeId, code: '123456', platform: 'ANDROID' })
          .expect(400);
      }
      const locked = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'ANDROID' })
        .expect(429);
      expect(locked.body.error.code).toBe('AUTH_OTP_LOCKED');
      await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${ADMIN_MOBILE}` } });
    });

    it('refresh rotation: reuse of a consumed refresh token revokes the session family', async () => {
      const s = await loginAs(app, prisma, ADMIN_MOBILE);
      const first = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(201);
      expect(first.body.data.accessToken).toBeTruthy();
      const reuse = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
      expect(reuse.body.error.code).toBe('AUTH_SESSION_REVOKED');
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken: first.body.data.refreshToken }).expect(401);
    });

    it('web login sets httpOnly cookies; a Telecaller is refused on the web platform', async () => {
      await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${ADMIN_MOBILE}` } });
      const req = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile: ADMIN_MOBILE }).expect(201);
      const verify = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'WEB' })
        .expect(201);
      const cookies = verify.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('kbs_access=') && /HttpOnly/i.test(c))).toBe(true);
      expect(verify.body.data.accessToken).toBeUndefined();
      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies).expect(200);
      expect(me.body.data.user.role).toBe('ADMIN');

      const { telecallerMobile } = await setupManagerAndTelecaller(app, prisma, '9');
      await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${telecallerMobile}` } });
      const treq = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile: telecallerMobile }).expect(201);
      const refused = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: treq.body.data.challengeId, code: '000000', platform: 'WEB' })
        .expect(403);
      expect(refused.body.error.code).toBe('AUTH_PLATFORM_NOT_ALLOWED');
    });

    it('F-804 AUTH-01: web session continuity — cookie-only refresh re-issues cookies (no tokens in body); /auth/me carries account facts; revoked refresh fails with LOGIN_AGAIN', async () => {
      await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${ADMIN_MOBILE}` } });
      await prisma.systemConfig.update({ where: { key: 'support.contact' }, data: { value: 'support@kbs.example' } }).catch(() => undefined);
      const req = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile: ADMIN_MOBILE }).expect(201);
      const verify = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ challengeId: req.body.data.challengeId, code: '000000', platform: 'WEB' }).expect(201);
      const cookies = verify.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies.find((c) => c.startsWith('kbs_refresh='))!.split(';')[0];
      expect(cookies.find((c) => c.startsWith('kbs_refresh='))).toMatch(/Path=\/api\/v1\/auth/);
      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies).expect(200);
      expect(me.body.data.account).toMatchObject({ accessExpiresInSec: 900 });
      expect(me.body.data.account).toHaveProperty('supportContact');
      expect(me.body.data.account).toHaveProperty('lastLoginAt');
      // the browser only has the refresh cookie (access cookie expired): refresh sets new cookies, body has no tokens
      const r = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', refreshCookie).send({}).expect(201);
      expect(r.body.data.accessToken).toBeUndefined();
      expect(r.body.data.refreshToken).toBeUndefined();
      const renewed = r.headers['set-cookie'] as unknown as string[];
      expect(renewed.some((c) => c.startsWith('kbs_access='))).toBe(true);
      await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', renewed).expect(200);
      // sign out of all devices → the refresh cookie no longer works (the /session hop sends the user to login)
      await request(app.getHttpServer()).post('/api/v1/auth/logout-all').set('Cookie', renewed).expect(201);
      const dead = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', renewed.find((c) => c.startsWith('kbs_refresh='))!.split(';')[0]).send({}).expect(401);
      expect(dead.body.error.recovery).toBe('LOGIN_AGAIN');
    });
  });

  describe('RBAC-01 / RBAC-02 / TRAIN-01 / TRAIN-02', () => {
    it('TRAIN-01: only a Manager creates a Telecaller; employee code + reporting parent set; Admin is refused', async () => {
      const { admin, manager, telecallerId } = await setupManagerAndTelecaller(app, prisma, '1');
      const refused = await request(app.getHttpServer())
        .post('/api/v1/telecallers')
        .set(auth(admin.accessToken))
        .set('idempotency-key', idem())
        .send({ fullName: 'X', mobile: '9777700009' })
        .expect(403);
      expect(refused.body.error.code).toBe('RBAC_FORBIDDEN');
      const tc = await request(app.getHttpServer()).get(`/api/v1/users/${telecallerId}`).set(auth(manager.accessToken)).expect(200);
      expect(tc.body.data.employeeCode).toMatch(/^KBS-TC-/);
      expect(tc.body.data.reportingParent.id).toBe(manager.user.id);
    });

    it('TRAIN-02: first Telecaller login fixes one 72h deadline; a second login does not reset it', async () => {
      const { telecallerMobile, telecallerId } = await setupManagerAndTelecaller(app, prisma, '2');
      const first = await loginAs(app, prisma, telecallerMobile);
      expect(first.gates.training).toMatchObject({ required: true, passed: false, currentModuleSequence: 1 });
      const e1 = await prisma.trainingEnrollment.findUniqueOrThrow({ where: { telecallerUserId: telecallerId } });
      expect(e1.deadlineAt!.getTime() - e1.firstLoginAt!.getTime()).toBe(72 * 3_600_000);
      await loginAs(app, prisma, telecallerMobile);
      const e2 = await prisma.trainingEnrollment.findUniqueOrThrow({ where: { telecallerUserId: telecallerId } });
      expect(e2.firstLoginAt).toEqual(e1.firstLoginAt);
      expect(e2.deadlineAt).toEqual(e1.deadlineAt);
    });

    it('RBAC-01: Manager sees only own team; another Manager gets NOT_FOUND for that Telecaller (RBAC-02 shape)', async () => {
      const a = await setupManagerAndTelecaller(app, prisma, '3');
      const b = await setupManagerAndTelecaller(app, prisma, '4');
      const list = await request(app.getHttpServer()).get('/api/v1/users').set(auth(a.manager.accessToken)).expect(200);
      const ids = list.body.data.map((u: { id: string }) => u.id);
      expect(ids).toContain(a.telecallerId);
      expect(ids).not.toContain(b.telecallerId);
      const other = await request(app.getHttpServer()).get(`/api/v1/users/${b.telecallerId}`).set(auth(a.manager.accessToken)).expect(404);
      expect(other.body.error.code).toBe('NOT_FOUND');
      const cross = await request(app.getHttpServer())
        .post(`/api/v1/users/${b.telecallerId}/deactivate`)
        .set(auth(a.manager.accessToken))
        .send({ reason: 'nope' })
        .expect(404);
      expect(cross.body.error.code).toBe('NOT_FOUND');
    });

    it('a Telecaller cannot list users (permission matrix) and a deactivated user loses access immediately', async () => {
      const { manager, telecallerMobile, telecallerId } = await setupManagerAndTelecaller(app, prisma, '5');
      const t = await loginAs(app, prisma, telecallerMobile);
      await request(app.getHttpServer()).get('/api/v1/users').set(auth(t.accessToken)).expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/users/${telecallerId}/deactivate`)
        .set(auth(manager.accessToken))
        .send({ reason: 'left the company' })
        .expect(201);
      const denied = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(t.accessToken)).expect(401);
      expect(['AUTH_SESSION_REVOKED', 'AUTH_ACCOUNT_DEACTIVATED']).toContain(denied.body.error.code);
      const events = await prisma.userLifecycleEvent.findMany({ where: { userId: telecallerId } });
      expect(events.map((e) => e.eventType)).toEqual(expect.arrayContaining(['CREATED', 'DEACTIVATED']));
    });
  });

  describe('F-107 idempotency, F-104 config, F-103 audit', () => {
    it('same Idempotency-Key replays the first response; missing key is rejected', async () => {
      const admin = await loginAs(app, prisma, ADMIN_MOBILE);
      const key = idem();
      const body = { role: 'ACCOUNTS', fullName: 'Acc One', mobile: '9666600001' };
      const r1 = await request(app.getHttpServer()).post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', key).send(body).expect(201);
      const r2 = await request(app.getHttpServer()).post('/api/v1/users').set(auth(admin.accessToken)).set('idempotency-key', key).send(body).expect(201);
      expect(r2.body.data.id).toBe(r1.body.data.id);
      expect(r2.body.meta.idempotentReplay).toBe(true);
      expect(await prisma.user.count({ where: { mobile: '+919666600001' } })).toBe(1);
      const missing = await request(app.getHttpServer()).post('/api/v1/users').set(auth(admin.accessToken)).send(body).expect(400);
      expect(missing.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('config update needs a reason, writes history + audit, and launch gates list unset ★ keys', async () => {
      const admin = await loginAs(app, prisma, ADMIN_MOBILE);
      await request(app.getHttpServer()).put('/api/v1/config/training.windowHours').set(auth(admin.accessToken)).send({ value: 48 }).expect(400);
      await request(app.getHttpServer()).put('/api/v1/config/training.windowHours').set(auth(admin.accessToken)).send({ value: 48, reason: 'pilot' }).expect(200);
      const hist = await request(app.getHttpServer()).get('/api/v1/config/training.windowHours/history').set(auth(admin.accessToken)).expect(200);
      expect(hist.body.data[0]).toMatchObject({ newValue: 48, reason: 'pilot' });
      const gates = await request(app.getHttpServer()).get('/api/v1/config/launch-gates').set(auth(admin.accessToken)).expect(200);
      const designated = gates.body.data.find((g: { key: string }) => g.key === 'payouts.designatedApproverManagerUserId');
      expect(designated.isSet).toBe(false);
      const audit = await request(app.getHttpServer()).get('/api/v1/audit?action=config.update').set(auth(admin.accessToken)).expect(200);
      expect(audit.body.data.length).toBeGreaterThan(0);
      await request(app.getHttpServer()).put('/api/v1/config/training.windowHours').set(auth(admin.accessToken)).send({ value: 72, reason: 'restore' }).expect(200);
    });

    it('AUDIT-01: user creation and deactivation leave audit rows with actor and requestId', async () => {
      const admin = await loginAs(app, prisma, ADMIN_MOBILE);
      const rows = await prisma.auditLog.findMany({ where: { action: { in: ['users.create', 'users.deactivate', 'telecallers.create'] } } });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.requestId && r.actorUserId)).toBe(true);
      expect(rows.some((r) => r.actorUserId === admin.user.id)).toBe(true);
    });
  });

  describe('F-111 gates / F-301 network policy (SEC-01 server side)', () => {
    it('Telecaller outside the allowlist is DENIED; WFH exception allows; Advisor never gated', async () => {
      const { admin, manager, telecallerId } = await setupManagerAndTelecaller(app, prisma, '6');
      const net = await request(app.getHttpServer())
        .post('/api/v1/access-policy/networks')
        .set(auth(admin.accessToken))
        .send({ label: 'HQ', cidr: '203.0.113.0/24', reason: 'office egress' })
        .expect(201);
      await app.get(ConfigService).reload();
      const svc = app.get(AccessPolicyService);
      expect(await svc.evaluate({ userId: telecallerId, role: 'TELECALLER' }, '198.51.100.7')).toMatchObject({ allowed: false, reason: 'OUTSIDE_OFFICE_NETWORK' });
      expect(await svc.evaluate({ userId: telecallerId, role: 'TELECALLER' }, '203.0.113.42')).toMatchObject({ allowed: true, reason: 'OFFICE_MATCH' });
      expect(await svc.evaluate({ userId: 'any', role: 'ADVISOR' }, '198.51.100.7')).toMatchObject({ required: false, allowed: true });
      const wfh = await request(app.getHttpServer())
        .post('/api/v1/access-policy/wfh')
        .set(auth(manager.accessToken))
        .send({ telecallerUserId: telecallerId, reason: 'field visit' })
        .expect(201);
      expect(await svc.evaluate({ userId: telecallerId, role: 'TELECALLER' }, '198.51.100.7')).toMatchObject({ allowed: true, reason: 'WFH_ACTIVE' });
      await request(app.getHttpServer()).post(`/api/v1/access-policy/wfh/${wfh.body.data.id}/revoke`).set(auth(manager.accessToken)).send({ reason: 'back' }).expect(201);
      expect(await svc.evaluate({ userId: telecallerId, role: 'TELECALLER' }, '198.51.100.7')).toMatchObject({ allowed: false });
      await request(app.getHttpServer())
        .post(`/api/v1/access-policy/networks/${net.body.data.id}/active`)
        .set(auth(admin.accessToken))
        .send({ active: false, reason: 'cleanup' })
        .expect(201);
    });

    it('empty allowlist fails closed for Telecallers (network.allowEmptyAllowlist=false)', async () => {
      const { telecallerId } = await setupManagerAndTelecaller(app, prisma, '8');
      const svc = app.get(AccessPolicyService);
      expect(await svc.evaluate({ userId: telecallerId, role: 'TELECALLER' }, '203.0.113.42')).toMatchObject({ allowed: false, reason: 'ALLOWLIST_EMPTY' });
    });

    it('lazy training gate: a Telecaller whose deadline has passed is blocked even though no sweep job ran', async () => {
      const { telecallerMobile, telecallerId } = await setupManagerAndTelecaller(app, prisma, '7');
      const t = await loginAs(app, prisma, telecallerMobile);
      await prisma.trainingEnrollment.update({ where: { telecallerUserId: telecallerId }, data: { deadlineAt: new Date(Date.now() - 1000) } });
      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth(t.accessToken)).expect(200);
      expect(me.body.data.gates.training).toMatchObject({ passed: false, reason: 'DEADLINE_PASSED', status: 'EXPIRED_DEACTIVATED' });
    });
  });
});
