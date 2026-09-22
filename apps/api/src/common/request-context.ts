import { AsyncLocalStorage } from 'node:async_hooks';

import type { Actor } from './actor';

export interface RequestContext {
  requestId: string;
  ip: string;
  actor?: Actor;
  /** Extra audit fields a service can attach for the interceptor (entityType/entityId/before/after/reason). */
  audit?: Record<string, unknown>;
}

const als = new AsyncLocalStorage<RequestContext>();

export const RequestContextStore = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return als.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return als.getStore();
  },
  requestId(): string | undefined {
    return als.getStore()?.requestId;
  },
  setActor(actor: Actor) {
    const s = als.getStore();
    if (s) s.actor = actor;
  },
  audit(fields: Record<string, unknown>) {
    const s = als.getStore();
    if (s) s.audit = { ...(s.audit ?? {}), ...fields };
  },
};
