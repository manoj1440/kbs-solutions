import { ApiClientError, type AuthSessionResponse, type OtpRequestResponse } from '@kbs/shared';
import * as Device from 'expo-device';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, Text as RNText, TextInput, View } from 'react-native';

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

/** One large cell per digit: the next one is ringed in ink, filled ones sit on a quiet fill, a wrong code turns them red. */
function OtpBox({ digit, active, error }: { digit?: string; active: boolean; error: boolean }) {
  const filled = !!digit;
  return (
    <View
      className={`h-16 flex-1 items-center justify-center rounded-lg ${error ? 'border-2 border-[#B42318] bg-[#FDEDEC]' : active ? 'border-2 border-ink bg-white' : filled ? 'border-[1.5px] border-raised bg-raised' : 'border-[1.5px] border-[#E0DCD6] bg-white'}`}
    >
      {filled ? (
        <RNText className="font-semibold text-xl text-ink tabular-nums">{digit}</RNText>
      ) : active ? (
        <Caret />
      ) : null}
    </View>
  );
}

/** S07 OTP verification (REQ-12) — six large cells, verifies itself on the sixth digit, live resend countdown. */
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

  async function verify(entered = code) {
    if (busy || entered.length !== BOXES) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<AuthSessionResponse>('/auth/otp/verify', {
        challengeId,
        code: entered,
        platform: 'ANDROID',
        deviceId: Device.osBuildId ?? undefined,
      });
      if (!r.data.accessToken || !r.data.refreshToken) throw new Error('missing tokens');
      Keyboard.dismiss(); // the next screen must not open under a keyboard
      await signIn(r.data.accessToken, r.data.refreshToken);
      await refresh();
      router.replace(routeFor(r.data.user, r.data.gates) as never);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not verify the code.');
      if (e instanceof ApiClientError && e.error.code === 'AUTH_OTP_EXPIRED') router.back();
      // a wrong code: show it in red for a moment, then clear the cells so the next try starts clean
      else if (e instanceof ApiClientError && e.error.code === 'AUTH_OTP_INVALID')
        setTimeout(() => setCode(''), 900);
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
      title="Enter the code"
      subtitle={
        <View className="flex-row flex-wrap items-center gap-x-1.5">
          <RNText className="font-normal text-md text-[#525252]">
            Sent to <RNText className="font-medium text-ink tabular-nums">{masked}</RNText>
          </RNText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change mobile number"
            onPress={() => router.back()}
            hitSlop={10}
          >
            <RNText className="font-medium text-md text-gold">Change</RNText>
          </Pressable>
        </View>
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
            onChangeText={(v) => {
              const next = v.replace(/\D/g, '').slice(0, BOXES);
              if (error) setError(null);
              setCode(next);
              // the sixth digit is the submit: nobody should have to find a button after typing a code
              if (next.length === BOXES) void verify(next);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            className="absolute inset-0 opacity-0"
          />
        </Pressable>
      </Appear>
      <ErrorText>{error}</ErrorText>
      <Button
        title={busy ? 'Verifying…' : 'Verify'}
        size="lg"
        loading={busy}
        disabled={busy || code.length !== BOXES}
        onPress={() => void verify()}
      />
      <View className="items-center">
        {secondsLeft > 0 ? (
          <View
            className="w-full items-center gap-3"
            accessibilityRole="timer"
            accessibilityLabel={`You can resend the code in ${secondsLeft} seconds`}
          >
            <Muted className="text-md">
              Resend code in{' '}
              <RNText className="font-medium text-ink tabular-nums">{clock(secondsLeft)}</RNText>
            </Muted>
            <View className="w-24">
              <WaitBar pct={pct} />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={resend}
            hitSlop={8}
            className="min-h-11 flex-row items-center justify-center gap-1.5 px-4"
          >
            <Icon name="refresh" size={18} color={colors.gold} />
            <RNText className="font-medium text-base text-gold">Resend code</RNText>
          </Pressable>
        )}
      </View>
    </AuthShell>
  );
}
