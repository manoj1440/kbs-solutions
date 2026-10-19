import { type AppVersionPolicy, type AppVersionResponse, appUpdateState } from '@kbs/shared';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  Text as RNText,
  View,
} from 'react-native';

import { LogoMark } from '@/components/auth';
import { Button, Muted } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { colors } from '@/lib/theme';

/**
 * F-819 app updates, wrapped around the whole app (root layout).
 *
 * OTA (expo-updates, JS-only changes): on launch, check → download → restart into the update right away (no "applies
 * next time"); offline / slow (> LAUNCH_WAIT_MS) opens the app normally and a late download asks for a restart. On
 * returning to the foreground, check again (at most every RESUME_EVERY_MS) and, when ready, require a restart.
 *
 * Native (new APK / App Store build): Admin sets `app.<platform>.minVersion|latestVersion|downloadUrl`; below min the
 * app is blocked with "Update required", below latest it offers the update once per session.
 */
const LAUNCH_WAIT_MS = 10_000;
const RESUME_EVERY_MS = 15 * 60_000;
const POLICY_TIMEOUT_MS = 6_000;

type Phase = 'checking' | 'downloading' | 'idle';
const otaEnabled = Updates.isEnabled && !__DEV__;
const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;

async function fetchPolicy(): Promise<AppVersionPolicy | null> {
  if (!platform) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), POLICY_TIMEOUT_MS);
  try {
    const r = await fetch(`${API_URL}/app/version`, { signal: ctl.signal });
    if (!r.ok) return null;
    const body = (await r.json()) as { data?: AppVersionResponse };
    return body.data?.[platform] ?? null;
  } catch {
    return null; // offline / server down: never block on our own policy endpoint
  } finally {
    clearTimeout(t);
  }
}

export function UpdateGate({ children }: PropsWithChildren) {
  const [phase, setPhase] = useState<Phase>(otaEnabled ? 'checking' : 'idle');
  const phaseRef = useRef(phase);
  const [restartReady, setRestartReady] = useState(false);
  const [policy, setPolicy] = useState<AppVersionPolicy | null>(null);
  const [laterChosen, setLaterChosen] = useState(false);
  const lastCheck = useRef(0);

  const enterPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const runOta = useCallback(
    async (launch: boolean) => {
      if (!otaEnabled) return;
      lastCheck.current = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) {
          if (launch) enterPhase('idle');
          return;
        }
        if (launch && phaseRef.current === 'checking') enterPhase('downloading');
        const fetched = await Updates.fetchUpdateAsync();
        if (!fetched.isNew && !fetched.isRollBackToEmbedded) {
          if (launch) enterPhase('idle');
          return;
        }
        // still on the launch screen → switch now; otherwise the user is in the app → ask (cannot be dismissed)
        if (launch && phaseRef.current !== 'idle') await Updates.reloadAsync();
        else setRestartReady(true);
      } catch {
        if (launch) enterPhase('idle');
      }
    },
    [enterPhase],
  );

  useEffect(() => {
    const start = setTimeout(() => {
      void runOta(true);
      void fetchPolicy().then(setPolicy);
    }, 0);
    const giveUp = setTimeout(() => {
      if (phaseRef.current !== 'idle') enterPhase('idle');
    }, LAUNCH_WAIT_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void fetchPolicy().then(setPolicy);
      if (Date.now() - lastCheck.current >= RESUME_EVERY_MS) void runOta(false);
    });
    return () => {
      clearTimeout(start);
      clearTimeout(giveUp);
      sub.remove();
    };
  }, [runOta, enterPhase]);

  const state = appUpdateState(currentVersion, policy);
  const download = () => {
    if (policy?.downloadUrl) void Linking.openURL(policy.downloadUrl);
  };

  if (state === 'required') {
    return (
      <UpdateScreen
        title="Update required"
        body={`This version (${currentVersion}) is no longer supported. Install version ${policy?.minVersion} or newer to continue.`}
      >
        {policy?.downloadUrl ? (
          <Button title="Download update" size="lg" icon="download-outline" onPress={download} />
        ) : (
          <Muted className="text-center">Ask your KBS administrator for the new version.</Muted>
        )}
      </UpdateScreen>
    );
  }
  if (phase !== 'idle') {
    return (
      <UpdateScreen title={phase === 'downloading' ? 'Updating KBS Solutions…' : 'Starting…'}>
        <ActivityIndicator color={colors.orange} />
      </UpdateScreen>
    );
  }
  return (
    <>
      {children}
      <Modal
        visible={restartReady}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <Prompt
          title="Update ready"
          body="A new version of the app has been downloaded. Restart to use it."
        >
          <Button
            title="Restart now"
            size="lg"
            icon="refresh"
            onPress={() => void Updates.reloadAsync()}
          />
        </Prompt>
      </Modal>
      <Modal
        visible={
          !restartReady && state === 'available' && !laterChosen && Boolean(policy?.downloadUrl)
        }
        transparent
        animationType="fade"
        onRequestClose={() => setLaterChosen(true)}
      >
        <Prompt
          title="New version available"
          body={`Version ${policy?.latestVersion} is available (you have ${currentVersion}).`}
        >
          <Button title="Update" size="lg" icon="download-outline" onPress={download} />
          <Button title="Later" variant="ghost" onPress={() => setLaterChosen(true)} />
        </Prompt>
      </Modal>
    </>
  );
}

function UpdateScreen({
  title,
  body,
  children,
}: PropsWithChildren<{ title: string; body?: string }>) {
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-canvas px-8">
      <LogoMark size={64} />
      <RNText
        accessibilityRole="header"
        className="text-center font-extrabold text-[22px] text-ink"
      >
        {title}
      </RNText>
      {body ? <Muted className="text-center text-[14px] leading-[20px]">{body}</Muted> : null}
      <View className="w-full gap-2">{children}</View>
      <Muted className="text-[11px]">v{currentVersion}</Muted>
    </View>
  );
}

function Prompt({ title, body, children }: PropsWithChildren<{ title: string; body: string }>) {
  return (
    <View className="flex-1 justify-end bg-black/40">
      <View className="gap-3 rounded-t-[28px] bg-white px-6 pb-10 pt-6">
        <RNText accessibilityRole="header" className="font-extrabold text-[20px] text-ink">
          {title}
        </RNText>
        <Muted className="text-[14px] leading-[20px]">{body}</Muted>
        <View className="mt-2 gap-2">{children}</View>
      </View>
    </View>
  );
}
