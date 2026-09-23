import { ApiClientError, type AuthSessionResponse, type OtpRequestResponse } from '@kbs/shared';
import * as Device from 'expo-device';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text as RNText, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { AuthShell } from '@/components/auth';
import { Appear, Button, ErrorText, Icon, Muted } from '@/components/ui';
import { api } from '@/lib/api';
import { routeFor, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

const BOXES = 6;

function Caret() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(
      withRepeat(
        withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })),
        -1,
      ),
    );
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View className="h-6 w-[2px] rounded-full bg-brand" style={anim} />;
}

function OtpBox({ digit, active, error }: { digit?: string; active: boolean; error: boolean }) {
  const filled = !!digit;
  return (
    <View
      className={`h-[58px] flex-1 items-center justify-center rounded-2xl border-[1.5px] ${error ? 'border-[#E5484D] bg-[#FDECEA]' : active ? 'border-brand bg-white' : filled ? 'border-ink bg-white' : 'border-line bg-canvas'}`}
      style={
        active && !error ? { boxShadow: '0px 0px 0px 4px rgba(22, 50, 158, 0.12)' } : undefined
      }
    >
      {filled ? (
        <Animated.View key={digit} entering={ZoomIn.duration(160)}>
          <RNText className="font-extrabold text-[24px] text-ink">{digit}</RNText>
        </Animated.View>
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
  const input = useRef<TextInput>(null);
  const [challengeId, setChallengeId] = useState(params.challengeId);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(Number(params.resendAfterSec ?? 60));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

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
      setSecondsLeft(r.data.resendAfterSec);
      setCode('');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not resend the code.');
    }
  }

  const masked = `+91 ${(params.mobile ?? '').slice(0, 2)}••• ${(params.mobile ?? '').slice(-4)}`;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return (
    <AuthShell
      title="OTP Verification"
      subtitle={
        <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <RNText className="font-medium text-[15px] leading-[22px] text-white/70">
            Enter the 6-digit OTP sent to
          </RNText>
          <View className="flex-row items-center gap-2">
            <RNText className="font-bold text-[15px] tracking-[0.5px] text-white">{masked}</RNText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit mobile number"
              onPress={() => router.back()}
              hitSlop={10}
              className="flex-row items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"
            >
              <Icon name="create-outline" size={13} color={colors.gold} />
              <RNText className="font-bold text-[12px] text-gold">Edit</RNText>
            </Pressable>
          </View>
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
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, BOXES))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
            className="absolute inset-0 opacity-0"
          />
        </Pressable>
      </Appear>
      <Appear index={2} className="items-center">
        {secondsLeft > 0 ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-canvas px-3.5 py-2">
            <Icon name="time-outline" size={15} color={colors.muted} />
            <Muted className="font-medium">
              Resend OTP in{' '}
              <RNText className="font-bold text-ink">
                {mm}:{ss}
              </RNText>
            </Muted>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={resend}
            className="min-h-[44px] flex-row items-center gap-1.5 rounded-full bg-[#E8EDFF] px-4"
          >
            <Icon name="refresh" size={16} color={colors.brand} />
            <RNText className="font-bold text-[14px] text-brand">Resend OTP</RNText>
          </Pressable>
        )}
      </Appear>
      <ErrorText>{error}</ErrorText>
      <Appear index={3} className="gap-3">
        <Button
          title={busy ? 'Verifying…' : 'Verify OTP'}
          size="lg"
          icon={busy ? undefined : 'shield-checkmark'}
          loading={busy}
          disabled={busy || code.length !== BOXES}
          onPress={verify}
        />
        <Muted className="text-center">
          Didn&apos;t receive OTP?
          {secondsLeft > 0 ? ' You can request a new one when the timer ends.' : ''}
        </Muted>
      </Appear>
    </AuthShell>
  );
}
