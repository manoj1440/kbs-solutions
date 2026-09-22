import { randomUUID } from 'node:crypto';

import { seed } from '@kbs/db/seed';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/infra/prisma/prisma.service';

export const ADMIN_MOBILE = '9999999999';

export async function bootTestApp(): Promise<{ app: INestApplication; prisma: PrismaService['client'] }> {
  const url = process.env.DATABASE_URL as string;
  await seed(url, { ...process.env, BOOTSTRAP_ADMIN_MOBILE: ADMIN_MOBILE, BOOTSTRAP_ADMIN_NAME: 'Test Admin' });
  const app = await createApp();
  await app.init();
  const prisma = app.get(PrismaService).client;
  return { app, prisma };
}

/** Logs a user in through the real OTP flow using the dev master code. Clears cooldown rows first (test-only). */
export async function loginAs(app: INestApplication, prisma: PrismaService['client'], mobile: string, platform: 'ANDROID' | 'WEB' = 'ANDROID') {
  await prisma.otpChallenge.deleteMany({ where: { mobile: `+91${mobile}` } });
  const req = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ mobile, purpose: 'LOGIN' }).expect(201);
  const verify = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .send({ challengeId: req.body.data.challengeId, code: '000000', platform })
    .expect(201);
  return verify.body.data as { accessToken: string; refreshToken: string; user: { id: string; role: string }; gates: Record<string, unknown> };
}

export const idem = () => randomUUID();

export function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

/** Creates a Manager (via Admin) and a Telecaller (via that Manager); returns tokens + ids. */
export async function setupManagerAndTelecaller(app: INestApplication, prisma: PrismaService['client'], suffix: string) {
  const admin = await loginAs(app, prisma, ADMIN_MOBILE);
  const managerMobile = `98765${suffix.padStart(5, '0')}`;
  const telecallerMobile = `97765${suffix.padStart(5, '0')}`;
  const m = await request(app.getHttpServer())
    .post('/api/v1/users')
    .set(auth(admin.accessToken))
    .set('idempotency-key', idem())
    .send({ role: 'MANAGER', fullName: `Manager ${suffix}`, mobile: managerMobile })
    .expect(201);
  const manager = await loginAs(app, prisma, managerMobile);
  const t = await request(app.getHttpServer())
    .post('/api/v1/telecallers')
    .set(auth(manager.accessToken))
    .set('idempotency-key', idem())
    .send({ fullName: `Telecaller ${suffix}`, mobile: telecallerMobile })
    .expect(201);
  return { admin, manager, managerId: m.body.data.id as string, telecallerId: t.body.data.id as string, telecallerMobile, managerMobile };
}

/** Wipes mutable tables so each run starts clean (seed rows are recreated by bootTestApp). */
export async function resetDatabase(url: string) {
  const { createPrismaClient } = await import('@kbs/db');
  const prisma = createPrismaClient({ connectionString: url, log: ['error'] });
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "AuditLog","SensitiveAccessLog","IdempotencyRecord","OtpChallenge","RefreshToken","Session",
        "NetworkAccessEvent","WfhException","OfficeNetwork","TrainingReactivation","TrainingAttempt","TrainingModuleResult",
        "TrainingEnrollment","AllocationEvent","CallingRecord","CustomerImportBatch","ContactSuppression","PincodeMaster","Notification","StoredFile","BankPincodeRow","BankPincodeBatch","BankPincodeProfile","ApplicationLink","ProductCodeCrosswalk","CreditCardCategory","OfficialIdCard","ReportingAssignment","AgentCode","UserLifecycleEvent","SystemConfigHistory","SystemConfig","Lead","LeadDraft","CreditCard","User"
      CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}
