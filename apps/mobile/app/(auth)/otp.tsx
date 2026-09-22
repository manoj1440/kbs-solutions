import { ApiClientError, type AuthSessionResponse, type OtpRequestResponse } from '@kbs/shared';
import * as Device from 'expo-device';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorText, Heading, Input, Label, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { routeFor, useSession } from '@/lib/session';

/** S07 OTP verification — masked number, resend with countdown, expiry handling (REQ-12). */
export default function OtpScreen() {
  const params = useLocalSearchParams<{ challengeId: string; mobile: string; purpose: string; resendAfterSec: string }>();
  const { signIn, refresh } = useSession();
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

  const masked = `+91 •••••• ${(params.mobile ?? '').slice(-4)}`;
  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Heading>Enter the code</Heading>
          <Muted>Sent to {masked}</Muted>
        </View>
        <View>
          <Label>One-time code</Label>
          <Input keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} autoFocus />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={busy ? 'Verifying…' : 'Continue'} disabled={busy || code.length !== 6} onPress={verify} />
        <View className="flex-row justify-between">
          <Button title="Change number" variant="ghost" onPress={() => router.back()} />
          <Button title={secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'} variant="ghost" disabled={secondsLeft > 0} onPress={resend} />
        </View>
      </View>
    </Screen>
  );
}
