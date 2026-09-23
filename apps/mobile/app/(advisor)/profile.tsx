import { type AdvisorProfileView, agentCodeInput, ApiClientError, formatDateTime } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Label, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** F-410 Advisor profile: identity summary (status/date only), reporting + Agent Code (F-402), bank last4/IFSC, support. No files or full numbers. */
export default function Profile() {
  const { user, signOut, refresh } = useSession();
  const [p, setP] = useState<AdvisorProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setP((await api.get<AdvisorProfileView>('/me/profile')).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the profile.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-8">
        <Heading>Profile</Heading>
        <Card className="gap-2">
          <Text className="font-medium">{p?.fullName || user?.fullName || '(name pending)'}</Text>
          <Muted>{p?.mobileMasked ?? user?.mobileMasked}</Muted>
          {p?.email ? <Muted>{p.email}</Muted> : null}
          <Badge label={user?.role ?? ''} variant="secondary" />
        </Card>
        {p ? (
          <>
            <Card className="gap-1">
              <Text className="font-medium">Identity verification</Text>
              <View className="flex-row items-center gap-2">
                <Badge label={p.identity.status.toLowerCase().replace(/_/g, ' ')} variant={p.identity.status === 'VERIFIED' ? 'success' : p.identity.status === 'FAILED' ? 'destructive' : 'warning'} />
                {p.identity.verifiedAt ? <Muted>verified {formatDateTime(p.identity.verifiedAt)}</Muted> : null}
              </View>
              <Muted>Only the outcome and date are kept here.</Muted>
            </Card>
            <Card className="gap-1">
              <Text className="font-medium">Reporting</Text>
              <Text>{p.reporting.parent ? `${p.reporting.parent.fullName} (${p.reporting.parent.role.toLowerCase()})` : 'KBS (no manager)'}</Text>
              <Muted>
                Agent Code: {p.reporting.agentCode ?? '—'}
                {p.reporting.since ? ` · since ${formatDateTime(p.reporting.since)}` : ''}
              </Muted>
              {p.reporting.pendingChange ? <Badge label={`Change to ${p.reporting.pendingChange.toAgentCode} awaiting Admin approval`} variant="warning" /> : null}
            </Card>
            <Card className="gap-1">
              <Text className="font-medium">Payout bank account</Text>
              {p.bank ? (
                <Muted>
                  {p.bank.bankName} · ••••{p.bank.accountLast4} · {p.bank.ifsc}
                </Muted>
              ) : (
                <Muted>Not added yet.</Muted>
              )}
            </Card>
            {p.idCard ? (
              <Card className="gap-1">
                <Text className="font-medium">Official ID card</Text>
                <Muted>{p.idCard.publicRef} · active</Muted>
              </Card>
            ) : null}
            <Card className="gap-1">
              <Text className="font-medium">Support</Text>
              {p.support.contact ? (
                <Button title={p.support.contact} variant="outline" onPress={() => void Linking.openURL(p.support.contact!.includes('@') ? `mailto:${p.support.contact}` : `tel:${p.support.contact}`)} />
              ) : (
                <Muted>Contact your reporting Manager or KBS office.</Muted>
              )}
            </Card>
          </>
        ) : null}
        <Card className="gap-2">
          <Text className="font-medium">Change Agent Code</Text>
          <Muted>Applies from today under KBS policy; if you already have leads the change waits for Admin approval. Earlier leads and payouts keep their original attribution.</Muted>
          <Label>Agent Code</Label>
          <Input value={code} autoCapitalize="characters" onChangeText={(t) => setCode(agentCodeInput(t))} />
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
                await load();
              } catch (e) {
                setError(e instanceof ApiClientError ? e.message : 'Could not apply the code.');
              }
            }}
          />
          {msg ? <Muted>{msg}</Muted> : null}
          <ErrorText>{error}</ErrorText>
        </Card>
        <Button title="Sign out" variant="outline" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  );
}
