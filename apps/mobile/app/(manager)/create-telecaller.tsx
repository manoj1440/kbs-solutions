import { ApiClientError, CreateTelecallerBody, mobileInput, type UserSummary } from '@kbs/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text as RNText, type TextInput, View } from 'react-native';

import {
  AppBar,
  Appear,
  Avatar,
  Button,
  Callout,
  Card,
  ErrorText,
  IconCircle,
  Input,
  KeyValue,
  Muted,
  Screen,
  StickyFooter,
  Text,
  useDeferredFocus,
} from '@/components/ui';
import { api } from '@/lib/api';

/** F-201: Manager creates a Telecaller with name + mobile (REQ-05 §5.1). */
export default function CreateTelecaller() {
  const [fullName, setFullName] = useState('');
  const nameField = useDeferredFocus<TextInput>();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<UserSummary | null>(null);

  async function submit() {
    setError(null);
    const parsed = CreateTelecallerBody.safeParse({ fullName, mobile });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<UserSummary>('/telecallers', parsed.data);
      setCreated(r.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not create the Telecaller.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Screen
        scroll
        header={<AppBar title="Telecaller created" />}
        footer={
          <StickyFooter>
            <Button
              title="Back to team"
              icon="people"
              onPress={() => router.replace('/(manager)')}
            />
            <Button
              title="Create another"
              icon="person-add-outline"
              variant="outline"
              onPress={() => {
                setCreated(null);
                setFullName('');
                setMobile('');
              }}
            />
          </StickyFooter>
        }
      >
        <Appear>
          <View className="items-center rounded-xl border border-line bg-white px-5 py-7">
            <IconCircle icon="checkmark" tone="success" size={40} />
            <RNText className="mt-4 font-medium text-xl text-ink">Telecaller created</RNText>
            <RNText className="mt-1 text-center font-normal text-sm text-[#525252]">
              They report to you from now on
            </RNText>
          </View>
        </Appear>
        <Appear index={1}>
          <Card className="gap-2">
            <View className="flex-row items-center gap-3 pb-2">
              <Avatar name={created.fullName} size={48} />
              <Text numberOfLines={1} className="flex-1 font-medium text-lg">
                {created.fullName}
              </Text>
            </View>
            <KeyValue label="Employee code" value={created.employeeCode ?? '—'} mono />
            <KeyValue label="Mobile" value={created.mobileMasked} last />
          </Card>
        </Appear>
        <Appear index={2}>
          <Callout kind="info" title="Next step" icon="phone-portrait-outline">
            Ask them to sign in to this app with that mobile number. Their 72-hour training window
            starts at the first login.
          </Callout>
        </Appear>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      header={<AppBar title="Create Telecaller" subtitle="Adds a Telecaller to your team" />}
      footer={
        <StickyFooter>
          <Button
            title={busy ? 'Creating…' : 'Create Telecaller'}
            icon="person-add"
            size="lg"
            loading={busy}
            disabled={busy}
            onPress={submit}
          />
        </StickyFooter>
      }
    >
      <Appear>
        <View className="rounded-xl bg-raised p-4">
          <Muted className="text-sm text-[#525252]">
            Only a name and mobile number are needed. The Telecaller reports to you.
          </Muted>
        </View>
      </Appear>
      <Appear index={1}>
        <Card className="gap-4">
          <Input
            ref={nameField}
            label="Full name"
            icon="person-outline"
            placeholder="As on their ID"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <Input
            label="Mobile number"
            icon="call-outline"
            keyboardType="phone-pad"
            placeholder="98765 43210"
            value={mobile}
            onChangeText={(t) => setMobile(mobileInput(t))}
            hint="They sign in with an OTP sent to this number."
          />
        </Card>
      </Appear>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
