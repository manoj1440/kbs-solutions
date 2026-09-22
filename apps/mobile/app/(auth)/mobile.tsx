import { ApiClientError, isValidE164India, type OtpRequestResponse } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorText, Heading, Input, Label, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';

/** S06 Mobile number — same UI whether or not the number exists (REQ-23 §23.1). */
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

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Heading>{purpose === 'ADVISOR_SIGNUP' ? 'Register as an Advisor' : 'Sign in'}</Heading>
          <Muted>We will send a one-time code to your registered mobile number.</Muted>
        </View>
        <View>
          <Label>Mobile number</Label>
          <Input keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" value={mobile} onChangeText={setMobile} autoFocus />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={busy ? 'Sending…' : 'Send code'} disabled={busy} onPress={submit} />
        <Muted>By continuing you agree to the KBS privacy notice. Passwords are never used.</Muted>
      </View>
    </Screen>
  );
}
