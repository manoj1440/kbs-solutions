import { ApiClientError, type Gates, type MeResponse, type UserSummary } from '@kbs/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { checkDeviceIntegrity } from '@/lib/device-integrity';
import { onPushTap, registerForPush } from '@/lib/push';

import { api, onSessionEnded, tokenStore } from './api';

interface SessionState {
  status: 'loading' | 'signed-out' | 'signed-in';
  /** The session could not be checked (offline / server error) and nothing is loaded yet: show a retry, never sign out. */
  unreachable: boolean;
  user: UserSummary | null;
  gates: Gates | null;
  permissions: string[];
  /** F-302: warning shown when the device looks rooted (never blocks). */
  deviceWarning: string | null;
  refresh: () => Promise<void>;
  signIn: (access: string, refresh: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

/** F-802: session + gates provider. Gates are re-fetched on foreground so server-side changes apply promptly. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const refresh = useCallback(async () => {
    const access = await tokenStore.getAccess();
    if (!access) {
      setMe(null);
      setUnreachable(false);
      setStatus('signed-out');
      return;
    }
    try {
      const r = await api.get<MeResponse>('/auth/me');
      setMe(r.data);
      setUnreachable(false);
      setStatus('signed-in');
    } catch (e) {
      // only a refused session (401 after the refresh attempt) signs out
      if (e instanceof ApiClientError && e.status === 401) {
        await tokenStore.clear();
        setMe(null);
        setUnreachable(false);
        setStatus('signed-out');
        return;
      }
      // offline / server error: keep the tokens and whatever is loaded; with nothing loaded yet the entry screen offers a retry
      setUnreachable(true);
      setStatus((s) => (s === 'signed-in' ? s : 'loading'));
    }
  }, []);

  useEffect(() => {
    // Initial load + re-check on foreground (async → not a synchronous setState in the effect body).
    const load = () => {
      void refresh();
    };
    const timer = setTimeout(load, 0);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [refresh]);

  // a revoked session (e.g. this Telecaller signed in on another phone) returns to the login screen
  useEffect(
    () =>
      onSessionEnded(() => {
        setMe(null);
        setUnreachable(false);
        setStatus('signed-out');
      }),
    [],
  );

  // F-302: one integrity report per signed-in app session
  const userId = me?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void checkDeviceIntegrity().then((w) => {
      if (live) setDeviceWarning(w);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  // F-701: tapping a push opens this role's notification centre
  const role = me?.user?.role;
  useEffect(() => onPushTap(role), [role]);

  const value = useMemo<SessionState>(
    () => ({
      status,
      unreachable,
      user: me?.user ?? null,
      gates: me?.gates ?? null,
      permissions: me?.permissions ?? [],
      deviceWarning,
      refresh,
      signIn: async (access, refreshToken) => {
        await tokenStore.set(access, refreshToken);
        await refresh();
        void registerForPush(); // F-701: best effort, never blocks sign-in
      },
      signOut: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        await tokenStore.clear();
        setMe(null);
        setDeviceWarning(null);
        setUnreachable(false);
        setStatus('signed-out');
      },
    }),
    [status, unreachable, me, refresh, deviceWarning],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export { routeFor } from './routing';
