import {
  ApiClientError,
  type AdvisorTeamResponse,
  type AdvisorTeamRow,
  formatDate,
  formatDateTime,
  formatInr,
  type LeadStatusRow,
  REPORTING_SOURCE_LABELS,
} from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { LeadRow } from '@/components/lead-row';
import { PayoutStateBadge } from '@/components/status';
import { DistributionCard, humanize, MetricTile, userStatusTone } from '@/components/team';
import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Muted,
  Screen,
  SectionHeader,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { gradients, gradientStyle, shadow } from '@/lib/theme';

interface RequestRow {
  id: string;
  publicRef: string;
  state: string;
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  outstanding: string[];
}

/** F-315 (Manager mobile): one Advisor's leads, bank results and payout history. Read-only evidence, no score. */
export default function ManagerAdvisorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<AdvisorTeamRow | null>(null);
  const [leads, setLeads] = useState<LeadStatusRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, l, r] = await Promise.all([
        api.get<AdvisorTeamResponse>(`/dashboards/manager/advisors?advisorId=${id}`),
        api.get<LeadStatusRow[]>(`/leads?advisorId=${id}&pageSize=20`),
        api.get<RequestRow[]>(`/payouts/requests?advisorId=${id}&pageSize=20`),
      ]);
      setRow(d.data.rows[0] ?? null);
      setLeads(l.data);
      setRequests(r.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load this Advisor.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen
      scroll
      refreshing={loading && loaded}
      onRefresh={() => void load()}
      header={
        <AppBar title={row?.user.fullName || 'Advisor'} subtitle="Advisor · read-only evidence" />
      }
    >
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loaded ? <SkeletonList rows={4} /> : null}
      {row ? (
        <>
          <Appear>
            <View
              className="overflow-hidden rounded-3xl p-5"
              style={[gradientStyle(gradients.hero, 140), shadow.lg]}
            >
              <View
                pointerEvents="none"
                className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.07]"
              />
              <View className="flex-row items-center gap-4">
                <Avatar name={row.user.fullName || '?'} size={60} light />
                <View className="flex-1 gap-1">
                  <RNText numberOfLines={1} className="font-extrabold text-[20px] text-white">
                    {row.user.fullName || '(onboarding)'}
                  </RNText>
                  <RNText numberOfLines={1} className="font-medium text-[12px] text-white/70">
                    {row.user.publicRef} · {row.user.mobileMasked ?? ''}
                  </RNText>
                  <View className="mt-1 self-start rounded-full bg-white px-0.5">
                    <Badge
                      label={humanize(row.user.status)}
                      variant={userStatusTone(row.user.status)}
                      dot
                      size="sm"
                    />
                  </View>
                </View>
              </View>
              <View className="mt-4 gap-2 rounded-2xl bg-white/10 p-3">
                <View className="flex-row items-center gap-2">
                  <Icon name="git-network-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <RNText className="flex-1 font-medium text-[12px] text-white/85">
                    {row.reporting
                      ? `${REPORTING_SOURCE_LABELS[row.reporting.source] ?? row.reporting.source}${row.reporting.agentCode ? ` ${row.reporting.agentCode}` : ''} since ${formatDate(row.reporting.since)}`
                      : 'No active reporting line'}
                  </RNText>
                </View>
                <View className="flex-row items-center gap-2">
                  <Icon name="calendar-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <RNText className="font-medium text-[12px] text-white/85">
                    joined {formatDate(row.user.joinedAt)}
                  </RNText>
                </View>
              </View>
            </View>
          </Appear>

          <Appear index={1} className="gap-3">
            <SectionHeader title="Leads & payouts" />
            <View className="flex-row gap-3">
              <MetricTile
                className="flex-1"
                label="Leads created"
                m={row.leads.created}
                icon="document-text"
              />
              <MetricTile
                className="flex-1"
                label="Matched in MIS"
                m={row.leads.misMatched}
                icon="git-compare"
                tone="info"
              />
            </View>
            <View className="flex-row gap-3">
              <MetricTile
                className="flex-1"
                label="Eligible events"
                m={row.payouts.eligible}
                money
                icon="ribbon"
                tone="gold"
              />
              <MetricTile
                className="flex-1"
                label="Available to claim"
                m={row.payouts.available}
                money
                icon="wallet"
                tone="gold"
              />
            </View>
            <View className="flex-row gap-3">
              <MetricTile
                className="flex-1"
                label="Approved, unpaid"
                m={row.payouts.approvedUnpaid}
                money
                icon="hourglass"
                tone="warning"
              />
              <MetricTile
                className="flex-1"
                label="Paid events"
                m={row.payouts.paid}
                money
                icon="checkmark-done"
                tone="success"
              />
            </View>
          </Appear>

          <Appear index={2} className="gap-3">
            <SectionHeader title="Bank results" />
            <Callout kind="neutral">
              Bank values are the latest accepted MIS only — never live bank status.
            </Callout>
            <DistributionCard title="Current stage" icon="layers-outline" d={row.stage} />
            <DistributionCard title="Final decision" icon="flag-outline" d={row.decision} />
            <DistributionCard title="Card activation" icon="card-outline" d={row.activation} />
            {row.bankReasons.top.length ? (
              <Card className="gap-2">
                <Text className="font-bold text-[15px]">Bank reasons</Text>
                {row.bankReasons.top.map((r, i) => (
                  <View
                    key={r.value}
                    className={`flex-row items-start justify-between gap-3 py-1.5 ${i ? 'border-t border-line' : ''}`}
                  >
                    <Text className="flex-1 text-[13px] leading-[19px]">{r.value}</Text>
                    <View className="min-w-[26px] items-center rounded-full bg-[#EEF0F4] px-2 py-0.5">
                      <RNText className="font-bold text-[12px] text-ink">{r.count}</RNText>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
          </Appear>

          <Appear index={3} className="gap-3">
            <SectionHeader title={`Leads · ${leads.length}`} />
            {leads.map((l) => (
              <LeadRow
                key={l.id}
                row={l}
                onPress={() => router.push({ pathname: '/(manager)/lead', params: { id: l.id } })}
              />
            ))}
            {leads.length === 0 ? (
              <EmptyState compact icon="document-text-outline" title="No leads yet." />
            ) : null}
          </Appear>

          <Appear index={4} className="gap-3">
            <SectionHeader title="Payout requests" />
            {requests.map((r) => (
              <Card
                key={r.id}
                accessibilityLabel={`Open payout request ${r.publicRef}`}
                onPress={() =>
                  router.push({ pathname: '/(manager)/payout-request', params: { id: r.id } })
                }
                className="gap-2"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <RNText className="font-extrabold text-[22px] tracking-tight text-ink">
                    {formatInr(r.totalAmountInr, { decimals: 0 })}
                  </RNText>
                  <PayoutStateBadge state={r.state} />
                </View>
                <Muted className="text-[12px]">
                  {r.publicRef} · {r.itemCount} card event(s) · submitted{' '}
                  {formatDateTime(r.submittedAt)}
                </Muted>
                {r.outstanding.length ? (
                  <Badge
                    label={`Waiting: ${r.outstanding.join(' + ').toLowerCase()}`}
                    variant="warning"
                    icon="time-outline"
                  />
                ) : null}
              </Card>
            ))}
            {requests.length === 0 ? (
              <EmptyState compact icon="wallet-outline" title="No payout requests yet." />
            ) : null}
          </Appear>
        </>
      ) : null}
      {loaded && !row && !error ? (
        <EmptyState
          icon="person-outline"
          title="Advisor not found"
          body="This Advisor is not in your Advisor list."
        />
      ) : null}
    </Screen>
  );
}
