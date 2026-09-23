/**
 * F-802: token persistence + single-flight refresh, independent of Expo so it can be unit-tested. `api.ts` wires it to
 * `expo-secure-store` and `fetch`. Tokens live only in secure storage, so a refreshed (rotated) pair survives an app
 * restart; a refused refresh (expired, revoked, or a reused token — the server revokes the family) clears storage.
 */
export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const ACCESS_KEY = 'kbs.access';
const REFRESH_KEY = 'kbs.refresh';

export function createTokenStore(storage: KeyValueStore) {
  return {
    getAccess: () => storage.getItemAsync(ACCESS_KEY),
    getRefresh: () => storage.getItemAsync(REFRESH_KEY),
    async set(access: string, refresh: string) {
      await storage.setItemAsync(ACCESS_KEY, access);
      await storage.setItemAsync(REFRESH_KEY, refresh);
    },
    async clear() {
      await storage.deleteItemAsync(ACCESS_KEY);
      await storage.deleteItemAsync(REFRESH_KEY);
    },
  };
}
export type TokenStore = ReturnType<typeof createTokenStore>;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

/** Returns `refreshOnce()`: concurrent 401s share one refresh call; resolves true when the caller should retry. */
export function createRefresher(opts: { store: TokenStore; apiUrl: string; fetch: FetchLike }) {
  let inflight: Promise<boolean> | null = null;
  return function refreshOnce(): Promise<boolean> {
    if (!inflight) {
      inflight = (async () => {
        const refresh = await opts.store.getRefresh();
        if (!refresh) return false;
        let res: Awaited<ReturnType<FetchLike>>;
        try {
          res = await opts.fetch(`${opts.apiUrl}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
        } catch {
          return false; // offline: keep the tokens, the caller shows its error / offline banner
        }
        if (!res.ok) {
          await opts.store.clear();
          return false;
        }
        const body = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
        await opts.store.set(body.data.accessToken, body.data.refreshToken);
        return true;
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}
