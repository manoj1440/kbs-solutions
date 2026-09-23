import { ApiClientError, formatInr, type LeadStatusRow } from '@kbs/shared';
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
  IconCircle,
  type IconName,
  ListItem,
  Muted,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

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

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Icon for an activity row — picked from the notification title only (display hint, no business meaning). */
function activityIcon(title: string): {
  icon: IconName;
  tone: 'success' | 'info' | 'warning' | 'default' | 'gold';
} {
  const t = title.toLowerCase();
  if (t.includes('payout') || t.includes('paid') || t.includes('payment'))
    return { icon: 'wallet', tone: 'gold' };
  if (t.includes('approv') || t.includes('activ'))
    return { icon: 'checkmark-circle', tone: 'success' };
  if (t.includes('mis') || t.includes('status') || t.includes('bank'))
    return { icon: 'sync', tone: 'info' };
  if (t.includes('follow') || t.includes('remind') || t.includes('pending'))
    return { icon: 'alarm', tone: 'warning' };
  return { icon: 'notifications', tone: 'default' };
}

const QUICK: { icon: IconName; label: string; href: string; tone: readonly string[] }[] = [
  { icon: 'add-circle', label: 'New lead', href: '/(advisor)/cards', tone: ['#16329E', '#3D5AFE'] },
  { icon: 'search', label: 'Find cards', href: '/(advisor)/cards', tone: ['#0E6B5E', '#22B59A'] },
  { icon: 'alarm', label: 'Follow-ups', href: '/(advisor)/pending', tone: ['#8A4B0C', '#E39B1B'] },
  { icon: 'wallet', label: 'Earnings', href: '/(advisor)/payouts', tone: ['#4B2A99', '#8B6CF6'] },
];

/** S09 Home dashboard — real counts from /leads, earnings from /payouts/me/ledger, activity from /notifications. */
export default function AdvisorHome() {
  const { user } = useSession();
  const [leads, setLeads] = useState<LeadStatusRow[]>([]);
  const [totals, setTotals] = useState<LedgerTotals['totals'] | null>(null);
  const [notes, setNotes] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, p, n] = await Promise.all([
        api.get<LeadStatusRow[]>('/leads?pageSize=100'),
        api.get<LedgerTotals>('/payouts/me/ledger'),
        api.get<NotificationRow[]>('/notifications?pageSize=10'),
      ]);
      setLeads(l.data);
      setTotals(p.data.totals);
      setNotes(n.data);
      const meta = n.meta as Record<string, unknown>;
      setUnread(typeof meta.unread === 'number' ? meta.unread : 0);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const approved = leads.filter((l) => l.decision.display === 'Approved').length;
  const applications = leads.filter(
    (l) => l.matched || l.bankApplicationNo || l.bankApplicationReference,
  ).length;
  const earnings = totals?.eligible.amountInr ?? 0;
  const available = totals?.available.amountInr ?? 0;
  const paid = totals?.paid.amountInr ?? 0;
  const name = user?.fullName ?? '';
  const first = name.split(' ')[0] || 'Advisor';
  const funnel: { label: string; value: number; icon: IconName }[] = [
    { label: 'Leads', value: leads.length, icon: 'people' },
    { label: 'Applications', value: applications, icon: 'document-text' },
    { label: 'Approved', value: approved, icon: 'checkmark-done' },
  ];

  return (
    <Screen
      inset="none"
      statusBar="light"
      scroll
      padded={false}
      refreshing={loading && loaded}
      onRefresh={() => void load()}
      contentClassName="pt-0"
    >
      <HeroHeader className="pb-16">
        <View className="flex-row items-center justify-between">
          <PressableScale
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(advisor)/profile' as never)}
            className="flex-row items-center gap-3"
          >
            <Avatar name={name || 'Advisor'} size={46} light />
            <View>
              <RNText className="font-medium text-[13px] text-white/70">{greeting()},</RNText>
              <RNText className="font-bold text-[20px] text-white">{first}</RNText>
            </View>
          </PressableScale>
          <IconButton
            icon="notifications-outline"
            label="Notifications"
            tone="light"
            badge={unread}
            onPress={() => router.push('/(advisor)/notifications' as never)}
          />
        </View>
        <View className="mt-7">
          <RNText className="font-semibold text-[12px] uppercase tracking-[1.4px] text-white/60">
            Total eligible earnings
          </RNText>
          {loaded ? (
            <Appear>
              <RNText
                accessibilityLabel={`Total eligible earnings ${formatInr(earnings, { decimals: 0 })}`}
                className="mt-1 font-extrabold text-[40px] tracking-tight text-white"
              >
                {formatInr(earnings, { decimals: 0 })}
              </RNText>
            </Appear>
          ) : (
            <Skeleton className="mt-2 h-10 w-44 bg-white/20" />
          )}
          <View className="mt-3 flex-row gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-gold" />
              <RNText className="font-semibold text-[12px] text-white">
                Available {formatInr(available, { decimals: 0 })}
              </RNText>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
              <RNText className="font-semibold text-[12px] text-white">
                Paid {formatInr(paid, { decimals: 0 })}
              </RNText>
            </View>
          </View>
        </View>
      </HeroHeader>

      <View className="-mt-12 gap-5 px-4">
        <Appear index={1}>
          <View className="flex-row rounded-3xl bg-white p-4" style={shadow.lg}>
            {funnel.map((f, i) => (
              <PressableScale
                key={f.label}
                accessibilityLabel={`${f.label}: ${f.value}`}
                onPress={() => router.push('/(advisor)/leads' as never)}
                className={`flex-1 items-center gap-1 ${i ? 'border-l border-line' : ''}`}
              >
                <IconCircle icon={f.icon} tone={i === 2 ? 'success' : 'default'} size={34} />
                {loaded ? (
                  <RNText className="mt-1 font-extrabold text-[22px] text-ink">{f.value}</RNText>
                ) : (
                  <Skeleton className="mt-1 h-6 w-8" />
                )}
                <Muted className="text-[12px]">{f.label}</Muted>
              </PressableScale>
            ))}
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
                <View
                  className="h-[60px] w-[60px] items-center justify-center rounded-[20px]"
                  style={[gradientStyle(q.tone, 135), shadow.md]}
                >
                  <Icon name={q.icon} size={26} color={colors.white} />
                </View>
                <RNText className="text-center font-semibold text-[12px] text-ink">
                  {q.label}
                </RNText>
              </PressableScale>
            ))}
          </View>
        </Appear>

        <Appear index={3}>
          <PressableScale
            onPress={() => router.push('/(advisor)/cards' as never)}
            className="overflow-hidden rounded-3xl p-5"
            style={[gradientStyle(gradients.gold, 125), shadow.gold]}
          >
            <View
              pointerEvents="none"
              className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20"
            />
            <View className="flex-row items-center gap-4">
              <View className="flex-1">
                <RNText className="font-extrabold text-[17px] text-ink">Grow your earnings</RNText>
                <RNText className="mt-1 font-medium text-[13px] leading-[19px] text-ink/75">
                  Pick the right card for your next customer and share the application link in
                  seconds.
                </RNText>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-full bg-ink">
                <Icon name="arrow-forward" size={22} color={colors.gold} />
              </View>
            </View>
          </PressableScale>
        </Appear>

        <Appear index={4} className="gap-3">
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
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                    <View className="flex-1 gap-2">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </View>
                  </View>
                ))}
              </View>
            ) : notes.length === 0 ? (
              <View className="items-center py-6">
                <Text className="font-semibold">No activity yet</Text>
                <Muted className="mt-1 text-center">
                  Create your first lead from Card Search — updates show up here.
                </Muted>
              </View>
            ) : (
              notes.slice(0, 5).map((n, i, arr) => {
                const a = activityIcon(n.title);
                return (
                  <ListItem
                    key={n.id}
                    icon={a.icon}
                    iconTone={a.tone}
                    title={n.title}
                    subtitle={n.body}
                    last={i === arr.length - 1}
                    right={<Muted className="text-[11px]">{ago(n.createdAt)}</Muted>}
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
