import { type Distribution } from '@kbs/shared';
import type { ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';

import { Card, Icon, IconCircle, type IconName } from '@/components/ui';
import { colors, type Tone } from '@/lib/theme';

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
const SOURCE_ICON: Record<string, IconName> = {
  TELEPHONY_PROVIDER: 'call-outline',
  KBS_CALLING: 'headset-outline',
  KBS_SHARING: 'share-social-outline',
  KBS_LEADS: 'document-text-outline',
  BANK_MIS: 'business-outline',
  KBS_PAYOUT_LEDGER: 'wallet-outline',
};

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

/** Tag showing where a number comes from. */
export function SourceTag({ source, light }: { source: string; light?: boolean }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon
        name={SOURCE_ICON[source] ?? 'information-circle-outline'}
        size={11}
        color={light ? 'rgba(255,255,255,0.6)' : colors.subtle}
      />
      <RNText
        numberOfLines={1}
        className={
          light ? 'font-medium text-[11px] text-white/60' : 'font-medium text-[11px] text-[#8A93A6]'
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
  return (
    <Card
      accessibilityLabel={`${label}: ${m.value}, ${metricMeta(m, money)}`}
      className={`p-3.5 ${className ?? ''}`}
    >
      <View className="flex-row items-center justify-between">
        {icon ? <IconCircle icon={icon} tone={tone} size={34} /> : <View />}
        <SourceTag source={m.source} />
      </View>
      <RNText
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-3 font-extrabold text-[24px] tracking-tight text-ink"
      >
        {m.value}
      </RNText>
      <RNText numberOfLines={1} className="font-medium text-[12px] text-[#5B6478]">
        {label}
      </RNText>
      {money || m.denominator ? (
        <RNText numberOfLines={1} className="mt-0.5 font-semibold text-[11px] text-[#8A93A6]">
          {money ? inr(m.amountInr ?? 0) : ''}
          {money && m.denominator ? ' · ' : ''}
          {m.denominator ? `of ${m.denominator.value}` : ''}
        </RNText>
      ) : null}
    </Card>
  );
}

/** Glassy tile for hero headers (navy gradient background). */
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
  return (
    <View className="flex-1 rounded-2xl border border-white/15 bg-white/10 p-3">
      <View className="flex-row items-center gap-1.5">
        {icon ? <Icon name={icon} size={13} color={accent ?? 'rgba(255,255,255,0.75)'} /> : null}
        <RNText
          numberOfLines={1}
          className="flex-1 font-semibold text-[11px] uppercase tracking-[0.8px] text-white/70"
        >
          {label}
        </RNText>
      </View>
      <RNText
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-1.5 font-extrabold text-[26px] tracking-tight text-white"
      >
        {value}
      </RNText>
      {meta ? (
        <View className="mt-0.5">
          {typeof meta === 'string' ? (
            <RNText numberOfLines={1} className="font-medium text-[11px] text-white/60">
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
  const max = Math.max(1, ...d.buckets.map((b) => b.count));
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <IconCircle icon={icon} tone="secondary" size={36} />
        <View className="flex-1">
          <RNText className="font-bold text-[15px] text-ink">{title}</RNText>
          <RNText className="font-normal text-[12px] text-[#5B6478]">
            Bank MIS values verbatim · {d.denominator.value} leads
          </RNText>
        </View>
      </View>
      {d.buckets.map((b) => {
        const soft = b.value === 'Awaiting MIS' || b.value === 'Not reported';
        return (
          <View key={b.value} accessibilityLabel={`${b.value}: ${b.count}`} className="gap-1">
            <View className="flex-row items-center justify-between gap-2">
              <RNText
                numberOfLines={2}
                className={`flex-1 text-[13px] ${soft ? 'font-normal italic text-[#8A93A6]' : 'font-medium text-ink'}`}
              >
                {b.value}
              </RNText>
              <RNText className="font-bold text-[13px] text-ink">{b.count}</RNText>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-[#EEF0F4]">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${(b.count / max) * 100}%`,
                  backgroundColor: soft ? '#C3C9D6' : '#5B6BB0',
                }}
              />
            </View>
          </View>
        );
      })}
      {d.buckets.length === 0 ? (
        <RNText className="font-normal text-[13px] text-[#5B6478]">No leads yet.</RNText>
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
        {!last ? <View className="mt-1 w-[2px] flex-1 rounded-full bg-line" /> : null}
      </View>
      <View className={`flex-1 gap-0.5 ${last ? 'pb-1' : 'pb-4'}`}>
        {typeof title === 'string' ? (
          <RNText className="font-semibold text-[14px] leading-[20px] text-ink">{title}</RNText>
        ) : (
          title
        )}
        {meta ? (
          <RNText className="font-normal text-[12px] leading-[17px] text-[#5B6478]">{meta}</RNText>
        ) : null}
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

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
