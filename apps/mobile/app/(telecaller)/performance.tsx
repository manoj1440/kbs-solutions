import { ApiClientError } from '@kbs/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { InterestCard, type InterestView } from '@/components/interest-card';
import { AppBar, Appear, EmptyState, ErrorState, Muted, Screen, SectionHeader, Segmented, SkeletonList, StatTile } from '@/components/ui';
import { api } from '@/lib/api';

/** `GET /calling/me/performance` (A21). Evidence counts only — no score or ranking (REQ-15 §15.3). */
interface Performance {
  queueSize: number;
  followUpsDue: number;
  today: { attempts: number; connected: number; talkTimeSec: number; interests: number };
  period: { attempts: number; connected: number; talkTimeSec: number; interests: number; shares: Record<string, number> };
  applications: { total: number; AWAITING_REFERENCE: number; AWAITING_BANK_UPDATE: number; IN_PROCESS: number; APPROVED: number; DECLINED: number; activated: number };
}

const minutes = (sec: number) => `${Math.round(sec / 60)} min`;
type Filter = 'all' | 'todo' | 'bank';

/** The Telecaller's own numbers and where every customer they sent a card link to stands with the bank. */
export default function PerformanceScreen() {
  const [p, setP] = useState<Performance | null>(null);
  const [interests, setInterests] = useState<InterestView[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [perf, list] = await Promise.all([api.get<Performance>('/calling/me/performance'), api.get<InterestView[]>('/calling/interests')]);
      setP(perf.data);
      setInterests(list.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your performance.');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shown = interests.filter((i) => (filter === 'todo' ? i.stage === 'AWAITING_REFERENCE' : filter === 'bank' ? i.bankStatus !== null : true));
  const a = p?.applications;
  return (
    <Screen scroll header={<AppBar back={false} large title="My performance" subtitle="Today, the last 30 days and your applications" />}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!p && !error ? <SkeletonList rows={4} /> : null}
      {p && a ? (
        <>
          <Appear className="gap-3">
            <SectionHeader title="Today" />
            <View className="flex-row gap-3">
              <StatTile className="flex-1" label="Calls" value={String(p.today.attempts)} icon="call" hint={`${p.today.connected} connected`} />
              <StatTile className="flex-1" label="Talk time" value={minutes(p.today.talkTimeSec)} icon="time" />
            </View>
            <View className="flex-row gap-3">
              <StatTile className="flex-1" label="Interested" value={String(p.today.interests)} icon="heart" tone="gold" />
              <StatTile className="flex-1" label="In queue" value={String(p.queueSize)} icon="list" hint={p.followUpsDue ? `${p.followUpsDue} follow-ups due` : undefined} />
            </View>
          </Appear>

          <Appear index={1} className="gap-3">
            <SectionHeader title="Last 30 days" />
            <View className="flex-row gap-3">
              <StatTile className="flex-1" label="Calls" value={String(p.period.attempts)} icon="call-outline" hint={`${p.period.connected} connected`} />
              <StatTile className="flex-1" label="Links sent" value={String(p.period.shares.APPLICATION_LINK ?? 0)} icon="link" hint={`${p.period.shares.BENEFIT_PDF ?? 0} PDFs`} />
            </View>
          </Appear>

          <Appear index={2} className="gap-3">
            <SectionHeader title="Applications" />
            <View className="flex-row gap-3">
              <StatTile className="flex-1" label="Approved" value={String(a.APPROVED)} icon="checkmark-circle" tone="success" hint={a.activated ? `${a.activated} activated` : undefined} />
              <StatTile className="flex-1" label="In process" value={String(a.IN_PROCESS + a.AWAITING_BANK_UPDATE)} icon="hourglass" tone="info" />
            </View>
            <View className="flex-row gap-3">
              <StatTile className="flex-1" label="Declined" value={String(a.DECLINED)} icon="close-circle" tone="destructive" />
              <StatTile className="flex-1" label="Need app no." value={String(a.AWAITING_REFERENCE)} icon="create" tone="warning" />
            </View>
            <Muted>Bank results come only from the bank MIS upload. Add the application number so the MIS can find the customer.</Muted>
          </Appear>

          <Appear index={3} className="gap-3">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All', count: interests.length || undefined },
                { key: 'todo', label: 'Need app no.', count: a.AWAITING_REFERENCE || undefined },
                { key: 'bank', label: 'Bank updated' },
              ]}
            />
            {shown.length ? (
              shown.map((i) => <InterestCard key={i.id} interest={i} showCustomer onChanged={() => void load()} />)
            ) : (
              <EmptyState icon="document-text-outline" title="Nothing here yet" body="Customers you send a card link to show up here." />
            )}
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}
