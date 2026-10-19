import { DEFAULT_TZ } from '@kbs/shared';
import { Pressable, Text as RNText, View } from 'react-native';

import { Card, IconCircle, type IconName, ListItem, Muted, SectionHeader, Skeleton } from '@/components/ui';
import { colors, type Tone } from '@/lib/theme';

/**
 * F-815 Today agenda on the role homes — mobile twin of the web Today rail (F-814). Presentation only: each section
 * comes from an endpoint the role already reads; a failed section says so without blanking the others.
 */

/** "Saturday, 17 October" in IST — same wording as the web greeting line. */
export function todayLabel(now = new Date()) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: DEFAULT_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
}

/** "19d ago" — coarse relative time for list meta. */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export interface TodayRow {
  key: string;
  title: string;
  subtitle?: string | null;
  right?: string;
  onPress?: () => void;
}

export interface TodaySection {
  key: string;
  title: string;
  icon: IconName;
  tone: Tone | 'gold';
  /** null = the list could not be loaded. */
  count: number | null;
  rows: TodayRow[];
  empty: string;
  seeAll?: { label: string; onPress: () => void };
}

/** Empty sections collapse; when nothing waits at all, one "all caught up" line replaces the list. */
export function TodayCard({
  sections,
  loaded,
  caughtUp,
  light,
}: {
  sections: TodaySection[];
  loaded: boolean;
  caughtUp: string;
  /** Header sits on the hero gradient. */
  light?: boolean;
}) {
  const shown = loaded ? sections.filter((s) => s.count !== 0 || s.rows.length) : sections;
  return (
    <View className="gap-3">
      <SectionHeader title="Today" light={light} />
      <Card className="px-4 py-1">
        {shown.length === 0 ? (
          <ListItem
            icon="checkmark-done"
            iconTone="success"
            title="All caught up"
            subtitle={caughtUp}
            last
          />
        ) : null}
        {shown.map((s, i) => (
          <View key={s.key} className={i ? 'border-t border-line pt-1' : ''}>
            <View className="flex-row items-center gap-3 pb-1 pt-3">
              <IconCircle icon={s.icon} tone={s.tone} size={30} />
              <RNText accessibilityRole="header" className="flex-1 font-semibold text-[14px] text-ink">
                {s.title}
              </RNText>
              {!loaded ? (
                <Skeleton className="h-5 w-7 rounded-full" />
              ) : s.count ? (
                <View className="min-w-[26px] items-center rounded-full bg-[#EFE9E1] px-2 py-0.5">
                  <RNText className="font-bold text-[12px] text-brand">{s.count}</RNText>
                </View>
              ) : null}
            </View>
            {!loaded ? (
              <Skeleton className="mb-3 ml-[42px] mt-1 h-3 w-1/2" />
            ) : s.count === null ? (
              <Muted className="pb-3 pl-[42px] text-[13px]">Could not load — pull down to refresh.</Muted>
            ) : s.rows.length === 0 ? (
              <Muted className="pb-3 pl-[42px] text-[13px]">{s.empty}</Muted>
            ) : (
              <View className="pl-[42px]">
                {s.rows.map((r, j) => (
                  <ListItem
                    key={r.key}
                    title={r.title}
                    subtitle={r.subtitle}
                    onPress={r.onPress}
                    last={j === s.rows.length - 1 && !s.seeAll}
                    right={r.right ? <RNText className="font-semibold text-[13px] text-ink">{r.right}</RNText> : undefined}
                  />
                ))}
                {s.seeAll ? (
                  <Pressable accessibilityRole="link" onPress={s.seeAll.onPress} className="py-3">
                    <RNText className="font-semibold text-[13px]" style={{ color: colors.brand }}>
                      {s.seeAll.label}
                    </RNText>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}
