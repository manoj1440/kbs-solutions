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

/** Statement that marks the current transaction as the MIS apply (required by the F-903 trigger). */
export const MIS_APPLY_SET_LOCAL = `SELECT set_config('kbs.mis_apply', 'on', true)`;

/** Minimal shape shared by the extended client and interactive transaction clients. */
interface TxCapable<Tx> {
  $transaction<R>(fn: (tx: Tx) => Promise<R>, opts?: { timeout?: number; maxWait?: number }): Promise<R>;
}
interface RawCapable {
  $executeRawUnsafe(query: string): Promise<number>;
}

/**
 * F-903: the only way to write bank-status rows. Opens an interactive transaction inside the MIS apply context and
 * sets `kbs.mis_apply = 'on'` for that transaction only, which the database trigger requires (INV-01).
 */
export function misApplyTransaction<Tx extends RawCapable, R>(client: TxCapable<Tx>, batchId: string, fn: (tx: Tx) => Promise<R>, opts?: { timeout?: number; maxWait?: number }): Promise<R> {
  return withMisApplyContext(batchId, () =>
    client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(MIS_APPLY_SET_LOCAL);
      return fn(tx);
    }, opts),
  );
}
