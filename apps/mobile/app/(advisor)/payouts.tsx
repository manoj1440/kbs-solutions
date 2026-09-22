import { ApiClientError, formatDateTime, formatInr } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { PayoutStateBadge } from '@/components/status';
import { Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface Entitlement {
  id: string;
  state: string;
  amountInr: number;
  eligibleAt: string;
  triggerField: string;
  triggerFieldValue: string;
  rule: { name: string; version: number };
  lead: { id: string; publicRef: string; customerFullName: string };
  bank: { displayName: string };
  card: string;
  evidence: { batchRef: string; uploadedAt: string };
  reviewReason: string | null;
}
interface Counts {
  eligible: number;
  availableToClaim: number;
  reserved: number;
  paid: number;
  pendingHold: number;
  underReview: number;
}

/** F-602 Advisor ledger: eligible vs available-to-claim vs reserved vs paid (REQ-17 §17.9). Requests arrive with F-603. */
export default function Payouts() {
  const [rows, setRows] = useState<Entitlement[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<Entitlement[]>('/payouts/entitlements?pageSize=100');
      setRows(r.data);
      const meta = r.meta as unknown as { counts?: Counts; amounts?: Record<string, number> };
      setCounts(meta.counts ?? null);
      setAmounts(meta.amounts ?? {});
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load payouts.');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <View className="mb-3 gap-2">
        <Heading>Payouts</Heading>
        <Muted>Only card events the bank MIS has confirmed under an approved rule appear here. Approval or activation alone does not create a payout.</Muted>
        {counts ? (
          <View className="flex-row flex-wrap gap-2">
            <Card className="min-w-[45%] flex-1">
              <Muted>Available to claim</Muted>
              <Text className="text-lg font-semibold">
                {counts.availableToClaim} · {formatInr(amounts.available ?? 0)}
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1">
              <Muted>Reserved in requests</Muted>
              <Text className="text-lg font-semibold">
                {counts.reserved} · {formatInr(amounts.reserved ?? 0)}
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1">
              <Muted>Paid</Muted>
              <Text className="text-lg font-semibold">
                {counts.paid} · {formatInr(amounts.paid ?? 0)}
              </Text>
            </Card>
            <Card className="min-w-[45%] flex-1">
              <Muted>On hold / under review</Muted>
              <Text className="text-lg font-semibold">
                {counts.pendingHold} / {counts.underReview}
              </Text>
            </Card>
          </View>
        ) : null}
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>No payout entitlements yet.</Text>
              <Muted>They appear when a bank MIS reports the configured activation value for one of your leads.</Muted>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/lead', params: { id: item.lead.id } })}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-medium">{item.lead.customerFullName}</Text>
                <PayoutStateBadge state={item.state} />
              </View>
              <Muted>
                {item.lead.publicRef} · {item.bank.displayName} {item.card}
              </Muted>
              <Text>
                {formatInr(item.amountInr)} · {item.triggerField} = “{item.triggerFieldValue}”
              </Text>
              <Muted>
                {item.rule.name} v{item.rule.version} · eligible {formatDateTime(item.eligibleAt)} · MIS {item.evidence.batchRef}
              </Muted>
              {item.reviewReason ? <Muted>{item.reviewReason}</Muted> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
