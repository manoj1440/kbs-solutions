import type { PrismaService } from '../../infra/prisma/prisma.service';

/** Cards and MIS are bank-independent in the product (user decision); one hidden internal bank keeps the bank-keyed tables consistent. */
export const DEFAULT_BANK_CODE = 'KBS';

export async function defaultBankId(prisma: PrismaService['client']): Promise<string> {
  const b = await prisma.bank.upsert({ where: { code: DEFAULT_BANK_CODE }, update: {}, create: { code: DEFAULT_BANK_CODE, displayName: 'KBS' }, select: { id: true } });
  return b.id;
}
