import { ApiClientError, type AuthSessionResponse, type OtpRequestResponse } from '@kbs/shared';
import * as Device from 'expo-device';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text as RNText, TextInput, View } from 'react-native';

import { AuthShell } from '@/components/auth';
import { Appear, Button, ErrorText, Icon, Muted, useDeferredFocus, WaitBar } from '@/components/ui';
import { api } from '@/lib/api';
import { routeFor, useSession } from '@/lib/session';
import { clock, resendWait, useCountdown } from '@/lib/countdown';
import { colors } from '@/lib/theme';

const BOXES = 6;

/** Static caret marking the next box (no blinking loop). */
function Caret() {
  return <View style={{ height: 24, width: 2, borderRadius: 1, backgroundColor: colors.ink }} />;
}

function OtpBox({ digit, active, error }: { digit?: string; active: boolean; error: boolean }) {
  const filled = !!digit;
  return (
    <View
      className={`h-14 flex-1 items-center justify-center rounded-lg border ${error ? 'border-[#B42318] bg-[#FDEDEC]' : active ? 'border-ink bg-white' : filled ? 'border-[#D4D4D4] bg-white' : 'border-[#D4D4D4] bg-canvas'}`}
      style={active && !error ? { boxShadow: '0px 0px 0px 3px rgba(23, 23, 23, 0.08)' } : undefined}
    >
      {filled ? (
        <RNText className="font-medium text-xl text-ink tabular-nums">{digit}</RNText>
      ) : active ? (
        <Caret />
      ) : null}
    </View>
  );
}

/** S07 OTP verification — 6 boxes, masked number, edit, resend countdown (REQ-12). */
export default function OtpScreen() {
  const params = useLocalSearchParams<{
    challengeId: string;
    mobile: string;
    purpose: string;
    resendAfterSec: string;
  }>();
  const { signIn, refresh } = useSession();
  // F-818: open the keyboard after the entrance animation (see useDeferredFocus)
  const input = useDeferredFocus<TextInput>();
  const [challengeId, setChallengeId] = useState(params.challengeId);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(true);
  const { secondsLeft, pct, start } = useCountdown(Number(params.resendAfterSec ?? 60));

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<AuthSessionResponse>('/auth/otp/verify', {
        challengeId,
        code,
        platform: 'ANDROID',
        deviceId: Device.osBuildId ?? undefined,
      });
      if (!r.data.accessToken || !r.data.refreshToken) throw new Error('missing tokens');
      await signIn(r.data.accessToken, r.data.refreshToken);
      await refresh();
      router.replace(routeFor(r.data.user, r.data.gates) as never);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not verify the code.');
      if (e instanceof ApiClientError && e.error.code === 'AUTH_OTP_EXPIRED') router.back();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      const r = await api.post<OtpRequestResponse>('/auth/otp/request', {
        mobile: params.mobile,
        purpose: params.purpose,
      });
      setChallengeId(r.data.challengeId);
      start(r.data.resendAfterSec);
      setCode('');
    } catch (e) {
      // asked again too early: show the live wait instead of an error
      const w = resendWait(e);
      if (w) start(w.seconds, w.total);
      else setError(e instanceof ApiClientError ? e.message : 'Could not resend the code.');
    }
  }

  const masked = `+91 ${(params.mobile ?? '').slice(0, 2)}••• ${(params.mobile ?? '').slice(-4)}`;
  return (
    <AuthShell
      title="OTP verification"
      subtitle={
        <RNText className="font-normal text-sm text-[#525252]">
          Code sent to <RNText className="font-medium text-ink tabular-nums">{masked}</RNText>
        </RNText>
      }
    >
      <Appear index={1}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`One-time code, ${code.length} of ${BOXES} digits entered`}
          onPress={() => input.current?.focus()}
          className="relative"
        >
          <View className="flex-row gap-2" pointerEvents="none">
            {Array.from({ length: BOXES }, (_, i) => (
              <OtpBox
                key={i}
                digit={code[i]}
                active={focused && code.length === i}
                error={!!error && code.length === BOXES}
              />
            ))}
          </View>
          <TextInput
            ref={input}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, BOXES))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            className="absolute inset-0 opacity-0"
          />
        </Pressable>
      </Appear>
      <View className="items-center">
        {secondsLeft > 0 ? (
          <View
            className="w-full items-center gap-2"
            accessibilityRole="timer"
            accessibilityLabel={`You can resend the code in ${secondsLeft} seconds`}
          >
            <View className="flex-row items-center gap-1.5 px-3 pt-2">
              <Icon name="time-outline" size={16} color={colors.subtle} />
              <Muted>
                Resend OTP in{' '}
                <RNText className="font-medium text-ink tabular-nums">{clock(secondsLeft)}</RNText>
              </Muted>
            </View>
            <WaitBar pct={pct} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={resend}
            className="min-h-11 flex-row items-center gap-1.5 rounded-lg bg-raised px-4"
          >
            <Icon name="refresh" size={16} color={colors.ink} />
            <RNText className="font-medium text-md text-brand">Resend OTP</RNText>
          </Pressable>
        )}
      </View>
      <ErrorText>{error}</ErrorText>
      <View className="gap-3">
        <Button
          title={busy ? 'Verifying…' : 'Verify OTP'}
          size="lg"
          icon={busy ? undefined : 'shield-checkmark-outline'}
          loading={busy}
          disabled={busy || code.length !== BOXES}
          onPress={verify}
        />
      </View>
    </AuthShell>
  );
}
