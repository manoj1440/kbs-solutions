import { ApiClientError } from '@kbs/shared';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Advisor profile with Agent Code change (F-402 §2). */
export default function Profile() {
  const { user, signOut, refresh } = useSession();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Profile</Heading>
        <Card className="gap-2">
          <Text className="font-medium">{user?.fullName || '(name pending)'}</Text>
          <Muted>{user?.mobileMasked}</Muted>
          <Badge label={user?.role ?? ''} variant="secondary" />
          <Muted>Reporting to: {user?.reportingParent ? `${user.reportingParent.fullName} (${user.reportingParent.role.toLowerCase()})` : 'KBS'}</Muted>
        </Card>
        <Card className="gap-2">
          <Text className="font-medium">Change Agent Code</Text>
          <Muted>Applies from today under KBS policy; if you already have leads the change waits for Admin approval. Earlier leads and payouts keep their original attribution.</Muted>
          <Label>Agent Code</Label>
          <Input value={code} autoCapitalize="characters" onChangeText={(t) => setCode(t.toUpperCase())} />
          <Button
            title="Apply code"
            disabled={code.length < 4}
            onPress={async () => {
              setMsg(null);
              setError(null);
              try {
                const r = await api.post<{ status: 'APPLIED' | 'PENDING_APPROVAL'; reportingParent: { fullName: string } }>('/me/agent-code', { code });
                setMsg(r.data.status === 'APPLIED' ? `Now reporting to ${r.data.reportingParent.fullName}.` : `Change to ${r.data.reportingParent.fullName} is awaiting Admin approval; your current reporting person is unchanged until then.`);
                setCode('');
                await refresh();
              } catch (e) {
                setError(e instanceof ApiClientError ? e.message : 'Could not apply the code.');
              }
            }}
          />
          {msg ? <Muted>{msg}</Muted> : null}
          <ErrorText>{error}</ErrorText>
        </Card>
        <Button title="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
