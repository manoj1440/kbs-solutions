import { makePublicRef, RefPrefix } from '@kbs/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BankStatusWriteForbiddenError, createPrismaClient, misApplyTransaction, withMisApplyContext } from '../src';
import { seed } from '../src/seed';

const url = process.env.DATABASE_URL;
const run = url ? describe : describe.skip;

run('database invariants', () => {
  const prisma = createPrismaClient({ connectionString: url as string, log: ['error'] });
  let adminId: string;
  let bankId: string;

  beforeAll(async () => {
    await seed(url as string, { ...process.env, BOOTSTRAP_ADMIN_MOBILE: process.env.BOOTSTRAP_ADMIN_MOBILE ?? '9999999999' });
    adminId = (await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })).id;
    bankId = (await prisma.bank.findFirstOrThrow({ where: { code: 'HDFC' } })).id;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('INV-01: bank status tables reject writes outside the MIS apply context', async () => {
    await expect(
      prisma.bankStatusHistory.create({
        data: { leadId: 'x', batchId: 'y', field: 'f', importedAt: new Date(), uploaderUserId: adminId, changeKind: 'SET' },
      }),
    ).rejects.toBeInstanceOf(BankStatusWriteForbiddenError);
    await expect(prisma.bankStatusSnapshot.deleteMany({})).rejects.toBeInstanceOf(BankStatusWriteForbiddenError);
  });

  it('INV-01: inside withMisApplyContext the guard lets the write reach the database', async () => {
    // FK will fail (no such lead) — proving the extension guard was passed and Postgres was hit.
    await expect(
      withMisApplyContext('batch-test', () =>
        prisma.bankStatusHistory.create({
          data: { leadId: 'x', batchId: 'y', field: 'f', importedAt: new Date(), uploaderUserId: adminId, changeKind: 'SET' },
        }),
      ),
    ).rejects.not.toBeInstanceOf(BankStatusWriteForbiddenError);
  });

  it('F-903: the database itself rejects bank-status writes that bypass the MIS apply transaction (raw SQL too)', async () => {
    // raw SQL skips the Prisma extension — the trigger still refuses
    await expect(prisma.$executeRawUnsafe(`UPDATE "BankStatusSnapshot" SET "finalDecision" = 'Approve'`)).resolves.toBe(0); // no rows: trigger is row-level
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "BankStatusHistory" (id, "leadId", "batchId", field, "changeKind", "importedAt", "uploaderUserId") VALUES ('h1', 'x', 'y', 'f', 'SET', now(), '${adminId}')`)).rejects.toThrow(/INV-01/);
    // the app-level context alone is not enough: the transaction must declare kbs.mis_apply
    await expect(withMisApplyContext('b', () => prisma.bankStatusHistory.create({ data: { leadId: 'x', batchId: 'y', field: 'f', importedAt: new Date(), uploaderUserId: adminId, changeKind: 'SET' } }))).rejects.toThrow(/INV-01/);
    // inside misApplyTransaction the trigger passes and Postgres reaches the FK check (no such lead)
    const err = await misApplyTransaction(prisma, 'b', (tx) => tx.bankStatusHistory.create({ data: { leadId: 'x', batchId: 'y', field: 'f', importedAt: new Date(), uploaderUserId: adminId, changeKind: 'SET' } })).catch((e: Error) => e);
    expect(String((err as Error).message)).toMatch(/Foreign key constraint/); // (Prisma error text quotes nearby source lines, so assert the positive reason)
    // the flag is transaction-local: it does not leak to the next statement
    expect(await prisma.$queryRawUnsafe<{ v: string | null }[]>(`SELECT current_setting('kbs.mis_apply', true) AS v`)).toEqual([{ v: expect.not.stringMatching(/^on$/) }]);
  });

  it('ADR-011: a second ADMIN is rejected by the partial unique index', async () => {
    await expect(
      prisma.user.create({
        data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919888888888', role: 'ADMIN', fullName: 'Second Admin' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('seed is idempotent and payout rules stay empty (REQ-28 §28.2)', async () => {
    const before = await prisma.systemConfig.count();
    await seed(url as string);
    expect(await prisma.systemConfig.count()).toBe(before);
    expect(await prisma.payoutRule.count()).toBe(0);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('HDFC MIS profile maps all 36 exact headers incl. misspellings (REQ-13 §13.2)', async () => {
    const p = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId, version: 1 } });
    const map = p.fieldMap as Record<string, string>;
    expect(Object.keys(map)).toHaveLength(36);
    expect(map.cardActivationStatus).toBe('Card Activation Staus');
    expect(map.declineDescription2).toBe('Decline Descreption');
    expect(p.status).toBe('DRAFT');
  });
});
