import { ApiClientError, type UserSummary } from '@kbs/shared';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

type TeamUser = UserSummary & { lastLoginAt: string | null };
interface M {
  value: number;
  amountInr?: number;
  denominator?: { label: string; value: number };
  source: string;
}
interface Summary {
  calling: { calls: { attempts: M; connected: M }; callbacks: { due: M }; shares: { total: M } };
  advisors: { leads: { created: M; misMatched: M }; payouts: { approvedUnpaid: M; paid: M } };
}
const SRC: Record<string, string> = { TELEPHONY_PROVIDER: 'provider', KBS_CALLING: 'KBS calling', KBS_SHARING: 'share log', KBS_LEADS: 'KBS leads', BANK_MIS: 'bank MIS', KBS_PAYOUT_LEDGER: 'payout ledger' };

/** F-702: same numbers as the web Manager dashboard (one API), each labelled with its source. */
function SummaryCards({ s }: { s: Summary }) {
  const tiles: [string, M, boolean?][] = [
    ['Call attempts', s.calling.calls.attempts],
    ['Connected', s.calling.calls.connected],
    ['Callbacks due', s.calling.callbacks.due],
    ['Shares', s.calling.shares.total],
    ['Leads created', s.advisors.leads.created],
    ['MIS matched', s.advisors.leads.misMatched],
    ['Approved, unpaid', s.advisors.payouts.approvedUnpaid, true],
    ['Paid events', s.advisors.payouts.paid, true],
  ];
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      {tiles.map(([label, m, money]) => (
        <Card key={label} className="w-[48%] gap-0.5">
          <Muted>{label}</Muted>
          <Text className="text-xl font-semibold">{m.value}</Text>
          <Muted>
            {money && m.amountInr !== undefined ? `₹${m.amountInr.toLocaleString('en-IN')} · ` : ''}
            {m.denominator ? `of ${m.denominator.value} · ` : ''}
            {SRC[m.source] ?? m.source}
          </Muted>
        </Card>
      ))}
    </View>
  );
}

/** F-201: Manager team overview (mobile). Training columns arrive with F-205. */
export default function ManagerHome() {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, d] = await Promise.all([api.get<TeamUser[]>('/users?pageSize=200'), api.get<Summary>('/dashboards/manager').catch(() => null)]);
      setRows(r.data);
      setSummary(d?.data ?? null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const telecallers = rows.filter((u) => u.role === 'TELECALLER');
  const advisors = rows.filter((u) => u.role === 'ADVISOR');

  return (
    <Screen>
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Heading>My team</Heading>
          <Muted>
            {telecallers.length} Telecallers · {advisors.length} Advisors
          </Muted>
        </View>
        <Link href="/(manager)/create-telecaller" asChild>
          <Button title="Create" />
        </Link>
      </View>
      <ErrorText>{error}</ErrorText>
      {summary ? <SummaryCards s={summary} /> : null}
      <FlatList
        data={[...telecallers, ...advisors]}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>No team members yet.</Text>
              <Muted>Create a Telecaller with a name and mobile number. Advisors join when they apply your Agent Code.</Muted>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Card className="gap-1" onTouchEnd={() => item.role === 'TELECALLER' && router.push({ pathname: '/(manager)/telecaller', params: { id: item.id } })}>
            <View className="flex-row items-center justify-between">
              <Text className="font-medium">{item.fullName || '(onboarding)'}</Text>
              <Badge label={item.role} variant="secondary" />
            </View>
            <Muted>
              {item.mobileMasked}
              {item.employeeCode ? ` · ${item.employeeCode}` : ''}
            </Muted>
            <Badge label={item.status} variant={item.status === 'ACTIVE' ? 'success' : 'unknown'} />
          </Card>
        )}
      />
    </Screen>
  );
}
