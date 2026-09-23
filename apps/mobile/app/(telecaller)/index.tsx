import { ApiClientError, type CallingQueueRow, formatDateTime, type QueueTab } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text as RNText, View } from 'react-native';

import { greeting, HeroTile, humanize } from '@/components/team';
import {
  Appear,
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  HeroHeader,
  Icon,
  IconButton,
  type IconName,
  Input,
  Muted,
  PressableScale,
  Screen,
  Segmented,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

type Counts = { active: number; followups: number; dueNow: number; hidden: number };
const TABS: { key: QueueTab; label: string }[] = [
  { key: 'active', label: 'Queue' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'hidden', label: 'History' },
];

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'unknown'
> = {
  UNTOUCHED: 'secondary',
  FOLLOW_UP: 'warning',
  INTERESTED: 'info',
  LINK_SHARED: 'success',
  DECLINED: 'unknown',
  COMPLETED: 'success',
  UNREACHABLE: 'unknown',
};

const EMPTY: Record<QueueTab, { icon: IconName; title: string; body: string }> = {
  active: {
    icon: 'call-outline',
    title: 'No customers in your queue.',
    body: 'New customers appear here when the Admin allocates a calling list to you.',
  },
  followups: {
    icon: 'alarm-outline',
    title: 'No follow-ups scheduled.',
    body: 'Outcomes marked "follow-up" show here with their due time.',
  },
  hidden: {
    icon: 'archive-outline',
    title: 'No history yet.',
    body: 'Declined, completed and suppressed customers move here — read-only, with the full trail.',
  },
};

function RecordCard({ item, now, index }: { item: CallingQueueRow; now: number; index: number }) {
  const due = item.nextFollowUpAt ? new Date(item.nextFollowUpAt).getTime() : null;
  const dueNow = due !== null && due <= now;
  return (
    <Appear index={index}>
      <Card
        accessibilityLabel={`Open ${item.fullName}${dueNow ? ', follow-up due now' : ''}`}
        onPress={() => router.push({ pathname: '/(telecaller)/record', params: { id: item.id } })}
        className={`gap-3 ${dueNow ? 'border-[#F5C2BE] bg-[#FFFBFA]' : ''}`}
      >
        {dueNow ? (
          <View className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-[#E5484D]" />
        ) : null}
        <View className="flex-row items-center gap-3">
          <Avatar name={item.fullName} size={46} />
          <View className="flex-1">
            <Text numberOfLines={1} className="font-bold text-[15px]">
              {item.fullName}
            </Text>
            <Muted numberOfLines={1} className="text-[12px]">
              {item.mobileMasked}
            </Muted>
          </View>
          <View
            className={`h-10 w-10 items-center justify-center rounded-full ${item.suppressed || item.hiddenAt ? 'bg-[#EEF0F4]' : 'bg-[#E6F4EC]'}`}
          >
            <Icon
              name={item.suppressed ? 'call-outline' : 'call'}
              size={18}
              color={item.suppressed || item.hiddenAt ? colors.subtle : colors.success}
            />
          </View>
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge
            label={humanize(item.interactionStatus)}
            variant={STATUS_VARIANT[item.interactionStatus] ?? 'secondary'}
            dot
            size="sm"
          />
          <View className="flex-row items-center gap-1">
            <Icon name="location-outline" size={12} color={colors.subtle} />
            <Muted numberOfLines={1} className="text-[12px]">
              {item.pincode} · {item.location}
            </Muted>
          </View>
        </View>
        {due !== null ? (
          <Badge
            label={`${dueNow ? 'Due now' : 'Follow up'} · ${formatDateTime(item.nextFollowUpAt)}`}
            variant={dueNow ? 'destructive' : 'warning'}
            icon={dueNow ? 'alarm' : 'alarm-outline'}
            solid={dueNow}
          />
        ) : null}
        {item.lastOutcome ? (
          <View className="flex-row items-start gap-1.5 rounded-xl bg-[#F6F8FC] px-3 py-2">
            <Icon
              name="chatbubble-ellipses-outline"
              size={13}
              color={colors.subtle}
              style={{ marginTop: 2 }}
            />
            <Muted numberOfLines={2} className="flex-1 text-[12px]">
              Last: {item.lastOutcome.outcome.replace('_', ' ').toLowerCase()}
              {item.lastOutcome.remarks ? ` — ${item.lastOutcome.remarks}` : ''}
            </Muted>
          </View>
        ) : null}
        {item.suppressed ? (
          <Badge label="Do not contact" variant="destructive" icon="hand-left" />
        ) : null}
        {item.hiddenAt ? (
          <Muted className="text-[12px]">
            Hidden {formatDateTime(item.hiddenAt)} · {item.hiddenReason ?? ''}
          </Muted>
        ) : null}
      </Card>
    </Appear>
  );
}

/** F-307: My Calling Queue — active / follow-ups / history(hidden). Mobiles are masked; capture is blocked by the route policy (F-302). */
export default function TelecallerHome() {
  const { user } = useSession();
  const [tab, setTab] = useState<QueueTab>('active');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CallingQueueRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(0);
  const [loadedTab, setLoadedTab] = useState<QueueTab | null>(null);

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
      setError(
        e instanceof ApiClientError
          ? e.message
          : 'Could not load your queue. Check your connection and pull to refresh.',
      );
    } finally {
      setLoading(false);
      setLoadedTab(tab);
    }
  }, [tab, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ready = loadedTab === tab;
  const first = (user?.fullName ?? '').split(' ')[0] || 'there';
  const empty = EMPTY[tab];

  return (
    <Screen inset="none" statusBar="light" padded={false} className="pt-0">
      <FlatList
        data={ready ? rows : []}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-3 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={loading && ready}
            onRefresh={() => void load()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <View className="gap-4">
            <HeroHeader className="pb-6">
              <View className="flex-row items-center justify-between">
                <PressableScale
                  accessibilityLabel="Open profile"
                  onPress={() => router.push('/(telecaller)/profile' as never)}
                  className="flex-1 flex-row items-center gap-3"
                >
                  <Avatar name={user?.fullName || 'Telecaller'} size={46} light />
                  <View className="flex-1">
                    <RNText className="font-medium text-[13px] text-white/70">{greeting()},</RNText>
                    <RNText numberOfLines={1} className="font-bold text-[20px] text-white">
                      {first}
                    </RNText>
                  </View>
                </PressableScale>
                <IconButton
                  icon="notifications-outline"
                  label="Notifications"
                  tone="light"
                  onPress={() => router.push('/(telecaller)/notifications' as never)}
                />
              </View>
              <View className="mt-6 flex-row items-end justify-between">
                <View>
                  <RNText className="font-semibold text-[12px] uppercase tracking-[1.4px] text-white/60">
                    Due now
                  </RNText>
                  <RNText
                    accessibilityLabel={`${counts?.dueNow ?? 0} follow-ups due now`}
                    className="font-extrabold text-[44px] leading-[50px] tracking-tight text-white"
                  >
                    {counts ? counts.dueNow : '–'}
                  </RNText>
                </View>
                {counts?.dueNow ? (
                  <PressableScale
                    accessibilityLabel="Show follow-ups"
                    onPress={() => setTab('followups')}
                    className="mb-2 flex-row items-center gap-1.5 rounded-full bg-[#E5484D] px-3.5 py-2"
                  >
                    <Icon name="alarm" size={14} color="#fff" />
                    <RNText className="font-bold text-[12px] text-white">Call back now</RNText>
                  </PressableScale>
                ) : (
                  <View className="mb-2 flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                    <View className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
                    <RNText className="font-semibold text-[12px] text-white">
                      Nothing overdue
                    </RNText>
                  </View>
                )}
              </View>
              <View className="mt-4 flex-row gap-2">
                <HeroTile
                  label="Active"
                  value={counts ? counts.active : '–'}
                  meta="in your queue"
                />
                <HeroTile
                  label="Follow-ups"
                  value={counts ? counts.followups : '–'}
                  meta="scheduled"
                />
                <HeroTile label="History" value={counts ? counts.hidden : '–'} meta="read-only" />
              </View>
            </HeroHeader>
            <View className="gap-3 px-4">
              <Segmented<QueueTab>
                options={TABS.map((t) => ({
                  key: t.key,
                  label: t.label,
                  count: counts
                    ? t.key === 'active'
                      ? counts.active
                      : t.key === 'followups'
                        ? counts.followups
                        : counts.hidden
                    : undefined,
                }))}
                value={tab}
                onChange={setTab}
              />
              <Input
                icon="search"
                placeholder="Search name, pincode or city"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => void load()}
                returnKeyType="search"
              />
              {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
              {!ready ? <SkeletonList rows={3} /> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          ready && !error ? (
            <View className="px-4">
              <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View className="px-4">
            <RecordCard item={item} now={now} index={index} />
          </View>
        )}
      />
    </Screen>
  );
}
