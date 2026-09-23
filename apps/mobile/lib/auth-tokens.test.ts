import { describe, expect, it } from 'vitest';

import { createRefresher, createTokenStore, type KeyValueStore } from './auth-tokens';

/** Persistent "secure store" that outlives app instances, plus a fake server that rotates and detects reuse. */
function world() {
  const disk = new Map<string, string>();
  const storage: KeyValueStore = {
    getItemAsync: async (k) => disk.get(k) ?? null,
    setItemAsync: async (k, v) => void disk.set(k, v),
    deleteItemAsync: async (k) => void disk.delete(k),
  };
  let n = 0;
  const live = new Set<string>(['r0']);
  const used = new Set<string>();
  let calls = 0;
  const fetch = async (_url: string, init: { body: string }) => {
    calls++;
    const { refreshToken } = JSON.parse(init.body) as { refreshToken: string };
    if (used.has(refreshToken)) {
      live.clear(); // reuse → whole family revoked
      return { ok: false, status: 401, json: async () => ({}) };
    }
    if (!live.has(refreshToken)) return { ok: false, status: 401, json: async () => ({}) };
    live.delete(refreshToken);
    used.add(refreshToken);
    n++;
    live.add(`r${n}`);
    return { ok: true, json: async () => ({ data: { accessToken: `a${n}`, refreshToken: `r${n}` } }) };
  };
  const boot = () => {
    const store = createTokenStore(storage);
    return { store, refreshOnce: createRefresher({ store, apiUrl: 'http://api', fetch }) };
  };
  return { disk, boot, calls: () => calls };
}

describe('F-802 refresh-token rotation across app restarts', () => {
  it('a rotated pair is persisted and used after a restart', async () => {
    const w = world();
    const first = w.boot();
    await first.store.set('a0', 'r0');
    expect(await first.refreshOnce()).toBe(true);
    expect(await first.store.getRefresh()).toBe('r1');

    const afterRestart = w.boot(); // new JS runtime, same secure storage
    expect(await afterRestart.store.getAccess()).toBe('a1');
    expect(await afterRestart.refreshOnce()).toBe(true);
    expect(await afterRestart.store.getRefresh()).toBe('r2');
  });

  it('concurrent 401s share one refresh call (single flight)', async () => {
    const w = world();
    const app = w.boot();
    await app.store.set('a0', 'r0');
    const results = await Promise.all([app.refreshOnce(), app.refreshOnce(), app.refreshOnce()]);
    expect(results).toEqual([true, true, true]);
    expect(w.calls()).toBe(1);
  });

  it('a refused refresh (e.g. reused token after a restore from backup) signs the user out', async () => {
    const w = world();
    const app = w.boot();
    await app.store.set('a0', 'r0');
    await app.refreshOnce();
    await app.store.set('a0', 'r0'); // stale pair resurfaces
    expect(await app.refreshOnce()).toBe(false);
    expect(await app.store.getRefresh()).toBeNull();
    expect(w.disk.size).toBe(0);
  });

  it('no network during refresh keeps the tokens (offline is not a sign-out)', async () => {
    const disk = new Map<string, string>([['kbs.access', 'a'], ['kbs.refresh', 'r']]);
    const store = createTokenStore({ getItemAsync: async (k) => disk.get(k) ?? null, setItemAsync: async (k, v) => void disk.set(k, v), deleteItemAsync: async (k) => void disk.delete(k) });
    const refreshOnce = createRefresher({ store, apiUrl: 'http://api', fetch: async () => { throw new TypeError('Network request failed'); } });
    expect(await refreshOnce()).toBe(false);
    expect(await store.getRefresh()).toBe('r');
  });
});
