import { createApiClient } from '@kbs/shared';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api/v1';

const ACCESS_KEY = 'kbs.access';
const REFRESH_KEY = 'kbs.refresh';

export const tokenStore = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  async set(access: string, refresh: string) {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh; returns true when the caller should retry with the new access token. */
async function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = await tokenStore.getRefresh();
      if (!refresh) return false;
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
      if (!res.ok) {
        await tokenStore.clear();
        return false;
      }
      const body = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
      await tokenStore.set(body.data.accessToken, body.data.refreshToken);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** Best-effort SSID hint for Telecallers (server never trusts it — F-301). */
let ssidHint: string | undefined;
export function setSsidHint(v: string | undefined) {
  ssidHint = v;
}

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => tokenStore.getAccess(),
  onUnauthorized: refreshOnce,
  extraHeaders: (): Record<string, string> => (ssidHint ? { 'X-Network-Ssid-Hint': ssidHint } : {}),
});
