import { ApiClientError, formatDateTime, formatInr } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { PayoutStateBadge } from '@/components/status';
import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface Row {
  id: string;
  publicRef: string;
  state: string;
  advisor: { fullName: string };
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  outstanding: string[];
}

/** F-604 (Manager mobile): payout requests awaiting my approval, plus the team's history. */
export default function ManagerApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await api.get<Row[]>(`/payouts/requests?pageSize=100${mine ? '&awaitingMe=true' : ''}`)).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load approvals.');
    } finally {
      setLoading(false);
    }
  }, [mine]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <View className="mb-3 gap-2">
        <Heading>Payout approvals</Heading>
        <View className="flex-row gap-2">
          <Button title="Awaiting me" variant={mine ? 'default' : 'outline'} onPress={() => setMine(true)} />
          <Button title="All team requests" variant={mine ? 'outline' : 'default'} onPress={() => setMine(false)} />
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={loading ? null : <Card><Text>{mine ? 'Nothing awaiting your approval.' : 'No payout requests yet.'}</Text></Card>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(manager)/payout-request', params: { id: item.id } })}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-medium">{item.advisor.fullName}</Text>
                <PayoutStateBadge state={item.state} />
              </View>
              <Text>
                {formatInr(item.totalAmountInr)} · {item.itemCount} card event(s)
              </Text>
              <Muted>
                {item.publicRef} · submitted {formatDateTime(item.submittedAt)}
              </Muted>
              {item.outstanding.length ? <Badge label={`Outstanding: ${item.outstanding.join(' + ').toLowerCase()}`} variant="warning" /> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
