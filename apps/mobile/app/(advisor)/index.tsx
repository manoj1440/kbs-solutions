import { ApiClientError, formatInr, type LeadStatusRow } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface LedgerTotals {
  totals: Record<'eligible' | 'available' | 'requested' | 'approvedUnpaid' | 'paid' | 'underReview' | 'pendingHold', { count: number; amountInr: number }>;
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
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour ago`;
  return `${Math.floor(s / 86400)} day ago`;
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View className="w-[48%] rounded-2xl border border-border bg-card p-4">
      <Text className={`font-bold ${big ? 'text-2xl' : 'text-xl'}`}>{value}</Text>
      <Muted className="mt-1 text-xs">{label}</Muted>
    </View>
  );
}

const QUICK = [
  { icon: '➕', label: 'Add Lead', href: '/(advisor)/lead-new' },
  { icon: '🔍', label: 'Card Search', href: '/(advisor)/cards' },
  { icon: '📋', label: 'My Leads', href: '/(advisor)/leads' },
  { icon: '💰', label: 'Earnings', href: '/(advisor)/payouts' },
] as const;

/** S09 Home dashboard — real counts from /leads, earnings from /payouts/me/ledger, activity from /notifications. */
export default function AdvisorHome() {
  const { user } = useSession();
  const [leads, setLeads] = useState<LeadStatusRow[]>([]);
  const [totals, setTotals] = useState<LedgerTotals['totals'] | null>(null);
  const [notes, setNotes] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const approved = leads.filter((l) => l.decision.display === 'Approved').length;
  const earnings = totals?.eligible.amountInr ?? 0;
  const first = (user?.fullName ?? '').split(' ')[0] || 'Advisor';

  return (
    <Screen className="px-0">
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerClassName="gap-5 px-4 pb-10">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-primary">KBS</Text>
            <Heading>Hi {first}! 👋</Heading>
            <Muted>Great work this week!</Muted>
          </View>
          <View className="relative h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
            <Text className="text-lg">🔔</Text>
            {unread > 0 ? (
              <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1">
                <Text className="text-[10px] font-bold text-destructive-foreground">{unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ErrorText>{error}</ErrorText>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Stat label="Leads Created" value={String(leads.length)} />
          <Stat label="Applications" value={String(leads.filter((l) => l.matched || l.bankApplicationNo || l.bankApplicationReference).length)} />
          <Stat label="Approved" value={String(approved)} />
          <Stat label="Earnings" value={formatInr(earnings, { decimals: 0 })} big />
        </View>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {QUICK.map((q) => (
            <Pressable key={q.label} accessibilityRole="button" onPress={() => router.push(q.href as never)} className="w-[23%] items-center gap-1.5">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <Text className="text-2xl">{q.icon}</Text>
              </View>
              <Muted className="text-center text-[11px]">{q.label}</Muted>
            </Pressable>
          ))}
        </View>
        <View className="gap-2">
          <Text className="text-lg font-semibold">Recent Activity</Text>
          {notes.length === 0 && !loading ? (
            <Card>
              <Muted>No activity yet. Create your first lead from Card Search.</Muted>
            </Card>
          ) : null}
          {notes.map((n) => (
            <Card key={n.id} className="flex-row items-center gap-3 p-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
                <Text>👤</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {n.title}
                </Text>
                <Muted className="text-xs" numberOfLines={1}>
                  {n.body}
                </Muted>
              </View>
              <Muted className="text-[10px]">{ago(n.createdAt)}</Muted>
            </Card>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(advisor)/pending' as never)} className="items-center">
          <Muted>
            View <Text className="font-semibold text-primary">pending follow-ups</Text>
          </Muted>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
