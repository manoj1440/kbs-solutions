import { ApiClientError, type CallingQueueRow, formatDateTime, type QueueTab } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Badge, Card, ErrorText, Heading, Input, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

type Counts = { active: number; followups: number; dueNow: number; hidden: number };
const TABS: { key: QueueTab; label: string }[] = [
  { key: 'active', label: 'Queue' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'hidden', label: 'History' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unknown'> = {
  UNTOUCHED: 'secondary',
  FOLLOW_UP: 'warning',
  INTERESTED: 'info',
  LINK_SHARED: 'success',
  DECLINED: 'unknown',
  COMPLETED: 'success',
  UNREACHABLE: 'unknown',
};

/** F-307: My Calling Queue — active / follow-ups / history(hidden). Mobiles are masked; capture is blocked by the route policy (F-302). */
export default function TelecallerHome() {
  const [tab, setTab] = useState<QueueTab>('active');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CallingQueueRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ tab, pageSize: '100' });
      if (search.trim()) q.set('search', search.trim());
      const r = await api.get<CallingQueueRow[]>(`/calling/queue?${q.toString()}`);
      setRows(r.data);
      const meta = r.meta as { counts?: Counts };
      if (meta.counts) setCounts(meta.counts);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your queue. Check your connection and pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
      <Screen>
        <View className="mb-3 gap-3">
          <View>
            <Heading>My calling queue</Heading>
            <Muted>{counts ? `${counts.active} active · ${counts.followups} follow-ups${counts.dueNow ? ` (${counts.dueNow} due now)` : ''} · ${counts.hidden} in history` : ' '}</Muted>
          </View>
          <View className="flex-row gap-2">
            {TABS.map((t) => (
              <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => setTab(t.key)} className={`rounded-full px-3 py-1.5 ${tab === t.key ? 'bg-primary' : 'bg-secondary'}`}>
                <Text className={`text-sm ${tab === t.key ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>
                  {t.label}
                  {t.key === 'followups' && counts?.dueNow ? ` · ${counts.dueNow}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input placeholder="Search name, pincode or city" value={search} onChangeText={setSearch} onSubmitEditing={() => void load()} returnKeyType="search" />
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
                <Text>{tab === 'active' ? 'No customers in your queue.' : tab === 'followups' ? 'No follow-ups scheduled.' : 'No history yet.'}</Text>
                <Muted>{tab === 'active' ? 'New customers appear here when the Admin allocates a calling list to you.' : tab === 'followups' ? 'Outcomes marked "follow-up" show here with their due time.' : 'Declined, completed and suppressed customers move here — read-only, with the full trail.'}</Muted>
              </Card>
            )
          }
          renderItem={({ item }) => {
            const due = item.nextFollowUpAt ? new Date(item.nextFollowUpAt).getTime() : null;
            return (
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(telecaller)/record', params: { id: item.id } })}>
                <Card className="gap-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-medium">{item.fullName}</Text>
                    <Badge label={item.interactionStatus.replace('_', ' ')} variant={STATUS_VARIANT[item.interactionStatus] ?? 'secondary'} />
                  </View>
                  <Muted>
                    {item.mobileMasked} · {item.pincode} · {item.location}
                  </Muted>
                  {due !== null ? <Badge label={`${due <= now ? 'Due now' : 'Follow up'} · ${formatDateTime(item.nextFollowUpAt)}`} variant={due <= now ? 'destructive' : 'warning'} /> : null}
                  {item.lastOutcome ? <Muted>Last: {item.lastOutcome.outcome.replace('_', ' ').toLowerCase()}{item.lastOutcome.remarks ? ` — ${item.lastOutcome.remarks}` : ''}</Muted> : null}
                  {item.suppressed ? <Badge label="Do not contact" variant="destructive" /> : null}
                  {item.hiddenAt ? <Muted>Hidden {formatDateTime(item.hiddenAt)} · {item.hiddenReason ?? ''}</Muted> : null}
                </Card>
              </Pressable>
            );
          }}
        />
      </Screen>
    </>
  );
}
