import { ApiClientError, type AdvisorTeamResponse, type AdvisorTeamRow, formatInr, REPORTING_SOURCE_LABELS } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Badge, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

/** F-315 (Manager mobile): Advisors reporting to me with leads, bank MIS results and payout position — same API as web. */
export default function ManagerAdvisors() {
  const [rows, setRows] = useState<AdvisorTeamRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <View className="mb-3">
        <Heading>Advisors</Heading>
        <Muted>{note ?? 'Leads, bank MIS results and payouts for Advisors reporting to you.'}</Muted>
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.user.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>No Advisors report to you yet.</Text>
              <Muted>Advisors join your team when they apply one of your Agent Codes.</Muted>
            </Card>
          )
        }
        renderItem={({ item: r }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${r.user.fullName}`} onPress={() => router.push({ pathname: '/(manager)/advisor', params: { id: r.user.id } })}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-medium" numberOfLines={1}>
                  {r.user.fullName || '(onboarding)'}
                </Text>
                <Badge label={r.user.status} variant={r.user.status === 'ACTIVE' ? 'success' : 'unknown'} />
              </View>
              <Muted>{r.reporting ? `${REPORTING_SOURCE_LABELS[r.reporting.source] ?? r.reporting.source}${r.reporting.agentCode ? ` ${r.reporting.agentCode}` : ''}` : 'No active reporting line'}</Muted>
              <Text>
                {r.leads.created.value} leads · {r.leads.misMatched.value} matched in bank MIS · {r.leads.awaitingMis.value} awaiting MIS
              </Text>
              <Muted>
                Eligible {r.payouts.eligible.value} ({formatInr(r.payouts.eligible.amountInr ?? 0, { decimals: 0 })}) · approved unpaid {r.payouts.approvedUnpaid.value} · paid {r.payouts.paid.value} ({formatInr(r.payouts.paid.amountInr ?? 0, { decimals: 0 })})
              </Muted>
              {r.awaitingManagerApproval ? <Badge label={`${r.awaitingManagerApproval} request(s) awaiting Manager`} variant="warning" /> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
