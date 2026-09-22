import { ApiClientError, isValidE164India, type OtpRequestResponse } from '@kbs/shared';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

/** S06 Login — mobile + OTP only (REQ-12; passwords are never used). */
export default function MobileScreen() {
  const { purpose = 'LOGIN' } = useLocalSearchParams<{ purpose?: 'LOGIN' | 'ADVISOR_SIGNUP' }>();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!isValidE164India(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<OtpRequestResponse>('/auth/otp/request', { mobile, purpose });
      router.push({ pathname: '/(auth)/otp', params: { challengeId: r.data.challengeId, mobile, purpose, resendAfterSec: String(r.data.resendAfterSec) } });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  const signup = purpose === 'ADVISOR_SIGNUP';
  return (
    <Screen className="pt-14">
      <View className="gap-8">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-primary">KBS</Text>
          <Heading className="text-2xl">{signup ? 'Create Account' : 'Welcome Back'}</Heading>
          <Muted>{signup ? 'Register as an Advisor to continue' : 'Sign in to continue'}</Muted>
        </View>
        <View>
          <Label>📱 Mobile Number</Label>
          <Input keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" value={mobile} onChangeText={setMobile} autoFocus className="rounded-xl" />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={busy ? 'Sending…' : signup ? 'Send OTP' : 'Login'} disabled={busy} onPress={submit} className="rounded-xl" />
        <Muted className="text-center text-xs">We will send a one-time code — passwords are never used.</Muted>
        <View className="items-center">
          {signup ? (
            <Link href="/(auth)/mobile?purpose=LOGIN" asChild>
              <Pressable accessibilityRole="button">
                <Muted>
                  Already registered? <Text className="font-semibold text-primary">Sign in</Text>
                </Muted>
              </Pressable>
            </Link>
          ) : (
            <Link href="/(auth)/mobile?purpose=ADVISOR_SIGNUP" asChild>
              <Pressable accessibilityRole="button">
                <Muted>
                  New here? <Text className="font-semibold text-primary">Create Account</Text>
                </Muted>
              </Pressable>
            </Link>
          )}
        </View>
      </View>
    </Screen>
  );
}
