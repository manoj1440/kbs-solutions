import type { Permission } from '@kbs/shared';
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

import type { Actor } from '../actor';

export const IS_PUBLIC = 'kbs:public';
/** Route needs no authentication (OTP request/verify, health, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const PERMISSION_KEY = 'kbs:permission';
/** Route requires the actor's role to hold this permission (F-102). */
export const RequirePermission = (...permissions: Permission[]) => SetMetadata(PERMISSION_KEY, permissions);

export const GATES_KEY = 'kbs:gates';
export type GateName = 'training' | 'network' | 'onboarding';
/** Route is blocked unless the named gates pass (F-111). */
export const RequireGates = (...gates: GateName[]) => SetMetadata(GATES_KEY, gates);

export const IDEMPOTENT_KEY = 'kbs:idempotent';
/** Route must carry an Idempotency-Key header; responses are replayed for 24h (F-107). */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

export const AUDIT_KEY = 'kbs:audit';
export interface AuditMeta {
  action: string;
  entityType?: string;
  /** Path to the entity id in the response data (e.g. 'id') or in params (e.g. 'params.id'). */
  entityIdFrom?: string;
}
/** Declares the audit action for a mutating route (F-103). */
export const Audited = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const req = ctx.switchToHttp().getRequest<{ actor?: Actor }>();
  if (!req.actor) throw new Error('CurrentActor used on an unauthenticated route');
  return req.actor;
});
