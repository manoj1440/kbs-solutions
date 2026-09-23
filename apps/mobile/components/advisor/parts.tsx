import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, Pressable, Text as RNText, ScrollView, View } from 'react-native';

import { Card, IconCircle, type IconName, PressableScale } from '@/components/ui';
import { colors, type Tone } from '@/lib/theme';

/**
 * F-805 Advisor-area presentation helpers (layout only — no data or business logic). Generic enough to promote into
 * `components/ui` later; kept here so the shared design-system file stays owned by one change.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** A white card with an icon + title header — the building block of detail pages. */
export function SectionCard({
  icon,
  tone = 'default',
  title,
  subtitle,
  right,
  children,
  className,
  testID,
}: PropsWithChildren<{
  icon: IconName;
  tone?: Tone | 'gold';
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  className?: string;
  testID?: string;
}>) {
  return (
    <Card className={cx('gap-3', className)} testID={testID}>
      <View className="flex-row items-center gap-3">
        <IconCircle icon={icon} tone={tone} size={36} />
        <View className="flex-1">
          <RNText accessibilityRole="header" className="font-bold text-[15px] text-ink">
            {title}
          </RNText>
          {subtitle ? (
            <RNText className="font-normal text-[12px] leading-[17px] text-[#5B6478]">
              {subtitle}
            </RNText>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </Card>
  );
}

/** Label / value row for bank fields shown verbatim; a blank (unknown) value is rendered muted + italic. */
export function FieldRow({
  label,
  value,
  unknown,
  last,
}: {
  label: string;
  value: string;
  unknown?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={cx(
        'flex-row items-start justify-between gap-4 py-2.5',
        !last && 'border-b border-line',
      )}
    >
      <RNText className="max-w-[48%] font-normal text-[13px] text-[#5B6478]">{label}</RNText>
      <RNText
        selectable
        className={cx(
          'flex-1 text-right text-[13px]',
          unknown ? 'font-normal italic text-[#8A93A6]' : 'font-semibold text-ink',
        )}
      >
        {value}
      </RNText>
    </View>
  );
}

/** Vertical timeline (chronological log). Purely a list — it never implies an ordered bank progression. */
export function Timeline({
  items,
}: {
  items: {
    id: string;
    title: string;
    meta?: string | null;
    detail?: string | null;
    icon?: IconName;
    tone?: Tone;
  }[];
}) {
  return (
    <View>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <View key={it.id} className="flex-row gap-3">
            <View className="items-center">
              <View
                className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#E8EDFF]"
                style={{ boxShadow: '0px 0px 0px 1px #E6EAF2' }}
              >
                <Ionicons name={it.icon ?? 'ellipse'} size={14} color={colors.brand} />
              </View>
              {!last ? <View className="w-[2px] flex-1 bg-line" /> : null}
            </View>
            <View className={cx('flex-1 pt-1', !last && 'pb-4')}>
              <RNText className="font-semibold text-[14px] leading-[19px] text-ink">
                {it.title}
              </RNText>
              {it.detail ? (
                <RNText className="mt-0.5 font-normal text-[13px] leading-[18px] text-[#374151]">
                  {it.detail}
                </RNText>
              ) : null}
              {it.meta ? (
                <RNText className="mt-0.5 font-normal text-[12px] text-[#8A93A6]">{it.meta}</RNText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Labelled group of horizontally scrolling chips (filter sheets). */
export function ChipGroup({
  label,
  children,
  wrap,
}: PropsWithChildren<{ label: string; wrap?: boolean }>) {
  return (
    <View className="gap-2">
      <RNText className="font-semibold text-[11px] uppercase tracking-[1.2px] text-[#8A93A6]">
        {label}
      </RNText>
      {wrap ? (
        <View className="flex-row flex-wrap gap-2">{children}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5"
          contentContainerClassName="gap-2 px-5"
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

/** Pill button with a visible label and an active-count badge (e.g. "Filters 2"). */
export function PillButton({
  icon,
  label,
  count,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  count?: number;
  onPress: () => void;
  active?: boolean;
}) {
  const on = active || !!count;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} active` : label}
      onPress={onPress}
      hitSlop={4}
      className={cx(
        'h-11 flex-row items-center gap-1.5 rounded-full px-3.5',
        on ? 'bg-ink' : 'border border-line bg-white',
      )}
    >
      <Ionicons name={icon} size={17} color={on ? '#fff' : colors.ink} />
      <RNText className={cx('font-semibold text-[13px]', on ? 'text-white' : 'text-ink')}>
        {label}
      </RNText>
      {count ? (
        <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1">
          <RNText className="font-bold text-[11px] text-ink">{count}</RNText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** Square selection box used by selectable list rows. */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View
      className={cx(
        'h-6 w-6 items-center justify-center rounded-[7px]',
        checked ? 'bg-brand' : 'border-[1.5px] border-[#C5CCDB] bg-white',
      )}
    >
      {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
    </View>
  );
}

/**
 * Reference value with a copy affordance. The text is always selectable (long-press copy on native); the explicit copy
 * button is shown only where a clipboard API exists (web) — no new native module.
 */
export function CopyValue({ value, light }: { value: string; light?: boolean }) {
  const [copied, setCopied] = useState(false);
  const clip =
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? (navigator as Navigator & { clipboard?: Clipboard }).clipboard
      : undefined;
  return (
    <View className="flex-row items-center gap-2">
      <RNText
        selectable
        className={cx('font-bold text-[14px] tracking-wide', light ? 'text-white' : 'text-ink')}
      >
        {value}
      </RNText>
      {clip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Copied' : `Copy ${value}`}
          hitSlop={10}
          onPress={() => {
            void clip.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className={cx(
            'h-7 w-7 items-center justify-center rounded-full',
            light ? 'bg-white/15' : 'bg-[#E8EDFF]',
          )}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={14}
            color={light ? '#fff' : colors.brand}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small "i" meta line with an icon — used for provenance / as-of notes. */
export function MetaLine({
  icon,
  children,
  className,
}: PropsWithChildren<{ icon: IconName; className?: string }>) {
  return (
    <View className={cx('flex-row items-start gap-1.5', className)}>
      <Ionicons name={icon} size={13} color={colors.subtle} style={{ marginTop: 2 }} />
      <RNText className="flex-1 font-normal text-[12px] leading-[17px] text-[#5B6478]">
        {children}
      </RNText>
    </View>
  );
}
