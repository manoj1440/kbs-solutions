import { ApiClientError, CreateTelecallerBody, type UserSummary } from '@kbs/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

/** F-201: Manager creates a Telecaller with name + mobile (REQ-05 §5.1). */
export default function CreateTelecaller() {
  const [fullName, setFullName] = useState('');
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
      <Screen>
        <View className="gap-4">
          <Heading>Telecaller created</Heading>
          <Card className="gap-1">
            <Text className="font-medium">{created.fullName}</Text>
            <Muted>Employee code {created.employeeCode}</Muted>
            <Muted>{created.mobileMasked}</Muted>
          </Card>
          <Muted>Ask them to sign in to this app with that mobile number. Their 72-hour training window starts at the first login.</Muted>
          <Button title="Back to team" onPress={() => router.replace('/(manager)')} />
          <Button
            title="Create another"
            variant="outline"
            onPress={() => {
              setCreated(null);
              setFullName('');
              setMobile('');
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-4">
        <Heading>Create Telecaller</Heading>
        <Muted>Only a name and mobile number are needed. The Telecaller reports to you.</Muted>
        <View>
          <Label>Full name</Label>
          <Input value={fullName} onChangeText={setFullName} autoFocus />
        </View>
        <View>
          <Label>Mobile number</Label>
          <Input keyboardType="phone-pad" placeholder="98765 43210" value={mobile} onChangeText={setMobile} />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={busy ? 'Creating…' : 'Create Telecaller'} disabled={busy} onPress={submit} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
