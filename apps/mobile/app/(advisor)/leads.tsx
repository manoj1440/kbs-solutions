import {
  ApiClientError,
  FILTER_AWAITING,
  FILTER_NOT_REPORTED,
  formatDateTime,
  type LeadFilterOptions,
  type LeadStatusRow,
  LEAD_SORTS,
  MIS_FRESHNESS,
} from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text as RNText,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { ChipGroup, PillButton } from '@/components/advisor/parts';
import { LeadRow } from '@/components/lead-row';
import {
  Appear,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
  Icon,
  Input,
  Muted,
  PressableScale,
  Screen,
  SkeletonList,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, gradientStyle, shadow } from '@/lib/theme';

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
const SORT_LABEL: Record<(typeof LEAD_SORTS)[number], string> = {
  createdAt_desc: 'Newest',
  createdAt_asc: 'Oldest',
  lastMatchedAt_desc: 'Latest MIS',
  lastMatchedAt_asc: 'Stalest MIS',
  customer_asc: 'A→Z',
};
const FRESH_LABEL: Record<(typeof MIS_FRESHNESS)[number], string> = {
  never: 'Never matched',
  recent: 'Last 7 days',
  older7d: '> 7 days',
  older30d: '> 30 days',
};
const DEFAULT_FILTERS: Filters = { sort: 'createdAt_desc' };
const countActive = (f: Filters) =>
  Object.entries(f).filter(([k, v]) => k !== 'sort' && v).length +
  (f.sort !== 'createdAt_desc' ? 1 : 0);

/** F-408 My Leads: search by name / mobile / reference, filter sheet (issuer, card, stage, decision, activation, MIS freshness, actionable), sort. */
export default function Leads() {
  const [rows, setRows] = useState<LeadStatusRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [draftF, setDraftF] = useState<Filters>(DEFAULT_FILTERS);
  const [options, setOptions] = useState<LeadFilterOptions | null>(null);
  const [sheet, setSheet] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const activeCount = countActive(f);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (q.trim()) qs.set('q', q.trim());
      for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
      const [l, d, o] = await Promise.all([
        api.get<LeadStatusRow[]>(`/leads?${qs.toString()}`),
        api.get<Draft[]>('/leads/drafts'),
        api.get<LeadFilterOptions>('/leads/filters'),
      ]);
      setRows(l.data);
      setTotal(typeof l.meta.total === 'number' ? l.meta.total : l.data.length);
      setDrafts(d.data);
      setOptions(o.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load leads.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [q, f]);
  /** Quick chips and the sheet both toggle the same existing filter fields. */
  const toggleIn = <K extends keyof Filters>(
    set: (fn: (p: Filters) => Filters) => void,
    k: K,
    v: Filters[K],
  ) => set((prev) => ({ ...prev, [k]: prev[k] === v ? undefined : v }));
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => toggleIn(setDraftF, k, v);
  const quick = <K extends keyof Filters>(k: K, v: Filters[K]) => toggleIn(setF, k, v);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const openSheet = () => {
    setDraftF(f);
    setSheet(true);
  };

  const header = (
    <View className="gap-3 px-4 pb-3 pt-1">
      <View className="min-h-[48px] flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <RNText
            accessibilityRole="header"
            className="font-extrabold text-[28px] tracking-tight text-ink"
          >
            My leads
          </RNText>
          <Muted>
            {total !== null
              ? `${total} lead${total === 1 ? '' : 's'}${activeCount || q ? ' match' : ''}`
              : 'Loading…'}
          </Muted>
        </View>
        <PillButton
          icon="options-outline"
          label="Filters"
          count={activeCount}
          onPress={openSheet}
        />
      </View>
      <Input
        icon="search"
        placeholder="Search name, mobile or reference"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load()}
        returnKeyType="search"
        right={
          q ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              onPress={() => setQ('')}
            >
              <Icon name="close-circle" size={18} color={colors.subtle} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4"
        className="-mx-4"
      >
        <Chip
          label="All"
          icon="albums-outline"
          active={activeCount === 0}
          onPress={() => setF(DEFAULT_FILTERS)}
        />
        <Chip
          label="Needs my action"
          icon="flash-outline"
          active={f.actionable === 'true'}
          onPress={() => quick('actionable', 'true')}
        />
        <Chip
          label="Never matched"
          icon="hourglass-outline"
          active={f.misFreshness === 'never'}
          onPress={() => quick('misFreshness', 'never')}
        />
        <Chip
          label="MIS last 7 days"
          icon="sync-outline"
          active={f.misFreshness === 'recent'}
          onPress={() => quick('misFreshness', 'recent')}
        />
      </ScrollView>
    </View>
  );

  const draftsBlock = drafts.length ? (
    <View className="mb-1 gap-2.5">
      <View className="flex-row items-center justify-between">
        <RNText accessibilityRole="header" className="font-bold text-[15px] text-ink">
          Continue where you left off
        </RNText>
        <Muted className="text-[12px]">
          {drafts.length} draft{drafts.length === 1 ? '' : 's'}
        </Muted>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4 pb-2"
        className="-mx-4"
      >
        {drafts.map((d, i) => (
          <Appear key={d.id} index={i}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Resume draft for ${d.customer ?? 'customer not entered'}`}
              onPress={() =>
                router.push({ pathname: '/(advisor)/lead-new', params: { draftId: d.id } })
              }
              className="w-[260px] overflow-hidden rounded-3xl p-4"
              style={[
                gradientStyle(['#FFF8E8', '#FFEFC7'], 135),
                shadow.sm,
                { borderWidth: 1, borderColor: '#F6DDA0' },
              ]}
            >
              <View
                pointerEvents="none"
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/50"
              />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1">
                  <Icon name="create-outline" size={12} color="#7A4F00" />
                  <RNText className="font-semibold text-[11px] text-[#7A4F00]">
                    Draft · {d.step.toLowerCase()}
                  </RNText>
                </View>
                <Icon name="arrow-forward-circle" size={24} color="#B7791F" />
              </View>
              <RNText numberOfLines={1} className="mt-3 font-bold text-[16px] text-ink">
                {d.customer ?? 'Customer not entered'}
              </RNText>
              <RNText numberOfLines={1} className="font-medium text-[13px] text-[#5B4A24]">
                {d.card?.bank.displayName} {d.card?.name}
              </RNText>
              <View className="mt-3 flex-row items-center gap-1.5">
                <Icon name="time-outline" size={12} color="#8A6D2F" />
                <RNText className="font-medium text-[12px] text-[#8A6D2F]">
                  Resume · expires {formatDateTime(d.expiresAt)}
                </RNText>
              </View>
            </PressableScale>
          </Appear>
        ))}
      </ScrollView>
      <RNText accessibilityRole="header" className="mt-2 font-bold text-[15px] text-ink">
        Submitted leads
      </RNText>
    </View>
  ) : null;

  return (
    <Screen padded={false} header={header}>
      {!loaded ? (
        <View className="px-4">
          <SkeletonList rows={4} />
        </View>
      ) : error && rows.length === 0 ? (
        <View className="px-4">
          <ErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-3 px-4 pb-10"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListHeaderComponent={
            <>
              {error ? (
                <View className="mb-3">
                  <ErrorText>{error}</ErrorText>
                </View>
              ) : null}
              {draftsBlock}
            </>
          }
          ListEmptyComponent={
            loading ? null : activeCount || q ? (
              <EmptyState
                icon="funnel-outline"
                title="No leads match these filters."
                body="Clear the search or filters to see all your leads."
                action="Clear search & filters"
                onAction={() => {
                  setQ('');
                  setF(DEFAULT_FILTERS);
                }}
              />
            ) : (
              <EmptyState
                icon="document-text-outline"
                title="No leads yet."
                body="Pick a card on Home and create a lead for your customer."
                action="Browse cards"
                onAction={() => router.push('/(advisor)/cards' as never)}
              />
            )
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <LeadRow
                row={item}
                onPress={() =>
                  router.push({ pathname: '/(advisor)/lead', params: { id: item.id } })
                }
              />
            </Appear>
          )}
        />
      )}

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter & sort"
        footer={
          <>
            <Button
              title="Clear"
              variant="outline"
              className="flex-1"
              onPress={() => {
                setDraftF(DEFAULT_FILTERS);
                setF(DEFAULT_FILTERS);
                setSheet(false);
              }}
            />
            <Button
              title={countActive(draftF) ? `Apply (${countActive(draftF)})` : 'Apply'}
              className="flex-[2]"
              onPress={() => {
                setF(draftF);
                setSheet(false);
              }}
            />
          </>
        }
      >
        <View className="gap-5" testID="filter-sheet">
          <ChipGroup label="Sort">
            {LEAD_SORTS.map((s) => (
              <Chip
                key={s}
                label={SORT_LABEL[s]}
                active={draftF.sort === s}
                onPress={() => setDraftF((p) => ({ ...p, sort: s }))}
              />
            ))}
          </ChipGroup>
          <ChipGroup label="MIS freshness">
            {MIS_FRESHNESS.map((m) => (
              <Chip
                key={m}
                label={FRESH_LABEL[m]}
                active={draftF.misFreshness === m}
                onPress={() => toggle('misFreshness', m)}
              />
            ))}
          </ChipGroup>
          <ChipGroup label="Actionable" wrap>
            <Chip
              label="Needs my action"
              active={draftF.actionable === 'true'}
              onPress={() => toggle('actionable', 'true')}
            />
            <Chip
              label="Nothing pending"
              active={draftF.actionable === 'false'}
              onPress={() => toggle('actionable', 'false')}
            />
          </ChipGroup>
          {options ? (
            <>
              {options.banks.length > 1 ? (
                <ChipGroup label="Issuer">
                  {options.banks.map((b) => (
                    <Chip
                      key={b.id}
                      label={b.displayName}
                      active={draftF.bankId === b.id}
                      onPress={() => toggle('bankId', b.id)}
                    />
                  ))}
                </ChipGroup>
              ) : null}
              {options.cards.length > 1 ? (
                <ChipGroup label="Card">
                  {options.cards.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      active={draftF.cardId === c.id}
                      onPress={() => toggle('cardId', c.id)}
                    />
                  ))}
                </ChipGroup>
              ) : null}
              {(
                [
                  ['stage', 'Stage', options.stages],
                  ['decision', 'Decision', options.decisions],
                  ['activation', 'Activation', options.activations],
                ] as const
              ).map(([k, label, values]) => (
                <ChipGroup key={k} label={label}>
                  <Chip
                    label="Awaiting MIS Update"
                    active={draftF[k] === FILTER_AWAITING}
                    onPress={() => toggle(k, FILTER_AWAITING)}
                  />
                  <Chip
                    label="Not reported"
                    active={draftF[k] === FILTER_NOT_REPORTED}
                    onPress={() => toggle(k, FILTER_NOT_REPORTED)}
                  />
                  {values.map((v) => (
                    <Chip key={v} label={v} active={draftF[k] === v} onPress={() => toggle(k, v)} />
                  ))}
                </ChipGroup>
              ))}
            </>
          ) : null}
          <View className="flex-row items-start gap-2 rounded-2xl bg-[#F1ECFB] p-3">
            <Icon name="business-outline" size={15} color="#5B2BA8" style={{ marginTop: 1 }} />
            <Muted className="flex-1 text-[12px] text-[#4A3A6B]">
              Status values are exactly what the bank reported; there is no fixed list.
            </Muted>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
