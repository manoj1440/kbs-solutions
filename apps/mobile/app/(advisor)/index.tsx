import {
  ApiClientError,
  decisionBucket,
  formatInr,
  type LeadStatusRow,
  type PendingAction,
} from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import {
  Appear,
  Avatar,
  Icon,
  Card,
  ErrorState,
  HeroHeader,
  IconButton,
  type IconName,
  ListItem,
  Muted,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { ago, TodayCard, todayLabel } from '@/components/today';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import { withBank } from '@/lib/cards';

interface LedgerTotals {
  totals: Record<
    | 'eligible'
    | 'available'
    | 'requested'
    | 'approvedUnpaid'
    | 'paid'
    | 'underReview'
    | 'pendingHold',
    { count: number; amountInr: number }
  >;
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface Draft {
  id: string;
  card: { name: string; bank: { code?: string; displayName: string } } | null;
  customer: string | null;
}

/** Icon for an activity row — picked from the notification title only (display hint, no business meaning). */
function activityIcon(title: string): IconName {
  const t = title.toLowerCase();
  if (t.includes('payout') || t.includes('paid') || t.includes('payment')) return 'wallet-outline';
  if (t.includes('approv') || t.includes('activ')) return 'checkmark-circle-outline';
  if (t.includes('mis') || t.includes('status') || t.includes('bank')) return 'sync-outline';
  if (t.includes('follow') || t.includes('remind') || t.includes('pending')) return 'alarm-outline';
  return 'notifications-outline';
}

const QUICK: { icon: IconName; label: string; href: string }[] = [
  { icon: 'add', label: 'New lead', href: '/(advisor)/cards' },
  { icon: 'search-outline', label: 'Find cards', href: '/(advisor)/cards' },
  { icon: 'alarm-outline', label: 'Follow-ups', href: '/(advisor)/pending' },
  { icon: 'wallet-outline', label: 'Earnings', href: '/(advisor)/payouts' },
];

/** S09 Home dashboard — real counts from /leads, earnings from /payouts/me/ledger, activity from /notifications. */
export default function AdvisorHome() {
  const { user } = useSession();
  const [leads, setLeads] = useState<LeadStatusRow[]>([]);
  /** All of the Advisor's leads (the list above is one page of at most 100). */
  const [leadTotal, setLeadTotal] = useState(0);
  const [totals, setTotals] = useState<LedgerTotals['totals'] | null>(null);
  const [notes, setNotes] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState<PendingAction[] | null>([]);
  const [drafts, setDrafts] = useState<Draft[] | null>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // F-815 Today: own lists, so a failure shows on its row instead of blanking the home.
    const agenda = Promise.allSettled([
      api.get<PendingAction[]>('/pending-actions'),
      api.get<Draft[]>('/leads/drafts'),
    ]);
    try {
      const [l, p, n] = await Promise.all([
        api.get<LeadStatusRow[]>('/leads?pageSize=100'),
        api.get<LedgerTotals>('/payouts/me/ledger'),
        api.get<NotificationRow[]>('/notifications?pageSize=10'),
      ]);
      setLeads(l.data);
      setLeadTotal(typeof l.meta.total === 'number' ? l.meta.total : l.data.length);
      setTotals(p.data.totals);
      setNotes(n.data);
      const meta = n.meta as Record<string, unknown>;
      setUnread(typeof meta.unread === 'number' ? meta.unread : 0);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the dashboard.');
    }
    const [pa, dr] = await agenda;
    setPending(pa.status === 'fulfilled' ? pa.value.data.filter((a) => !a.doneAt) : null);
    setDrafts(dr.status === 'fulfilled' ? dr.value.data : null);
    setLoading(false);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const approved = leads.filter((l) => decisionBucket(l.decision.display) === 'approved').length; // banks write Approve / Approved / APPROVED
  const applications = leads.filter(
    (l) => l.matched || l.bankApplicationNo || l.bankApplicationReference,
  ).length;
  // rate-free payouts: earnings = what KBS actually paid; claimable cards are counted, never priced
  const earnings = totals?.paid.amountInr ?? 0;
  const claimable = totals?.available.count ?? 0;
  const inProgress = (totals?.requested.count ?? 0) + (totals?.approvedUnpaid.count ?? 0);
  const name = user?.fullName ?? '';
  const funnel: { label: string; value: number }[] = [
    { label: 'Leads', value: Math.max(leadTotal, leads.length) },
    { label: 'Applications', value: applications },
    { label: 'Approved', value: approved },
  ];

  return (
    <Screen
      inset="none"
      scroll
      padded={false}
      refreshing={loading && loaded}
      onRefresh={() => void load()}
      contentClassName="pt-0"
    >
      <HeroHeader>
        <View className="flex-row items-center justify-between">
          <PressableScale
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(advisor)/profile' as never)}
            className="flex-row items-center gap-3"
          >
            <Avatar name={name || 'Advisor'} size={40} />
            <View>
              <RNText accessibilityRole="header" className="font-medium text-lg text-ink">
                {todayLabel()}
              </RNText>
              <RNText className="font-normal text-sm text-[#737373]">{name || 'Advisor'}</RNText>
            </View>
          </PressableScale>
          <IconButton
            icon="notifications-outline"
            label="Notifications"
            badge={unread}
            onPress={() => router.push('/(advisor)/notifications' as never)}
          />
        </View>
      </HeroHeader>

      <View className="gap-5 px-4 pt-4">
        <Appear index={1}>
          <View className="rounded-xl border border-line bg-white p-4">
            <RNText className="font-normal text-sm text-[#525252]">Total earnings</RNText>
            {loaded ? (
              <RNText
                accessibilityLabel={`Total earnings ${formatInr(earnings)}`}
                className="mt-1 font-medium text-3xl text-gold tabular-nums"
              >
                {formatInr(earnings)}
              </RNText>
            ) : (
              <Skeleton className="mt-2 h-9 w-44" />
            )}
            <View className="mt-3 flex-row gap-4">
              <View className="flex-row items-center gap-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-orange" />
                <RNText className="font-normal text-sm text-[#525252] tabular-nums">
                  {claimable} card{claimable === 1 ? '' : 's'} to claim
                </RNText>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-teal" />
                <RNText className="font-normal text-sm text-[#525252] tabular-nums">
                  {inProgress} in progress
                </RNText>
              </View>
            </View>
            <View className="mt-4 flex-row border-t border-line pt-3">
              {funnel.map((f, i) => (
                <PressableScale
                  key={f.label}
                  accessibilityLabel={`${f.label}: ${f.value}`}
                  onPress={() => router.push('/(advisor)/leads' as never)}
                  className={`flex-1 gap-0.5 ${i ? 'border-l border-line pl-3' : ''}`}
                >
                  {loaded ? (
                    <RNText className="font-medium text-xl text-ink tabular-nums">{f.value}</RNText>
                  ) : (
                    <Skeleton className="h-7 w-8" />
                  )}
                  <Muted className="text-xs">{f.label}</Muted>
                </PressableScale>
              ))}
            </View>
          </View>
        </Appear>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <Appear index={2}>
          <View className="flex-row justify-between">
            {QUICK.map((q) => (
              <PressableScale
                key={q.label}
                accessibilityLabel={q.label}
                onPress={() => router.push(q.href as never)}
                className="w-[23%] items-center gap-2"
              >
                <View className="h-12 w-12 items-center justify-center rounded-lg border border-line bg-white">
                  <Icon name={q.icon} size={18} color={colors.ink} />
                </View>
                <RNText className="text-center font-medium text-xs text-ink">{q.label}</RNText>
              </PressableScale>
            ))}
          </View>
        </Appear>

        <Appear index={3}>
          <TodayCard
            loaded={loaded}
            caughtUp="No follow-ups, unfinished leads or payouts waiting on you."
            sections={[
              {
                key: 'pending',
                title: 'Follow-ups to do',
                icon: 'alarm',
                tone: 'warning',
                count: pending?.length ?? null,
                empty: 'Nothing pending on your leads',
                rows: (pending ?? []).slice(0, 3).map((a) => ({
                  key: a.id,
                  title: a.whatToDo,
                  subtitle: [a.customer, a.issuer].filter(Boolean).join(' · '),
                  onPress: () =>
                    router.push({ pathname: '/(advisor)/lead', params: { id: a.leadId } }),
                })),
                seeAll: pending?.length
                  ? {
                      label: 'All pending actions',
                      onPress: () => router.push('/(advisor)/pending' as never),
                    }
                  : undefined,
              },
              {
                key: 'drafts',
                title: 'Leads to finish',
                icon: 'create-outline',
                tone: 'default',
                count: drafts?.length ?? null,
                empty: 'No unfinished leads',
                rows: (drafts ?? []).slice(0, 3).map((d) => ({
                  key: d.id,
                  title: d.customer || 'Customer not added yet',
                  subtitle: d.card ? withBank(d.card.bank, d.card.name, ' · ') : null,
                  onPress: () =>
                    router.push({ pathname: '/(advisor)/lead-new', params: { draftId: d.id } }),
                })),
                seeAll: drafts?.length
                  ? { label: 'My leads', onPress: () => router.push('/(advisor)/leads' as never) }
                  : undefined,
              },
              {
                key: 'claim',
                title: 'Ready to claim',
                icon: 'wallet',
                tone: 'gold',
                count: totals ? totals.available.count : null,
                empty: 'Nothing to claim yet',
                rows: claimable
                  ? [
                      {
                        key: 'available',
                        title: `Request payout for ${claimable} activated card${claimable === 1 ? '' : 's'}`,
                        subtitle: 'KBS decides the amount; you see it once paid',
                        onPress: () => router.push('/(advisor)/payouts' as never),
                      },
                    ]
                  : [],
              },
            ]}
          />
        </Appear>

        <Appear index={4}>
          <PressableScale
            onPress={() => router.push('/(advisor)/cards' as never)}
            className="rounded-xl border border-line bg-white p-4"
          >
            <View className="flex-row items-center gap-4">
              <View className="flex-1">
                <RNText className="font-medium text-base text-ink">
                  Find a card for a customer
                </RNText>
                <RNText className="mt-1 font-normal text-sm text-[#525252]">
                  Pick the right card for your next customer and share the application link
                </RNText>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.subtle} />
            </View>
          </PressableScale>
        </Appear>

        <Appear index={5} className="gap-3">
          <SectionHeader
            title="Recent activity"
            action="See all"
            onAction={() => router.push('/(advisor)/notifications' as never)}
          />
          <Card className="px-4 py-1">
            {!loaded ? (
              <View className="gap-3 py-3">
                {[0, 1, 2].map((i) => (
                  <View key={i} className="flex-row items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <View className="flex-1 gap-2">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </View>
                  </View>
                ))}
              </View>
            ) : notes.length === 0 ? (
              <View className="items-center py-6">
                <Text className="font-medium">No activity yet</Text>
                <Muted className="mt-1 text-center">
                  Create your first lead from Card Search — updates show up here.
                </Muted>
              </View>
            ) : (
              notes.slice(0, 5).map((n, i, arr) => {
                return (
                  <ListItem
                    key={n.id}
                    icon={activityIcon(n.title)}
                    iconTone="secondary"
                    title={n.title}
                    subtitle={n.body}
                    last={i === arr.length - 1}
                    right={<Muted className="text-xs">{ago(n.createdAt)}</Muted>}
                    chevron={false}
                  />
                );
              })
            )}
          </Card>
        </Appear>
      </View>
    </Screen>
  );
}
