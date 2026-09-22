import { ApiClientError, FILTER_AWAITING, FILTER_NOT_REPORTED, formatDateTime, type LeadFilterOptions, type LeadStatusRow, LEAD_SORTS, MIS_FRESHNESS } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LeadRow } from '@/components/lead-row';
import { Badge, Button, Card, ErrorText, Heading, Input, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

interface Draft {
  id: string;
  step: string;
  card: { name: string; bank: { displayName: string } } | null;
  customer: string | null;
  expiresAt: string;
}

interface Filters {
  bankId?: string;
  cardId?: string;
  stage?: string;
  decision?: string;
  activation?: string;
  misFreshness?: (typeof MIS_FRESHNESS)[number];
  actionable?: 'true' | 'false';
  sort: (typeof LEAD_SORTS)[number];
}
const SORT_LABEL: Record<(typeof LEAD_SORTS)[number], string> = { createdAt_desc: 'Newest', createdAt_asc: 'Oldest', lastMatchedAt_desc: 'Latest MIS', lastMatchedAt_asc: 'Stalest MIS', customer_asc: 'A→Z' };
const FRESH_LABEL: Record<(typeof MIS_FRESHNESS)[number], string> = { never: 'Never matched', recent: 'Last 7 days', older7d: '> 7 days', older30d: '> 30 days' };

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className={`rounded-full border px-3 py-1 ${active ? 'border-primary bg-primary' : 'border-border bg-card'}`}>
      <Text className={`text-xs ${active ? 'text-primary-foreground' : ''}`}>{label}</Text>
    </Pressable>
  );
}

/** F-408 My Leads: search by name / mobile / reference, filter sheet (issuer, card, stage, decision, activation, MIS freshness, actionable), sort. */
export default function Leads() {
  const [rows, setRows] = useState<LeadStatusRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>({ sort: 'createdAt_desc' });
  const [options, setOptions] = useState<LeadFilterOptions | null>(null);
  const [sheet, setSheet] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const activeCount = Object.entries(f).filter(([k, v]) => k !== 'sort' && v).length + (f.sort !== 'createdAt_desc' ? 1 : 0);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (q.trim()) qs.set('q', q.trim());
      for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
      const [l, d, o] = await Promise.all([api.get<LeadStatusRow[]>(`/leads?${qs.toString()}`), api.get<Draft[]>('/leads/drafts'), api.get<LeadFilterOptions>('/leads/filters')]);
      setRows(l.data);
      setTotal(typeof l.meta.total === 'number' ? l.meta.total : l.data.length);
      setDrafts(d.data);
      setOptions(o.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [q, f]);
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: prev[k] === v ? undefined : v }));
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <View className="mb-3 gap-2">
        <Heading>My leads</Heading>
        <Input placeholder="Search name, mobile or reference" value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" />
        <View className="flex-row items-center gap-2">
          <Button title={`Filters${activeCount ? ` (${activeCount})` : ''}`} variant={sheet ? 'default' : 'outline'} onPress={() => setSheet(!sheet)} />
          {activeCount ? <Button title="Clear" variant="ghost" onPress={() => setF({ sort: 'createdAt_desc' })} /> : null}
          {total !== null ? <Muted>{total} lead(s)</Muted> : null}
        </View>
        {sheet ? (
          <Card className="gap-2" testID="filter-sheet">
            <Text className="text-xs font-medium">Sort</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {LEAD_SORTS.map((s) => (
                <Chip key={s} label={SORT_LABEL[s]} active={f.sort === s} onPress={() => setF((p) => ({ ...p, sort: s }))} />
              ))}
            </ScrollView>
            <Text className="text-xs font-medium">MIS freshness</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {MIS_FRESHNESS.map((m) => (
                <Chip key={m} label={FRESH_LABEL[m]} active={f.misFreshness === m} onPress={() => toggle('misFreshness', m)} />
              ))}
            </ScrollView>
            <Text className="text-xs font-medium">Actionable</Text>
            <View className="flex-row gap-2">
              <Chip label="Needs my action" active={f.actionable === 'true'} onPress={() => toggle('actionable', 'true')} />
              <Chip label="Nothing pending" active={f.actionable === 'false'} onPress={() => toggle('actionable', 'false')} />
            </View>
            {options ? (
              <>
                {options.banks.length > 1 ? (
                  <>
                    <Text className="text-xs font-medium">Issuer</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                      {options.banks.map((b) => (
                        <Chip key={b.id} label={b.displayName} active={f.bankId === b.id} onPress={() => toggle('bankId', b.id)} />
                      ))}
                    </ScrollView>
                  </>
                ) : null}
                {options.cards.length > 1 ? (
                  <>
                    <Text className="text-xs font-medium">Card</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                      {options.cards.map((c) => (
                        <Chip key={c.id} label={c.name} active={f.cardId === c.id} onPress={() => toggle('cardId', c.id)} />
                      ))}
                    </ScrollView>
                  </>
                ) : null}
                {(
                  [
                    ['stage', 'Stage', options.stages],
                    ['decision', 'Decision', options.decisions],
                    ['activation', 'Activation', options.activations],
                  ] as const
                ).map(([k, label, values]) => (
                  <View key={k} className="gap-1">
                    <Text className="text-xs font-medium">{label}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                      <Chip label="Awaiting MIS Update" active={f[k] === FILTER_AWAITING} onPress={() => toggle(k, FILTER_AWAITING)} />
                      <Chip label="Not reported" active={f[k] === FILTER_NOT_REPORTED} onPress={() => toggle(k, FILTER_NOT_REPORTED)} />
                      {values.map((v) => (
                        <Chip key={v} label={v} active={f[k] === v} onPress={() => toggle(k, v)} />
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </>
            ) : null}
            <Muted>Status values are exactly what the bank reported; there is no fixed list.</Muted>
          </Card>
        ) : null}
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          drafts.length ? (
            <View className="mb-3 gap-2">
              {drafts.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/lead-new', params: { draftId: d.id } })}>
                  <Card className="gap-1 border-warning">
                    <Badge label={`Draft · ${d.step.toLowerCase()}`} variant="warning" />
                    <Text>
                      {d.customer ?? 'Customer not entered'} · {d.card?.bank.displayName} {d.card?.name}
                    </Text>
                    <Muted>Resume · expires {formatDateTime(d.expiresAt)}</Muted>
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>{activeCount || q ? 'No leads match these filters.' : 'No leads yet.'}</Text>
              <Muted>{activeCount || q ? 'Clear the search or filters to see all your leads.' : 'Pick a card on Home and create a lead for your customer.'}</Muted>
            </Card>
          )
        }
        renderItem={({ item }) => <LeadRow row={item} onPress={() => router.push({ pathname: '/(advisor)/lead', params: { id: item.id } })} />}
      />
    </Screen>
  );
}
