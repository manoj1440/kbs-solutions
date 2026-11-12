import { ApiClientError, formatDateTime, formatInr } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text as RNText, View } from 'react-native';

import { PayoutStateBadge } from '@/components/status';
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
  Segmented,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

interface Row {
  id: string;
  publicRef: string;
  state: string;
  advisor: { fullName: string };
  itemCount: number;
  /** Set by Admin's approval — null while the request waits for the Manager. */
  totalAmountInr: number | null;
  submittedAt: string;
  outstanding: string[];
}

function RequestCard({ item, index, mine }: { item: Row; index: number; mine: boolean }) {
  return (
    <Appear index={index}>
      <Card
        accessibilityLabel={`Open payout request ${item.publicRef} from ${item.advisor.fullName}`}
        onPress={() =>
          router.push({ pathname: '/(manager)/payout-request', params: { id: item.id } })
        }
        className="gap-3"
      >
        <View className="flex-row items-center gap-3">
          <Avatar name={item.advisor.fullName} size={40} />
          <View className="flex-1">
            <Text numberOfLines={1} className="font-medium text-base">
              {item.advisor.fullName}
            </Text>
            <Muted numberOfLines={1} className="text-xs">
              {item.publicRef}
            </Muted>
          </View>
          <PayoutStateBadge state={item.state} />
        </View>
        <View className="rounded-lg bg-raised px-4 py-3">
          <RNText className="font-normal text-xs text-[#525252]">
            {item.totalAmountInr != null ? 'Approved amount' : 'Activated cards'}
          </RNText>
          <View className="mt-0.5 flex-row items-end justify-between gap-2">
            <RNText
              numberOfLines={1}
              adjustsFontSizeToFit
              className="flex-1 font-medium text-xl text-ink tabular-nums"
            >
              {item.totalAmountInr != null
                ? formatInr(item.totalAmountInr)
                : `${item.itemCount} card${item.itemCount === 1 ? '' : 's'}`}
            </RNText>
            {item.totalAmountInr != null ? (
              <View className="mb-1 flex-row items-center gap-1">
                <Muted className="text-xs tabular-nums">{item.itemCount} card event(s)</Muted>
              </View>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="time-outline" size={16} color={colors.subtle} />
          <Muted className="flex-1 text-xs">submitted {formatDateTime(item.submittedAt)}</Muted>
        </View>
        {item.outstanding.length ? (
          <Badge
            label={`Outstanding: ${item.outstanding.join(' + ').toLowerCase()}`}
            variant="warning"
            icon="hourglass-outline"
          />
        ) : null}
        <View className="flex-row items-center justify-between border-t border-line pt-3">
          <RNText className="font-medium text-sm text-ink">
            {mine ? 'Review & decide' : 'View request'}
          </RNText>
          <Icon name="chevron-forward" size={16} color={colors.subtle} />
        </View>
      </Card>
    </Appear>
  );
}

/** F-604 (Manager mobile): payout requests awaiting my approval, plus the team's history. Approve / reject happen on the request (evidence first). */
export default function ManagerApprovals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        (await api.get<Row[]>(`/payouts/requests?pageSize=100${mine ? '&awaitingMe=true' : ''}`))
          .data,
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load approvals.');
    } finally {
      setLoading(false);
      setLoaded(mine);
    }
  }, [mine]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const ready = loaded === mine;
  return (
    <Screen
      padded={false}
      header={
        <AppBar
          back={false}
          large
          title="Payout approvals"
          subtitle={
            ready && rows.length
              ? `${rows.length} request${rows.length === 1 ? '' : 's'}`
              : undefined
          }
        />
      }
    >
      <FlatList
        data={ready ? rows : []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="gap-3 px-4 pb-10 pt-1"
        refreshControl={
          <RefreshControl
            refreshing={loading && ready}
            onRefresh={() => void load()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <View className="gap-3">
            <Segmented
              options={[
                { key: 'mine', label: 'Awaiting me' },
                { key: 'all', label: 'All team requests' },
              ]}
              value={mine ? 'mine' : 'all'}
              onChange={(k) => setMine(k === 'mine')}
            />
            {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
            {!ready ? <SkeletonList rows={2} /> : null}
          </View>
        }
        ListEmptyComponent={
          ready && !error ? (
            <EmptyState
              icon={mine ? 'checkmark-done-circle-outline' : 'wallet-outline'}
              title={mine ? 'Nothing awaiting your approval.' : 'No payout requests yet.'}
              body={
                mine
                  ? 'Requests from your Advisors appear here when they need your decision.'
                  : undefined
              }
              action={mine ? 'See all team requests' : undefined}
              onAction={mine ? () => setMine(false) : undefined}
            />
          ) : null
        }
        renderItem={({ item, index }) => <RequestCard item={item} index={index} mine={mine} />}
      />
    </Screen>
  );
}
