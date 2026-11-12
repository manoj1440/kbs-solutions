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
import {
  Appear,
  Button,
  ErrorText,
  Icon,
  Input,
  Muted,
  useDeferredFocus,
  WaitBar,
} from '@/components/ui';
import { api } from '@/lib/api';
import { clock, resendWait, useCountdown } from '@/lib/countdown';
import { colors } from '@/lib/theme';

/** S06 Login — mobile + OTP only (REQ-12; passwords are never used). */
export default function MobileScreen() {
  const { purpose = 'LOGIN' } = useLocalSearchParams<{ purpose?: 'LOGIN' | 'ADVISOR_SIGNUP' }>();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useDeferredFocus<TextInput>();
  // resend wait for the number a code was last requested for
  const { secondsLeft, pct, start } = useCountdown(0);
  const [waitMobile, setWaitMobile] = useState('');

  async function submit() {
    setError(null);
    if (!isValidE164India(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<OtpRequestResponse>('/auth/otp/request', { mobile, purpose });
      // one code per number per cooldown: remember it so coming back here shows the live wait
      setWaitMobile(mobile);
      start(r.data.resendAfterSec);
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
      // a code was sent to this number moments ago: show the live wait instead of an error
      const w = resendWait(e);
      if (w) {
        setWaitMobile(mobile);
        start(w.seconds, w.total);
      } else setError(e instanceof ApiClientError ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  const signup = purpose === 'ADVISOR_SIGNUP';
  const waiting = secondsLeft > 0 && mobile === waitMobile;
  const valid = isValidE164India(mobile);
  return (
    <AuthShell
      title={signup ? 'Create account' : 'Sign in'}
      subtitle={
        signup
          ? 'Register as an Advisor. We text a 6-digit code to your number'
          : 'We text a 6-digit code to your registered number'
      }
    >
      <Appear index={2}>
        <Input
          ref={field}
          label="Mobile number"
          icon="call-outline"
          prefix="+91"
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="98765 43210"
          value={mobile}
          onChangeText={(t) => setMobile(mobileInput(t))}
          inputClassName="min-w-0 font-medium text-lg"
          right={
            valid ? <Icon name="checkmark-circle-outline" size={18} color={colors.success} /> : null
          }
        />
      </Appear>
      <ErrorText>{error}</ErrorText>
      <View className="gap-4">
        <Button
          title={busy ? 'Sending…' : waiting ? `Send code in ${clock(secondsLeft)}` : 'Send code'}
          size="lg"
          iconRight={busy || waiting ? undefined : 'arrow-forward'}
          loading={busy}
          disabled={busy || !valid || waiting}
          onPress={submit}
        />
        {waiting ? (
          <View
            className="gap-2"
            accessibilityRole="timer"
            accessibilityLabel={`You can request a new code in ${secondsLeft} seconds`}
          >
            <WaitBar pct={pct} />
            <Muted className="text-center text-xs">
              A code was just sent to this number. You can request a new one when the timer ends.
            </Muted>
          </View>
        ) : null}
      </View>
      <View className="mt-2 items-center">
        {signup ? (
          <Link href="/(auth)/mobile?purpose=LOGIN" asChild>
            <Pressable accessibilityRole="button" className="min-h-11 justify-center px-2">
              <Muted className="text-md">
                Already registered? <RNText className="font-medium text-brand">Sign in</RNText>
              </Muted>
            </Pressable>
          </Link>
        ) : (
          <Link href="/(auth)/mobile?purpose=ADVISOR_SIGNUP" asChild>
            <Pressable accessibilityRole="button" className="min-h-11 justify-center px-2">
              <Muted className="text-md">
                New here? <RNText className="font-medium text-brand">Create account</RNText>
              </Muted>
            </Pressable>
          </Link>
        )}
      </View>
      {/* F-818: which code is running — the APK's own bundle or an over-the-air update */}
      <Muted className="text-center text-xs">
        v{Constants.expoConfig?.version ?? '?'} ·{' '}
        {Updates.isEmbeddedLaunch ? 'built-in' : `update ${(Updates.updateId ?? '').slice(0, 8)}`}
      </Muted>
    </AuthShell>
  );
}
