import type { Actor } from './actor';

interface EntitlementReader {
  payoutEntitlement: { findFirst(args: { where: { leadId: string; advisorUserId: { in: string[] } }; select: { id: true } }): Promise<{ id: string } | null> };
}

/**
 * F-824: a payable item on a lead gives its payee a reason to read that lead, and the payee's Manager a reason
 * to check it before approving — even after the lead's own Advisor has moved to another team. The referral share
 * is fixed when the lead is created, so this read must not depend on who reports to whom today.
 */
export async function holdsShareOnLead(db: EntitlementReader, actor: Actor, leadId: string): Promise<boolean> {
  if (actor.role !== 'ADVISOR' && actor.role !== 'MANAGER') return false;
  const payees = actor.role === 'MANAGER' ? [actor.userId, ...actor.teamUserIds] : [actor.userId];
  return (await db.payoutEntitlement.findFirst({ where: { leadId, advisorUserId: { in: payees } }, select: { id: true } })) !== null;
}
