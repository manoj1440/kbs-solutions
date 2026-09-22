import type { Gates, MeResponse, UserSummary } from '@kbs/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { api, tokenStore } from './api';

interface SessionState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: UserSummary | null;
  gates: Gates | null;
  permissions: string[];
  refresh: () => Promise<void>;
  signIn: (access: string, refresh: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

/** F-802: session + gates provider. Gates are re-fetched on foreground so server-side changes apply promptly. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);

  const refresh = useCallback(async () => {
    const access = await tokenStore.getAccess();
    if (!access) {
      setMe(null);
      setStatus('signed-out');
      return;
    }
    try {
      const r = await api.get<MeResponse>('/auth/me');
      setMe(r.data);
      setStatus('signed-in');
    } catch {
      await tokenStore.clear();
      setMe(null);
      setStatus('signed-out');
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

  const value = useMemo<SessionState>(
    () => ({
      status,
      user: me?.user ?? null,
      gates: me?.gates ?? null,
      permissions: me?.permissions ?? [],
      refresh,
      signIn: async (access, refreshToken) => {
        await tokenStore.set(access, refreshToken);
        await refresh();
      },
      signOut: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        await tokenStore.clear();
        setMe(null);
        setStatus('signed-out');
      },
    }),
    [status, me, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export { routeFor } from './routing';
