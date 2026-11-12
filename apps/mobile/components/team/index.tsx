import { type Distribution } from '@kbs/shared';
import type { ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';

import { Card, IconCircle, type IconName } from '@/components/ui';
import { type Tone } from '@/lib/theme';

/**
 * F-805 team primitives shared by the Manager and Telecaller areas (presentation only).
 * Every dashboard number keeps its source label (F-702: a connected call is never confused with a bank activation).
 */

/** Plain-words label for a metric source (same words the screens used before F-805). */
export const SOURCE_LABEL: Record<string, string> = {
  TELEPHONY_PROVIDER: 'provider',
  KBS_CALLING: 'KBS calling',
  KBS_SHARING: 'share log',
  KBS_LEADS: 'KBS leads',
  BANK_MIS: 'bank MIS',
  KBS_PAYOUT_LEDGER: 'payout ledger',
};
/** Source dot — the provenance colours (bank MIS / KBS payment / KBS operational), same as `ProvenanceChip`. */
const SOURCE_DOT: Record<string, string> = {
  BANK_MIS: '#5B2BA3',
  KBS_PAYOUT_LEDGER: '#246B47',
};
const OPERATIONAL_DOT = '#215F7A';

export interface MetricLike {
  value: number;
  amountInr?: number;
  denominator?: { label: string; value: number };
  source: string;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "₹1,500 · of 7 · bank MIS" — the meta line under a metric, identical wording to the pre-F-805 tiles. */
export function metricMeta(m: MetricLike, money?: boolean) {
  return `${money && m.amountInr !== undefined ? `${inr(m.amountInr)} · ` : ''}${m.denominator ? `of ${m.denominator.value} · ` : ''}${SOURCE_LABEL[m.source] ?? m.source}`;
}

/** Tag showing where a number comes from: a provenance dot and a quiet label. */
export function SourceTag({ source, light }: { source: string; light?: boolean }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: SOURCE_DOT[source] ?? OPERATIONAL_DOT }}
      />
      <RNText
        numberOfLines={1}
        className={
          light ? 'font-normal text-xs text-white/60' : 'font-normal text-xs text-[#737373]'
        }
      >
        {SOURCE_LABEL[source] ?? source}
      </RNText>
    </View>
  );
}

/** White metric tile with value, label, optional money/denominator and the source label. */
export function MetricTile({
  label,
  m,
  money,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  m: MetricLike;
  money?: boolean;
  icon?: IconName;
  tone?: Tone | 'gold';
  className?: string;
}) {
  void icon;
  return (
    <Card
      accessibilityLabel={`${label}: ${m.value}, ${metricMeta(m, money)}`}
      className={`p-4 ${className ?? ''}`}
    >
      {/* `icon` / `tone` only decorated the tile — the label, the figure and its source carry it */}
      <RNText numberOfLines={1} className="font-normal text-sm text-[#525252]">
        {label}
      </RNText>
      <RNText
        numberOfLines={1}
        adjustsFontSizeToFit
        className={`mt-2 font-medium text-xl tabular-nums ${tone === 'gold' ? 'text-gold' : 'text-ink'}`}
      >
        {m.value}
      </RNText>
      {money || m.denominator ? (
        <RNText
          numberOfLines={1}
          className="mt-0.5 font-normal text-xs text-[#737373] tabular-nums"
        >
          {money ? inr(m.amountInr ?? 0) : ''}
          {money && m.denominator ? ' · ' : ''}
          {m.denominator ? `of ${m.denominator.value}` : ''}
        </RNText>
      ) : null}
      <View className="mt-2">
        <SourceTag source={m.source} />
      </View>
    </Card>
  );
}

/** Compact figure tile for page headers: label, figure, meta. `icon` / `accent` are accepted and not drawn. */
export function HeroTile({
  label,
  value,
  meta,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  icon?: IconName;
  accent?: string;
}) {
  void icon;
  void accent;
  return (
    <View className="flex-1 rounded-xl border border-line bg-white p-3">
      <RNText numberOfLines={1} className="font-normal text-sm text-[#525252]">
        {label}
      </RNText>
      <RNText
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-1 font-medium text-xl text-ink tabular-nums"
      >
        {value}
      </RNText>
      {meta ? (
        <View className="mt-0.5">
          {typeof meta === 'string' ? (
            <RNText numberOfLines={1} className="font-normal text-xs text-[#737373]">
              {meta}
            </RNText>
          ) : (
            meta
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Bank MIS distribution (values verbatim). Bars are one neutral colour — they show counts, never a success/failure judgement. */
export function DistributionCard({
  title,
  icon,
  d,
}: {
  title: string;
  icon: IconName;
  d: Distribution;
}) {
  void icon;
  const max = Math.max(1, ...d.buckets.map((b) => b.count));
  return (
    <Card className="gap-3">
      <View>
        <RNText className="font-medium text-base text-ink">{title}</RNText>
        <RNText className="font-normal text-xs text-[#737373] tabular-nums">
          Bank MIS · {d.denominator.value} leads
        </RNText>
      </View>
      {d.buckets.map((b) => {
        const soft = b.value === 'Awaiting MIS' || b.value === 'Not reported';
        return (
          <View key={b.value} accessibilityLabel={`${b.value}: ${b.count}`} className="gap-1">
            <View className="flex-row items-center justify-between gap-2">
              <RNText
                numberOfLines={2}
                className={`flex-1 text-sm ${soft ? 'font-normal text-[#737373]' : 'font-normal text-ink'}`}
              >
                {b.value}
              </RNText>
              <RNText className="font-medium text-sm text-ink tabular-nums">{b.count}</RNText>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-raised">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${(b.count / max) * 100}%`,
                  backgroundColor: soft ? '#D4D4D4' : '#8A8A8A',
                }}
              />
            </View>
          </View>
        );
      })}
      {d.buckets.length === 0 ? (
        <RNText className="font-normal text-sm text-[#525252]">No leads yet</RNText>
      ) : null}
    </Card>
  );
}

/** Vertical timeline row (history trails). */
export function TimelineItem({
  icon,
  tone = 'secondary',
  title,
  meta,
  children,
  last,
}: {
  icon: IconName;
  tone?: Tone | 'gold';
  title: ReactNode;
  meta?: string;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <IconCircle icon={icon} tone={tone} size={32} />
        {!last ? <View className="mt-1 w-px flex-1 bg-[#E5E5E5]" /> : null}
      </View>
      <View className={`flex-1 gap-0.5 ${last ? 'pb-1' : 'pb-4'}`}>
        {typeof title === 'string' ? (
          <RNText className="font-medium text-md text-ink">{title}</RNText>
        ) : (
          title
        )}
        {meta ? <RNText className="font-normal text-xs text-[#525252]">{meta}</RNText> : null}
        {children}
      </View>
    </View>
  );
}

/** Sentence-case an ENUM_VALUE for display ("LINK_SHARED" → "Link shared"). */
export function humanize(s: string) {
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** User account status tone — same mapping as before F-805 (active = success, anything else neutral). */
export function userStatusTone(status: string): Tone {
  return status === 'ACTIVE' ? 'success' : 'unknown';
}
