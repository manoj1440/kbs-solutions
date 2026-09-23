import {
  ApiClientError,
  type AdvisorTeamResponse,
  type AdvisorTeamRow,
  formatInr,
  REPORTING_SOURCE_LABELS,
} from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text as RNText, View } from 'react-native';

import { humanize, userStatusTone } from '@/components/team';
import {
  AppBar,
  Appear,
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Muted,
  Screen,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

function Mini({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <View className={`flex-1 items-center py-1 ${last ? '' : 'border-r border-line'}`}>
      <RNText className="font-extrabold text-[18px] text-ink">{value}</RNText>
      <RNText numberOfLines={1} className="font-medium text-[11px] text-[#5B6478]">
        {label}
      </RNText>
    </View>
  );
}

function AdvisorCard({ r, index }: { r: AdvisorTeamRow; index: number }) {
  const name = r.user.fullName || '(onboarding)';
  return (
    <Appear index={index}>
      <Card
        accessibilityLabel={`Open ${r.user.fullName}`}
        onPress={() => router.push({ pathname: '/(manager)/advisor', params: { id: r.user.id } })}
        className="gap-3"
      >
        <View className="flex-row items-center gap-3">
          <Avatar name={r.user.fullName || '?'} size={46} />
          <View className="flex-1">
            <Text numberOfLines={1} className="font-bold text-[15px]">
              {name}
            </Text>
            <Muted numberOfLines={1} className="text-[12px]">
              {r.reporting
                ? `${REPORTING_SOURCE_LABELS[r.reporting.source] ?? r.reporting.source}${r.reporting.agentCode ? ` ${r.reporting.agentCode}` : ''}`
                : 'No active reporting line'}
            </Muted>
          </View>
          <Badge
            label={humanize(r.user.status)}
            variant={userStatusTone(r.user.status)}
            dot
            size="sm"
          />
          <Icon name="chevron-forward" size={16} color={colors.subtle} />
        </View>
        <View className="flex-row rounded-2xl bg-[#F6F8FC] py-2">
          <Mini label="Leads" value={r.leads.created.value} />
          <Mini label="Matched in MIS" value={r.leads.misMatched.value} />
          <Mini label="Awaiting MIS" value={r.leads.awaitingMis.value} last />
        </View>
        <View className="flex-row items-start gap-2">
          <Icon name="wallet-outline" size={14} color={colors.subtle} style={{ marginTop: 2 }} />
          <Muted className="flex-1 text-[12px] leading-[18px]">
            Eligible {r.payouts.eligible.value} (
            {formatInr(r.payouts.eligible.amountInr ?? 0, { decimals: 0 })}) · approved unpaid{' '}
            {r.payouts.approvedUnpaid.value} · paid {r.payouts.paid.value} (
            {formatInr(r.payouts.paid.amountInr ?? 0, { decimals: 0 })})
          </Muted>
        </View>
        {r.awaitingManagerApproval ? (
          <Badge
            label={`${r.awaitingManagerApproval} request(s) awaiting Manager`}
            variant="warning"
            icon="time-outline"
          />
        ) : null}
      </Card>
    </Appear>
  );
}

/** F-315 (Manager mobile): Advisors reporting to me with leads, bank MIS results and payout position — same API as web. */
export default function ManagerAdvisors() {
  const [rows, setRows] = useState<AdvisorTeamRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<AdvisorTeamResponse>('/dashboards/manager/advisors');
      setRows(r.data.rows);
      setNote(r.data.meta.note);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your Advisors.');
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
  return (
    <Screen
      padded={false}
      header={
        <AppBar
          back={false}
          large
          title="Advisors"
          subtitle={`${loaded ? `${rows.length} reporting to you` : 'Your Advisor team'}`}
        />
      }
    >
      <FlatList
        data={loaded ? rows : []}
        keyExtractor={(r) => r.user.id}
        contentContainerClassName="gap-3 px-4 pb-10 pt-1"
        refreshControl={
          <RefreshControl
            refreshing={loading && loaded}
            onRefresh={() => void load()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <View className="gap-3">
            <View className="flex-row items-start gap-2 rounded-2xl bg-[#E8EDFF] px-3.5 py-3">
              <Icon
                name="information-circle"
                size={16}
                color={colors.brand}
                style={{ marginTop: 1 }}
              />
              <Muted className="flex-1 text-[12px] leading-[18px] text-[#374151]">
                {note ?? 'Leads, bank MIS results and payouts for Advisors reporting to you.'}
              </Muted>
            </View>
            {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
            {!loaded ? <SkeletonList rows={3} /> : null}
          </View>
        }
        ListEmptyComponent={
          loaded && !error ? (
            <EmptyState
              icon="briefcase-outline"
              title="No Advisors report to you yet."
              body="Advisors join your team when they apply one of your Agent Codes."
            />
          ) : null
        }
        renderItem={({ item, index }) => <AdvisorCard r={item} index={index} />}
      />
    </Screen>
  );
}
