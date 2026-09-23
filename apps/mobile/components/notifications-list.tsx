import { ApiClientError, formatDateTime } from '@kbs/shared';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface Row {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  deepLink: { entityType: string; entityId: string } | null;
}
type Area = 'advisor' | 'manager' | 'telecaller';

/** Screen for a notification target in each mobile role area; anything else just stays in the list. */
function screenFor(area: Area, entityType: string): string | null {
  const map: Record<Area, Record<string, string>> = {
    advisor: { Lead: '/(advisor)/lead', PayoutRequest: '/(advisor)/payout-request' },
    manager: { PayoutRequest: '/(manager)/payout-request', User: '/(manager)/telecaller' },
    telecaller: { CallingRecord: '/(telecaller)/record' },
  };
  return map[area][entityType] ?? null;
}

/**
 * F-701 S28 notification centre. Tapping an item asks the API to re-check access first (REQ-19 §19.2), then opens the
 * record; a record the user can no longer see shows a notice instead of content.
 */
export function NotificationsScreen({ area }: { area: Area }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api.get<Row[]>('/notifications?pageSize=50');
      setRows(r.data);
      const meta = r.meta as { unread?: number };
      setUnread(typeof meta.unread === 'number' ? meta.unread : 0);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load notifications.');
    }
  }, []);
  if (rows === null && !error) void load();
  const open = async (n: Row) => {
    try {
      const t = (
        await api.get<{ entityType: string | null; entityId: string | null }>(
          `/notifications/${n.id}/target`,
        )
      ).data;
      setRows(
        (r) =>
          r?.map((x) =>
            x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x,
          ) ?? r,
      );
      setUnread((u) => (n.readAt ? u : Math.max(0, u - 1)));
      const path = t.entityType && t.entityId ? screenFor(area, t.entityType) : null;
      if (path && t.entityId) router.push({ pathname: path as never, params: { id: t.entityId } });
    } catch (e) {
      setError(
        e instanceof ApiClientError && e.status === 404
          ? 'You no longer have access to this item.'
          : 'Could not open this item.',
      );
    }
  };
  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-3 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Button title="← Back" variant="ghost" onPress={() => router.back()} />
        <View className="flex-row items-center justify-between">
          <Heading>Notifications</Heading>
          <Button
            title="Mark all read"
            variant="outline"
            disabled={!unread}
            onPress={async () => {
              await api.post('/notifications/read-all', {});
              setRows(
                (r) => r?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? r,
              );
              setUnread(0);
            }}
          />
        </View>
        <ErrorText>{error}</ErrorText>
        {rows === null ? <Muted>Loading…</Muted> : null}
        {rows?.length === 0 ? <Muted>No notifications yet.</Muted> : null}
        {rows?.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={`${n.readAt ? '' : 'Unread. '}${n.title}`}
            onPress={() => void open(n)}
          >
            <Card className={`gap-1 ${n.readAt ? '' : 'border-primary'}`}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-medium">{n.title}</Text>
                {n.readAt ? null : <View className="h-2 w-2 rounded-full bg-primary" />}
              </View>
              <Muted>{n.body}</Muted>
              <Muted>{formatDateTime(n.createdAt)}</Muted>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
