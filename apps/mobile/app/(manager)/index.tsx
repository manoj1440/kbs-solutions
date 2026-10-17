import { ApiClientError, formatInr, type MisFreshness, type PendingAction, type UserSummary } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text as RNText, View } from 'react-native';

import {
  HeroTile,
  humanize,
  type MetricLike,
  MetricTile,
  SourceTag,
  userStatusTone,
  greeting,
} from '@/components/team';
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
  Muted,
  PressableScale,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonList,
  Text,
} from '@/components/ui';
import { ago, TodayCard, todayLabel } from '@/components/today';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

type TeamUser = UserSummary & { lastLoginAt: string | null };
type M = MetricLike;
interface Summary {
  calling: { calls: { attempts: M; connected: M }; callbacks: { due: M }; shares: { total: M } };
  advisors: { leads: { created: M; misMatched: M }; payouts: { approvedUnpaid: M; paid: M } };
}

interface AwaitingRow {
  id: string;
  publicRef: string;
  advisor: { fullName: string };
  totalAmountInr: number;
}
interface CallerRow {
  id: string;
  fullName: string;
  queueSize: number;
  followUpsDue: number;
}

/** MIS older than this reads as stale (amber dot) — the point where the web MIS clock switches to a date. */
const MIS_STALE_DAYS = 7;

/** Hero meta line: where the number comes from, plus its denominator when there is one. */
function HeroMeta({ m }: { m: M }) {
  return (
    <View className="flex-row items-center gap-1">
      <SourceTag source={m.source} light />
      {m.denominator ? (
        <RNText className="font-medium text-[11px] text-white/60">
          · of {m.denominator.value}
        </RNText>
      ) : null}
    </View>
  );
}

/** F-815: how old the bank numbers are — one line per bank, amber when stale. Bank values come from MIS only. */
function MisFreshnessLine({ mis }: { mis: MisFreshness }) {
  const applied = mis.banks.filter((b) => b.lastAppliedAt);
  const none = mis.banks.length - applied.length;
  return (
    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 px-1">
      <Icon name="time-outline" size={14} color={colors.muted} />
      {applied.map((b) => {
        const stale = new Date(mis.asOf).getTime() - new Date(b.lastAppliedAt!).getTime() > MIS_STALE_DAYS * 86_400_000;
        return (
          <View key={b.bankCode} className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stale ? colors.warning : colors.success }} />
            <Muted className="text-[12px]">
              {b.bankName} MIS · {ago(b.lastAppliedAt!)}
            </Muted>
          </View>
        );
      })}
      {none ? (
        <Muted className="text-[12px]">
          {applied.length ? `+${none} bank${none === 1 ? '' : 's'} with no MIS yet` : 'No bank MIS applied yet'}
        </Muted>
      ) : null}
    </View>
  );
}

function TeamRow({ item, index }: { item: TeamUser; index: number }) {
  const tele = item.role === 'TELECALLER';
  const name = item.fullName || '(onboarding)';
  return (
    <Appear index={index}>
      <Card
        accessibilityLabel={`Open ${name}, ${humanize(item.role)}`}
        onPress={() =>
          router.push(
            tele
              ? { pathname: '/(manager)/telecaller', params: { id: item.id } }
              : { pathname: '/(manager)/advisor', params: { id: item.id } },
          )
        }
        className="flex-row items-center gap-3"
      >
        <Avatar name={item.fullName || '?'} size={46} />
        <View className="flex-1 gap-1">
          <Text numberOfLines={1} className="font-bold text-[15px]">
            {name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Badge
              label={humanize(item.role)}
              variant={tele ? 'info' : 'default'}
              icon={tele ? 'headset' : 'briefcase'}
              size="sm"
            />
            <Muted numberOfLines={1} className="text-[12px]">
              {item.mobileMasked}
              {item.employeeCode ? ` · ${item.employeeCode}` : ''}
            </Muted>
          </View>
        </View>
        <View className="items-end gap-2">
          <Badge
            label={humanize(item.status)}
            variant={userStatusTone(item.status)}
            dot
            size="sm"
          />
          <Icon name="chevron-forward" size={16} color={colors.subtle} />
        </View>
      </Card>
    </Appear>
  );
}

/** F-201 / F-702: Manager team overview — same numbers as the web Manager dashboard (one API), each labelled with its source. */
export default function ManagerHome() {
  const { user } = useSession();
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [awaiting, setAwaiting] = useState<{ rows: AwaitingRow[]; total: number } | null>(null);
  const [pending, setPending] = useState<PendingAction[] | null>(null);
  const [callers, setCallers] = useState<CallerRow[] | null>(null);
  const [mis, setMis] = useState<MisFreshness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // F-815 Today + MIS freshness: own lists, so a failure shows on its row instead of blanking the home.
    const extra = Promise.allSettled([
      api.get<AwaitingRow[]>('/payouts/requests?awaitingMe=true&pageSize=3'),
      api.get<PendingAction[]>('/pending-actions'),
      api.get<{ telecallers: CallerRow[] }>('/calling/team/overview'),
      api.get<MisFreshness>('/mis/freshness'),
    ]);
    try {
      const [r, d] = await Promise.all([
        api.get<TeamUser[]>('/users?pageSize=200'),
        api.get<Summary>('/dashboards/manager').catch(() => null),
      ]);
      setRows(r.data);
      setSummary(d?.data ?? null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your team.');
    }
    const [aw, pa, ov, mf] = await extra;
    setAwaiting(
      aw.status === 'fulfilled'
        ? { rows: aw.value.data, total: Number((aw.value.meta as { total?: number }).total ?? aw.value.data.length) }
        : null,
    );
    setPending(pa.status === 'fulfilled' ? pa.value.data.filter((a) => !a.doneAt) : null);
    setCallers(
      ov.status === 'fulfilled'
        ? ov.value.data.telecallers.filter((t) => t.followUpsDue > 0).sort((a, b) => b.followUpsDue - a.followUpsDue)
        : null,
    );
    setMis(mf.status === 'fulfilled' ? mf.value.data : null);
    setLoading(false);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const telecallers = rows.filter((u) => u.role === 'TELECALLER');
  const advisors = rows.filter((u) => u.role === 'ADVISOR');
  const team = [...telecallers, ...advisors];
  const name = user?.fullName ?? '';
  const first = name.split(' ')[0] || 'Manager';
  const s = summary;
  const heroTiles: [string, M | undefined, 'call' | 'call-outline' | 'alarm' | 'share-social'][] = [
    ['Call attempts', s?.calling.calls.attempts, 'call-outline'],
    ['Connected', s?.calling.calls.connected, 'call'],
    ['Callbacks due', s?.calling.callbacks.due, 'alarm'],
    ['Shares', s?.calling.shares.total, 'share-social'],
  ];

  return (
    <Screen inset="none" statusBar="light" padded={false} className="pt-0">
      <FlatList
        data={loaded ? team : []}
        keyExtractor={(u) => u.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-3 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={loading && loaded}
            onRefresh={() => void load()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        renderItem={({ item, index }) => (
          <View className="px-4">
            <TeamRow item={item} index={index} />
          </View>
        )}
        ListHeaderComponent={
          <>
            <HeroHeader className="pb-16">
              <View className="flex-row items-center justify-between">
                <PressableScale
                  accessibilityLabel="Open profile"
                  onPress={() => router.push('/(manager)/profile')}
                  className="flex-1 flex-row items-center gap-3"
                >
                  <Avatar name={name || 'Manager'} size={46} light />
                  <View className="flex-1">
                    <RNText className="font-medium text-[13px] text-white/70">{greeting()},</RNText>
                    <RNText numberOfLines={1} className="font-bold text-[20px] text-white">
                      {first}
                    </RNText>
                    <RNText className="font-medium text-[12px] text-white/60">{todayLabel()}</RNText>
                  </View>
                </PressableScale>
                <IconButton
                  icon="notifications-outline"
                  label="Notifications"
                  tone="light"
                  onPress={() => router.push('/(manager)/notifications' as never)}
                />
              </View>

              <View className="mt-6 flex-row items-center justify-between">
                <RNText className="font-semibold text-[12px] uppercase tracking-[1.4px] text-white/60">
                  Team calling activity
                </RNText>
                <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                  <Icon name="people" size={12} color={colors.gold} />
                  <RNText className="font-semibold text-[11px] text-white">
                    {telecallers.length} Telecallers · {advisors.length} Advisors
                  </RNText>
                </View>
              </View>
              <View className="mt-3 gap-2">
                {[0, 2].map((start) => (
                  <View key={start} className="flex-row gap-2">
                    {heroTiles.slice(start, start + 2).map(([label, m, icon]) =>
                      m ? (
                        <HeroTile
                          key={label}
                          label={label}
                          icon={icon}
                          accent={colors.gold}
                          value={m.value}
                          meta={<HeroMeta m={m} />}
                        />
                      ) : (
                        <View
                          key={label}
                          className="flex-1 rounded-2xl border border-white/15 bg-white/10 p-3"
                        >
                          <RNText className="font-semibold text-[11px] uppercase tracking-[0.8px] text-white/70">
                            {label}
                          </RNText>
                          {loaded ? (
                            <RNText className="mt-1.5 font-extrabold text-[26px] text-white/50">
                              —
                            </RNText>
                          ) : (
                            <Skeleton className="mt-2 h-7 w-12 bg-white/20" />
                          )}
                        </View>
                      ),
                    )}
                  </View>
                ))}
              </View>
            </HeroHeader>

            <View className="-mt-10 gap-5 px-4">
              <Appear index={1}>
                <TodayCard
                  light
                  loaded={loaded}
                  caughtUp="No payout approvals, pending actions or callbacks waiting on you."
                  sections={[
                    {
                      key: 'awaiting',
                      title: 'Payouts awaiting you',
                      icon: 'checkmark-done-circle',
                      tone: 'gold',
                      count: awaiting?.total ?? null,
                      empty: 'No payout request is waiting for your approval.',
                      rows: (awaiting?.rows ?? []).map((r) => ({
                        key: r.id,
                        title: r.advisor.fullName,
                        subtitle: r.publicRef,
                        right: formatInr(r.totalAmountInr, { decimals: 0 }),
                        onPress: () => router.push({ pathname: '/(manager)/payout-request', params: { id: r.id } }),
                      })),
                      seeAll: awaiting?.total
                        ? { label: 'All approvals', onPress: () => router.push('/(manager)/approvals') }
                        : undefined,
                    },
                    {
                      key: 'pending',
                      title: 'Pending actions',
                      icon: 'alarm',
                      tone: 'warning',
                      count: pending?.length ?? null,
                      empty: "Nothing pending on your team's leads.",
                      rows: (pending ?? []).slice(0, 3).map((a) => ({
                        key: a.id,
                        title: a.whatToDo,
                        subtitle: [a.customer, a.owner.name].filter(Boolean).join(' · '),
                        onPress: () => router.push({ pathname: '/(manager)/lead', params: { id: a.leadId } }),
                      })),
                    },
                    {
                      key: 'callbacks',
                      title: 'Callbacks due',
                      icon: 'call',
                      tone: 'info',
                      count: callers ? callers.reduce((n, t) => n + t.followUpsDue, 0) : null,
                      empty: 'No callbacks due for your team.',
                      rows: (callers ?? []).slice(0, 3).map((t) => ({
                        key: t.id,
                        title: t.fullName,
                        subtitle: `${t.queueSize} records held`,
                        right: `${t.followUpsDue} due`,
                        onPress: () => router.push({ pathname: '/(manager)/telecaller', params: { id: t.id } }),
                      })),
                    },
                  ]}
                />
              </Appear>

              {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

              {s ? (
                <Appear index={2} className="gap-3">
                  <SectionHeader
                    title="Advisor pipeline"
                    action="Advisors"
                    onAction={() => router.push('/(manager)/advisors')}
                  />
                  <View className="flex-row gap-3">
                    <MetricTile
                      className="flex-1"
                      label="Leads created"
                      m={s.advisors.leads.created}
                      icon="document-text"
                    />
                    <MetricTile
                      className="flex-1"
                      label="MIS matched"
                      m={s.advisors.leads.misMatched}
                      icon="git-compare"
                      tone="info"
                    />
                  </View>
                  <View className="flex-row gap-3">
                    <MetricTile
                      className="flex-1"
                      label="Approved, unpaid"
                      m={s.advisors.payouts.approvedUnpaid}
                      money
                      icon="hourglass"
                      tone="gold"
                    />
                    <MetricTile
                      className="flex-1"
                      label="Paid events"
                      m={s.advisors.payouts.paid}
                      money
                      icon="wallet"
                      tone="success"
                    />
                  </View>
                  {mis ? <MisFreshnessLine mis={mis} /> : null}
                </Appear>
              ) : null}

              <Appear index={3} className="gap-3">
                <SectionHeader
                  title={`My team${loaded ? ` · ${team.length}` : ''}`}
                  action="Create Telecaller"
                  onAction={() => router.push('/(manager)/create-telecaller')}
                />
                {!loaded ? (
                  <SkeletonList rows={3} />
                ) : team.length === 0 && !error ? (
                  <EmptyState
                    icon="people-outline"
                    title="No team members yet."
                    body="Create a Telecaller with a name and mobile number. Advisors join when they apply your Agent Code."
                    action="Create Telecaller"
                    onAction={() => router.push('/(manager)/create-telecaller')}
                  />
                ) : null}
              </Appear>
            </View>
          </>
        }
      />
    </Screen>
  );
}
