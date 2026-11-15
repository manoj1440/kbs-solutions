import type { Permission, Role, UserStatus } from '@kbs/shared';

/** The authenticated principal plus everything scope builders need (F-102). */
export interface Actor {
  userId: string;
  role: Role;
  status: UserStatus;
  sessionId: string;
  permissions: readonly Permission[];
  /** Manager: user ids currently reporting to them (Telecallers + Advisors). Others: []. */
  teamUserIds: string[];
  /**
   * F-824: for an Advisor, the Advisors who signed up with their Agent Code (one level). Kept apart from `teamUserIds`
   * on purpose: it grants read access to those Advisors' leads and nothing else.
   */
  referralUserIds: string[];
  /** Current reporting parent (Manager or Admin) or null. */
  reportingParentUserId: string | null;
}
