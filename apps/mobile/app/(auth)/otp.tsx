import { ApiClientError, type AuthSessionResponse, type OtpRequestResponse } from '@kbs/shared';
import * as Device from 'expo-device';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { routeFor, useSession } from '@/lib/session';

const BOXES = 6;

/** S07 OTP verification — 6 boxes, masked number, edit, resend countdown (REQ-12). */
export default function OtpScreen() {
  const params = useLocalSearchParams<{ challengeId: string; mobile: string; purpose: string; resendAfterSec: string }>();
  const { signIn, refresh } = useSession();
  const input = useRef<TextInput>(null);
  const [challengeId, setChallengeId] = useState(params.challengeId);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      const r = await api.post<OtpRequestResponse>('/auth/otp/request', { mobile: params.mobile, purpose: params.purpose });
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
    <Screen className="pt-14">
      <View className="gap-8">
        <View className="gap-1">
          <Heading>OTP Verification</Heading>
          <Muted>
            Enter the 6-digit OTP sent to{'\n'}
            {masked}{' '}
            <Text className="font-semibold text-primary" onPress={() => router.back()}>
              Edit
            </Text>
          </Muted>
        </View>
        <Pressable accessibilityRole="button" onPress={() => input.current?.focus()} className="relative">
          <View className="flex-row justify-between" pointerEvents="none">
            {Array.from({ length: BOXES }, (_, i) => (
              <View key={i} className={`h-14 w-12 items-center justify-center rounded-xl border-2 ${code.length === i ? 'border-primary' : 'border-border'} bg-card`}>
                <Text className="text-xl font-semibold">{code[i] ?? ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={input}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, BOXES))}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
            className="absolute inset-0 opacity-0"
          />
        </Pressable>
        <View className="items-center">
          {secondsLeft > 0 ? (
            <Muted>
              Resend OTP in {mm}:{ss}
            </Muted>
          ) : (
            <Pressable accessibilityRole="button" onPress={resend}>
              <Text className="font-semibold text-primary">Resend OTP</Text>
            </Pressable>
          )}
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={busy ? 'Verifying…' : 'Verify OTP'} disabled={busy || code.length !== BOXES} onPress={verify} className="rounded-xl" />
        <Muted className="text-center">Didn&apos;t receive OTP?</Muted>
      </View>
    </Screen>
  );
}
