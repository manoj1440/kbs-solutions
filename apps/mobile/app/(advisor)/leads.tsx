import { ApiClientError, formatDateTime, type LeadStatusRow } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { LeadRow } from '@/components/lead-row';
import { Badge, Card, ErrorText, Heading, Input, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface Draft {
  id: string;
  step: string;
  card: { name: string; bank: { displayName: string } } | null;
  customer: string | null;
  expiresAt: string;
}

/** My Leads (basic list; filters + MIS freshness arrive with F-408 after the MIS slice). */
export default function Leads() {
  const [rows, setRows] = useState<LeadStatusRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, d] = await Promise.all([api.get<LeadStatusRow[]>(`/leads?pageSize=100${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`), api.get<Draft[]>('/leads/drafts')]);
      setRows(l.data);
      setDrafts(d.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [q]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <View className="mb-3 gap-2">
        <Heading>My leads</Heading>
        <Input placeholder="Search name or KBS reference" value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" />
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          drafts.length ? (
            <View className="mb-3 gap-2">
              {drafts.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/lead-new', params: { draftId: d.id } })}>
                  <Card className="gap-1 border-warning">
                    <Badge label={`Draft · ${d.step.toLowerCase()}`} variant="warning" />
                    <Text>
                      {d.customer ?? 'Customer not entered'} · {d.card?.bank.displayName} {d.card?.name}
                    </Text>
                    <Muted>Resume · expires {formatDateTime(d.expiresAt)}</Muted>
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>No leads yet.</Text>
              <Muted>Pick a card on Home and create a lead for your customer.</Muted>
            </Card>
          )
        }
        renderItem={({ item }) => <LeadRow row={item} onPress={() => router.push({ pathname: '/(advisor)/lead', params: { id: item.id } })} />}
      />
    </Screen>
  );
}
