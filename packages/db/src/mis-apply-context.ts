import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * INV-01 runtime guard. Bank-status tables may only be written while a MIS apply context is active.
 * `apps/api/src/mis/apply.service.ts` is the only intended caller of `withMisApplyContext`.
 */
const storage = new AsyncLocalStorage<{ misApply: true; batchId: string }>();

export function withMisApplyContext<T>(batchId: string, fn: () => Promise<T>): Promise<T> {
  // Prisma operations are lazy (executed on await), so the await must happen inside the store.
  return storage.run({ misApply: true, batchId }, async () => {
    return await fn();
  });
}

export function isInMisApplyContext(): boolean {
  return storage.getStore()?.misApply === true;
}

export function currentMisApplyBatchId(): string | null {
  return storage.getStore()?.batchId ?? null;
}
