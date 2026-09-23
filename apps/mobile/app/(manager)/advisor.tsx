import { ApiClientError, type AdvisorTeamResponse, type AdvisorTeamRow, type Distribution, formatDate, formatDateTime, formatInr, type LeadStatusRow, type Metric, REPORTING_SOURCE_LABELS } from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LeadRow } from '@/components/lead-row';
import { PayoutStateBadge } from '@/components/status';
import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface RequestRow {
  id: string;
  publicRef: string;
  state: string;
  itemCount: number;
  totalAmountInr: number;
  submittedAt: string;
  outstanding: string[];
}
const SRC: Record<string, string> = { KBS_LEADS: 'KBS leads', BANK_MIS: 'bank MIS', KBS_PAYOUT_LEDGER: 'payout ledger' };

function Tile({ label, m, money }: { label: string; m: Metric; money?: boolean }) {
  return (
    <Card className="w-[48%] gap-0.5">
      <Muted>{label}</Muted>
      <Text className="text-xl font-semibold">{m.value}</Text>
      <Muted>
        {money ? `${formatInr(m.amountInr ?? 0, { decimals: 0 })} · ` : ''}
        {m.denominator ? `of ${m.denominator.value} · ` : ''}
        {SRC[m.source] ?? m.source}
      </Muted>
    </Card>
  );
}

function Dist({ title, d }: { title: string; d: Distribution }) {
  return (
    <Card className="gap-1">
      <Text className="font-medium">{title}</Text>
      <Muted>Bank MIS values verbatim · {d.denominator.value} leads</Muted>
      {d.buckets.map((b) => (
        <View key={b.value} className="flex-row justify-between gap-2">
          <Text className={`flex-1 text-xs ${b.value === 'Awaiting MIS' || b.value === 'Not reported' ? 'text-muted-foreground italic' : ''}`}>{b.value}</Text>
          <Text className="text-xs">{b.count}</Text>
        </View>
      ))}
      {d.buckets.length === 0 ? <Muted>No leads yet.</Muted> : null}
    </Card>
  );
}

/** F-315 (Manager mobile): one Advisor's leads, bank results and payout history. Read-only evidence, no score. */
export default function ManagerAdvisorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<AdvisorTeamRow | null>(null);
  const [leads, setLeads] = useState<LeadStatusRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-3 pb-8" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <Button title="← Back" variant="ghost" onPress={() => router.back()} />
        <ErrorText>{error}</ErrorText>
        {row ? (
          <>
            <View className="gap-1">
              <Heading>{row.user.fullName || '(onboarding)'}</Heading>
              <Muted>
                {row.user.publicRef} · {row.user.mobileMasked ?? ''} · joined {formatDate(row.user.joinedAt)}
              </Muted>
              <Muted>{row.reporting ? `${REPORTING_SOURCE_LABELS[row.reporting.source] ?? row.reporting.source}${row.reporting.agentCode ? ` ${row.reporting.agentCode}` : ''} since ${formatDate(row.reporting.since)}` : 'No active reporting line'}</Muted>
              <Badge label={row.user.status} variant={row.user.status === 'ACTIVE' ? 'success' : 'unknown'} />
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Tile label="Leads created" m={row.leads.created} />
              <Tile label="Matched in MIS" m={row.leads.misMatched} />
              <Tile label="Eligible events" m={row.payouts.eligible} money />
              <Tile label="Available to claim" m={row.payouts.available} money />
              <Tile label="Approved, unpaid" m={row.payouts.approvedUnpaid} money />
              <Tile label="Paid events" m={row.payouts.paid} money />
            </View>
            <Muted>Bank values are the latest accepted MIS only — never live bank status.</Muted>
            <Dist title="Current stage" d={row.stage} />
            <Dist title="Final decision" d={row.decision} />
            <Dist title="Card activation" d={row.activation} />
            {row.bankReasons.top.length ? (
              <Card className="gap-1">
                <Text className="font-medium">Bank reasons</Text>
                {row.bankReasons.top.map((r) => (
                  <View key={r.value} className="flex-row justify-between gap-2">
                    <Text className="flex-1 text-xs">{r.value}</Text>
                    <Text className="text-xs">{r.count}</Text>
                  </View>
                ))}
              </Card>
            ) : null}
            <Text className="font-medium">Leads</Text>
            {leads.map((l) => (
              <LeadRow key={l.id} row={l} onPress={() => router.push({ pathname: '/(manager)/lead', params: { id: l.id } })} />
            ))}
            {leads.length === 0 ? (
              <Card>
                <Text>No leads yet.</Text>
              </Card>
            ) : null}
            <Text className="font-medium">Payout requests</Text>
            {requests.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(manager)/payout-request', params: { id: r.id } })}>
                <Card className="gap-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-medium">{formatInr(r.totalAmountInr, { decimals: 0 })}</Text>
                    <PayoutStateBadge state={r.state} />
                  </View>
                  <Muted>
                    {r.publicRef} · {r.itemCount} card event(s) · submitted {formatDateTime(r.submittedAt)}
                  </Muted>
                  {r.outstanding.length ? <Badge label={`Waiting: ${r.outstanding.join(' + ').toLowerCase()}`} variant="warning" /> : null}
                </Card>
              </Pressable>
            ))}
            {requests.length === 0 ? (
              <Card>
                <Text>No payout requests yet.</Text>
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
