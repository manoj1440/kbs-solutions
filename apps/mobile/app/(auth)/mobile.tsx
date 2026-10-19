import {
  ApiClientError,
  isValidE164India,
  mobileInput,
  type OtpRequestResponse,
} from '@kbs/shared';
import Constants from 'expo-constants';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, Text as RNText, type TextInput, View } from 'react-native';

import { AuthShell } from '@/components/auth';
import { Appear, Button, ErrorText, Icon, Input, Muted, useDeferredFocus } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

/** S06 Login — mobile + OTP only (REQ-12; passwords are never used). */
export default function MobileScreen() {
  const { purpose = 'LOGIN' } = useLocalSearchParams<{ purpose?: 'LOGIN' | 'ADVISOR_SIGNUP' }>();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useDeferredFocus<TextInput>();

  async function submit() {
    setError(null);
    if (!isValidE164India(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<OtpRequestResponse>('/auth/otp/request', { mobile, purpose });
      router.push({
        pathname: '/(auth)/otp',
        params: {
          challengeId: r.data.challengeId,
          mobile,
          purpose,
          resendAfterSec: String(r.data.resendAfterSec),
        },
      });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  const signup = purpose === 'ADVISOR_SIGNUP';
  const valid = isValidE164India(mobile);
  return (
    <AuthShell
      title={signup ? 'Create Account' : 'Welcome Back'}
      subtitle={signup ? 'Register as an Advisor to continue' : 'Sign in to continue'}
    >
      <Appear index={1} className="gap-1">
        <RNText className="font-bold text-[18px] text-ink">
          {signup ? 'Enter your mobile number' : 'Login with your mobile'}
        </RNText>
        <Muted>We&apos;ll text a 6-digit code to verify it&apos;s you.</Muted>
      </Appear>
      <Appear index={2}>
        <Input
          ref={field}
          label="Mobile Number"
          icon="call-outline"
          prefix="+91"
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="98765 43210"
          value={mobile}
          onChangeText={(t) => setMobile(mobileInput(t))}
          inputClassName="min-w-0"
          right={valid ? <Icon name="checkmark-circle" size={20} color={colors.success} /> : null}
        />
      </Appear>
      <ErrorText>{error}</ErrorText>
      <View className="gap-4">
        <Button
          title={busy ? 'Sending…' : signup ? 'Send OTP' : 'Login'}
          size="lg"
          iconRight={busy ? undefined : 'arrow-forward'}
          loading={busy}
          disabled={busy || !valid}
          onPress={submit}
        />
        <View className="flex-row items-center gap-2.5 rounded-2xl bg-canvas px-3.5 py-3">
          <Icon name="shield-checkmark" size={18} color={colors.success} />
          <Muted className="flex-1 text-[12px] leading-[17px]">
            We will send a one-time code — passwords are never used.
          </Muted>
        </View>
      </View>
      <View className="mt-2 items-center">
        {signup ? (
          <Link href="/(auth)/mobile?purpose=LOGIN" asChild>
            <Pressable accessibilityRole="button" className="min-h-[44px] justify-center px-2">
              <Muted className="text-[14px]">
                Already registered? <RNText className="font-bold text-brand">Sign in</RNText>
              </Muted>
            </Pressable>
          </Link>
        ) : (
          <Link href="/(auth)/mobile?purpose=ADVISOR_SIGNUP" asChild>
            <Pressable accessibilityRole="button" className="min-h-[44px] justify-center px-2">
              <Muted className="text-[14px]">
                New here? <RNText className="font-bold text-brand">Create Account</RNText>
              </Muted>
            </Pressable>
          </Link>
        )}
      </View>
      {/* F-818: which code is running — the APK's own bundle or an over-the-air update */}
      <Muted className="text-center text-[11px]">
        v{Constants.expoConfig?.version ?? '?'} ·{' '}
        {Updates.isEmbeddedLaunch ? 'built-in' : `update ${(Updates.updateId ?? '').slice(0, 8)}`}
      </Muted>
    </AuthShell>
  );
}
