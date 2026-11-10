import type { PrismaService } from '../../infra/prisma/prisma.service';

/** Cards and MIS are bank-independent in the product (user decision); one hidden internal bank keeps the bank-keyed tables consistent. */
export const DEFAULT_BANK_CODE = 'KBS';

export async function defaultBankId(prisma: PrismaService['client']): Promise<string> {
  const b = await prisma.bank.upsert({ where: { code: DEFAULT_BANK_CODE }, update: {}, create: { code: DEFAULT_BANK_CODE, displayName: 'KBS' }, select: { id: true } });
  return b.id;
}

/** Name to show for a bank: empty for the hidden internal bank, so "bank card" text never prints it. */
export const visibleBankName = (b: { code: string; displayName: string }): string => (b.code === DEFAULT_BANK_CODE ? '' : b.displayName);

/** "<bank> <text>" without the hidden internal bank. */
export const withVisibleBank = (b: { code: string; displayName: string }, text: string): string => [visibleBankName(b), text].filter(Boolean).join(' ');
