import type { PrismaService } from '../../infra/prisma/prisma.service';

/** The client handed to `$transaction(async (tx) => …)` on the extended Prisma client. */
export type Tx = Parameters<Parameters<PrismaService['client']['$transaction']>[0] extends (tx: infer T) => unknown ? (tx: T) => unknown : never>[0];

/** Issues the next ID card version inside a caller's transaction (used by reactivation flows). Previous versions stay revoked. */
export async function reissueIdCard(tx: Tx, userId: string) {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true, employeeCode: true } });
  const latest = await tx.officialIdCard.aggregate({ where: { userId }, _max: { version: true } });
  await tx.officialIdCard.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return tx.officialIdCard.create({ data: { userId, version: (latest._max.version ?? 0) + 1, fields: { fullName: u.fullName, employeeCode: u.employeeCode, role: 'Telecaller', issuedAt: new Date().toISOString() } } });
}
