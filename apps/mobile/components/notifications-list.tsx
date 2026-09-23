import { ApiClientError, formatDateTime } from '@kbs/shared';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  AppBar,
  Appear,
  Button,
  EmptyState,
  ErrorState,
  ErrorText,
  Icon,
  IconCircle,
  type IconName,
  Muted,
  Overline,
  PressableScale,
  Screen,
  SkeletonList,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, shadow, type Tone } from '@/lib/theme';

interface Row {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  deepLink: { entityType: string; entityId: string } | null;
}
type Area = 'advisor' | 'manager' | 'telecaller';

/** Display-only icon per linked entity type (falls back to the title for unlinked notices). No business meaning. */
function visual(n: Row): { icon: IconName; tone: Tone | 'gold' } {
  switch (n.deepLink?.entityType) {
    case 'Lead':
      return { icon: 'document-text', tone: 'default' };
    case 'PayoutRequest':
      return { icon: 'wallet', tone: 'gold' };
    case 'CallingRecord':
      return { icon: 'call', tone: 'success' };
    case 'User':
      return { icon: 'person', tone: 'info' };
  }
  const t = n.title.toLowerCase();
  if (t.includes('payout') || t.includes('paid')) return { icon: 'wallet', tone: 'gold' };
  if (t.includes('mis') || t.includes('bank')) return { icon: 'sync', tone: 'info' };
  return { icon: 'notifications', tone: 'secondary' };
}

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
  const newRows = rows?.filter((n) => !n.readAt) ?? [];
  const oldRows = rows?.filter((n) => n.readAt) ?? [];
  const item = (n: Row, i: number) => {
    const v = visual(n);
    return (
      <Appear key={n.id} index={i}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${n.readAt ? '' : 'Unread. '}${n.title}`}
          onPress={() => void open(n)}
          scaleTo={0.985}
          className={`flex-row gap-3 rounded-2xl p-4 ${n.readAt ? 'border border-line bg-white' : 'border border-[#D9E0FF] bg-[#F3F6FF]'}`}
          style={n.readAt ? undefined : shadow.sm}
        >
          <IconCircle icon={v.icon} tone={v.tone} size={42} />
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-start gap-2">
              <RNText
                numberOfLines={2}
                className={`flex-1 text-[15px] leading-[20px] text-ink ${n.readAt ? 'font-semibold' : 'font-bold'}`}
              >
                {n.title}
              </RNText>
              {n.readAt ? null : (
                <View
                  accessibilityElementsHidden
                  className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand"
                />
              )}
            </View>
            <Muted numberOfLines={3}>{n.body}</Muted>
            <View className="mt-1 flex-row items-center gap-1">
              <Icon name="time-outline" size={12} color={colors.subtle} />
              <RNText className="font-medium text-[12px] text-[#8A93A6]">
                {formatDateTime(n.createdAt)}
              </RNText>
            </View>
          </View>
        </PressableScale>
      </Appear>
    );
  };
  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      header={
        <AppBar
          title="Notifications"
          subtitle={rows ? (unread ? `${unread} unread` : 'All caught up') : undefined}
          right={
            <Button
              title="Mark all read"
              size="sm"
              variant="secondary"
              icon="checkmark-done"
              disabled={!unread}
              onPress={async () => {
                await api.post('/notifications/read-all', {});
                setRows(
                  (r) =>
                    r?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? r,
                );
                setUnread(0);
              }}
            />
          }
        />
      }
    >
      {error && rows === null ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
      {rows === null && !error ? <SkeletonList rows={5} /> : null}
      {rows?.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications yet."
          body="Updates about your work will appear here."
        />
      ) : null}
      {newRows.length ? (
        <View className="gap-2.5">
          <Overline className="ml-1">New</Overline>
          {newRows.map(item)}
        </View>
      ) : null}
      {oldRows.length ? (
        <View className="gap-2.5">
          <Overline className="ml-1">Earlier</Overline>
          {oldRows.map((n, i) => item(n, newRows.length + i))}
        </View>
      ) : null}
    </Screen>
  );
}
