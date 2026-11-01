import { createApiClient } from '@kbs/shared';
import * as SecureStore from './secure-store';

import { createRefresher, createTokenStore } from './auth-tokens';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api/v1';

export const tokenStore = createTokenStore(SecureStore);

/** Single-flight refresh; returns true when the caller should retry with the new access token. */
const refreshOnce = createRefresher({
  store: tokenStore,
  apiUrl: API_URL,
  fetch: (url, init) => fetch(url, init),
});

/** Best-effort network hint for Telecallers (server never trusts it — F-301). */
let ssidHint: string | undefined;
export function setSsidHint(v: string | undefined) {
  ssidHint = v;
}

/** Fired when the server refused the refresh (session revoked: new login elsewhere, deactivation, expiry) and tokens were cleared. */
const sessionEndedListeners = new Set<() => void>();
export function onSessionEnded(fn: () => void) {
  sessionEndedListeners.add(fn);
  return () => {
    sessionEndedListeners.delete(fn);
  };
}

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => tokenStore.getAccess(),
  onUnauthorized: async () => {
    const retry = await refreshOnce();
    // offline keeps the tokens; only a refused refresh clears them → back to the login screen instead of an error card
    if (!retry && !(await tokenStore.getRefresh())) sessionEndedListeners.forEach((fn) => fn());
    return retry;
  },
  extraHeaders: (): Record<string, string> => (ssidHint ? { 'X-Network-Ssid-Hint': ssidHint } : {}),
});
