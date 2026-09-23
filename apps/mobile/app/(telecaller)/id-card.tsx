import { ApiClientError, formatDate } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface IdCard {
  id: string;
  version: number;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: string | null;
  fields: { fullName?: string; employeeCode?: string | null; role?: string; issuedAt?: string; verifyUrl?: string };
  verifyUrl?: string;
}

/** F-312 §3: Official ID screen. Sharing to a customer happens from that customer's record (F-311). */
export default function IdCardScreen() {
  const [card, setCard] = useState<IdCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setCard((await api.get<IdCard>('/id-cards/me')).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your ID card.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <>
      <Screen>
        <View className="gap-3">
          <Button title="← Back" variant="ghost" onPress={() => router.back()} />
          <Heading>Official ID</Heading>
          <ErrorText>{error}</ErrorText>
          {card ? (
            <Card className="gap-2 border-primary">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold">KBS Solutions</Text>
                <Badge label={card.status === 'ACTIVE' ? `Active · v${card.version}` : 'Revoked'} variant={card.status === 'ACTIVE' ? 'success' : 'destructive'} />
              </View>
              <Text className="text-2xl font-bold">{card.fields.fullName}</Text>
              <Text>{card.fields.role ?? 'Telecaller'}</Text>
              {card.fields.employeeCode ? <Text className="font-mono">{card.fields.employeeCode}</Text> : null}
              <Muted>Issued {card.fields.issuedAt ? formatDate(card.fields.issuedAt) : '—'}</Muted>
              {card.verifyUrl ? <Muted>Customers can verify at {card.verifyUrl}</Muted> : null}
              <Muted>This card carries no customer, PAN or payout data. Share it from a customer record so the share is logged.</Muted>
            </Card>
          ) : null}
        </View>
      </Screen>
    </>
  );
}
