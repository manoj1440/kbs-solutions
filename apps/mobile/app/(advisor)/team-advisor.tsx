import { ApiClientError, type LeadStatusRow } from '@kbs/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { LeadRow } from '@/components/lead-row';
import {
  AppBar,
  Appear,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  SkeletonList,
} from '@/components/ui';
import { api } from '@/lib/api';

interface Summary {
  total: number;
  matched: number;
  approved: number;
  declined: number;
  cardsActive: number;
  awaitingMis: number;
}

/** F-824: every lead of one Advisor who signed up with this Advisor's code, with their bank results. Read-only. */
export default function TeamAdvisorScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  // hidden tab, stays mounted: keyed by id so one Advisor's leads never show under another's name
  return <TeamAdvisorView key={id} id={id} name={name ?? 'Advisor'} />;
}

function TeamAdvisorView({ id, name }: { id: string; name: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<LeadStatusRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        api.get<Summary>(`/leads/summary?advisorId=${id}`),
        api.get<LeadStatusRow[]>(`/leads?advisorId=${id}&pageSize=20`),
      ]);
      setSummary(s.data);
      setLeads(l.data);
      setTotal(typeof l.meta.total === 'number' ? l.meta.total : l.data.length);
      setPage(1);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the leads.');
    } finally {
      setLoaded(true);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const more = async () => {
    setMoreBusy(true);
    try {
      const next = page + 1;
      const l = await api.get<LeadStatusRow[]>(`/leads?advisorId=${id}&pageSize=20&page=${next}`);
      setLeads((cur) => [...cur, ...l.data.filter((x) => !cur.some((c) => c.id === x.id))]);
      setPage(next);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load more leads.');
    } finally {
      setMoreBusy(false);
    }
  };
  const tiles: [string, number | undefined][] = [
    ['Leads', summary?.total],
    ['With a bank result', summary?.matched],
    ['Bank approved', summary?.approved],
    ['Cards active', summary?.cardsActive],
  ];
  return (
    <Screen scroll header={<AppBar title={name} subtitle="Signed up with your code · read-only" />}>
      {error && !loaded ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loaded ? <SkeletonList rows={3} /> : null}
      {loaded ? (
        <>
          <Appear>
            <Card className="gap-2">
              <View className="flex-row gap-2">
                {tiles.slice(0, 2).map(([label, value]) => (
                  <Tile key={label} label={label} value={value} />
                ))}
              </View>
              <View className="flex-row gap-2">
                {tiles.slice(2).map(([label, value]) => (
                  <Tile key={label} label={label} value={value} />
                ))}
              </View>
            </Card>
          </Appear>
          <Appear index={1} className="gap-3">
            <SectionHeader title={`Leads · ${total}`} />
            {leads.map((l) => (
              <LeadRow
                key={l.id}
                row={l}
                onPress={() =>
                  router.push({ pathname: '/(advisor)/team-lead', params: { id: l.id } } as never)
                }
              />
            ))}
            {leads.length === 0 ? (
              <EmptyState compact icon="document-text-outline" title="No leads yet" />
            ) : null}
            {leads.length < total ? (
              <Button
                variant="outline"
                size="sm"
                title={moreBusy ? 'Loading…' : `Show more leads (${leads.length} of ${total})`}
                disabled={moreBusy}
                onPress={() => void more()}
              />
            ) : null}
          </Appear>
        </>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <View className="flex-1 rounded-lg bg-raised px-3 py-2.5">
      <RNText className="font-normal text-xs text-[#737373]">{label}</RNText>
      <RNText
        accessibilityLabel={`${label} ${value ?? 0}`}
        className="mt-1 font-semibold text-xl text-ink tabular-nums"
      >
        {value ?? '—'}
      </RNText>
    </View>
  );
}
