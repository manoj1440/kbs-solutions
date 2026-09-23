import Ionicons from '@expo/vector-icons/Ionicons';
import { cva, type VariantProps } from 'class-variance-authority';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { cssInterop } from 'nativewind';
import { forwardRef, useCallback, useEffect, useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text as RNText,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avatarColor, colors, gradients, gradientStyle, shadow, type Tone, toneColors } from '@/lib/theme';

/**
 * F-805 design system — premium fintech primitives on NativeWind + shared tokens (ADR-003: in-house, no UI kit).
 * Every component keeps text labels visible (REQ-20 §20.2) and ≥44pt touch targets (REQ-20 §20.5).
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: 'style' });
cssInterop(Animated.View, { className: 'style' });

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ───────────────────────── Typography ───────────────────────── */

export function Text({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cx('font-normal text-[15px] leading-[22px] text-ink', className)} {...props} />;
}
export function Heading({ className, ...props }: TextProps & { className?: string }) {
  return <RNText accessibilityRole="header" className={cx('font-bold text-[22px] leading-[28px] tracking-tight text-ink', className)} {...props} />;
}
export function Display({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cx('font-extrabold text-[32px] leading-[38px] tracking-tight text-ink', className)} {...props} />;
}
export function Muted({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cx('font-normal text-[13px] leading-[19px] text-[#5B6478]', className)} {...props} />;
}
export function Overline({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cx('font-semibold text-[11px] uppercase tracking-[1.2px] text-[#8A93A6]', className)} {...props} />;
}
export function Label({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cx('mb-1.5 font-semibold text-[13px] text-ink', className)} {...props} />;
}
export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return (
    <View accessibilityRole="alert" className="flex-row items-start gap-2 rounded-xl bg-[#FDECEA] px-3 py-2.5">
      <Ionicons name="alert-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
      <RNText className="flex-1 font-medium text-[13px] leading-[19px] text-[#B42318]">{children}</RNText>
    </View>
  );
}

/* ───────────────────────── Icons & surfaces ───────────────────────── */

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 20, color = colors.text, style }: { name: IconName; size?: number; color?: string; style?: ComponentProps<typeof Ionicons>['style'] }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

export function Gradient({ colors: stops = gradients.hero, angle = 135, style, className, children, ...props }: ViewProps & { colors?: readonly string[]; angle?: number; className?: string }) {
  return (
    <View {...props} className={className} style={[gradientStyle(stops, angle), style]}>
      {children}
    </View>
  );
}

/** Pressable with a spring scale — the app-wide press feedback. */
export function PressableScale({ className, style, children, scaleTo = 0.97, disabled, ...props }: PressableProps & { className?: string; scaleTo?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.set(withSpring(scaleTo, { damping: 18, stiffness: 400 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 14, stiffness: 300 }));
      }}
      className={className}
      style={[anim, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Staggered entrance for list items / sections. */
export function Appear({ index = 0, className, style, children }: PropsWithChildren<{ index?: number; className?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 45).duration(380).easing(Easing.out(Easing.cubic))} className={className} style={style}>
      {children}
    </Animated.View>
  );
}

/* ───────────────────────── Buttons ───────────────────────── */

const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-2xl px-5', {
  variants: {
    variant: {
      default: '',
      gold: '',
      secondary: 'bg-[#E8EDFF]',
      outline: 'border-[1.5px] border-line bg-white',
      destructive: 'bg-[#B42318]',
      ghost: 'px-3',
      light: 'bg-white/15 border border-white/25',
    },
    size: { sm: 'h-10 rounded-xl px-4', md: 'h-12', lg: 'h-14' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});
const buttonText = cva('font-semibold', {
  variants: {
    variant: { default: 'text-white', gold: 'text-ink', secondary: 'text-brand', outline: 'text-ink', destructive: 'text-white', ghost: 'text-brand', light: 'text-white' },
    size: { sm: 'text-[14px]', md: 'text-[15px]', lg: 'text-[16px]' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});
const BUTTON_FG: Record<string, string> = { default: '#fff', gold: colors.ink, secondary: colors.brand, outline: colors.ink, destructive: '#fff', ghost: colors.brand, light: '#fff' };

export function Button({
  title,
  variant,
  size,
  className,
  disabled,
  loading,
  icon,
  iconRight,
  style,
  ...props
}: PressableProps & VariantProps<typeof buttonVariants> & { title: string; className?: string; loading?: boolean; icon?: IconName; iconRight?: IconName; style?: StyleProp<ViewStyle> }) {
  const v = variant ?? 'default';
  const fg = BUTTON_FG[v] ?? '#fff';
  const fill: StyleProp<ViewStyle> = v === 'default' ? [gradientStyle(['#16329E', '#2F4FE0', '#3D5AFE'], 120), disabled ? null : shadow.glow] : v === 'gold' ? [gradientStyle(gradients.gold, 120), disabled ? null : shadow.gold] : null;
  return (
    <PressableScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy: !!loading }} disabled={disabled || loading} className={cx(buttonVariants({ variant, size }), disabled && 'opacity-45', className)} style={[fill, style]} {...props}>
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
      <RNText numberOfLines={1} className={buttonText({ variant, size })}>
        {title}
      </RNText>
      {iconRight && !loading ? <Ionicons name={iconRight} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, tone = 'plain', badge, size = 44, color }: { icon: IconName; onPress?: () => void; label: string; tone?: 'plain' | 'light' | 'soft'; badge?: number; size?: number; color?: string }) {
  const bg = tone === 'light' ? 'bg-white/15 border border-white/20' : tone === 'soft' ? 'bg-[#E8EDFF]' : 'bg-white border border-line';
  const fg = color ?? (tone === 'light' ? '#fff' : tone === 'soft' ? colors.brand : colors.ink);
  return (
    <PressableScale accessibilityLabel={badge ? `${label}, ${badge} unread` : label} onPress={onPress} hitSlop={6} className={cx('items-center justify-center rounded-full', bg)} style={{ width: size, height: size }}>
      <Ionicons name={icon} size={20} color={fg} />
      {badge ? (
        <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#E5484D] px-1">
          <RNText className="font-bold text-[10px] text-white">{badge > 99 ? '99+' : badge}</RNText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/* ───────────────────────── Inputs ───────────────────────── */

export const Input = forwardRef<
  TextInput,
  TextInputProps & { className?: string; label?: string; icon?: IconName; prefix?: string; error?: string | null; hint?: string; right?: ReactNode; inputClassName?: string }
>(function Input({ className, label, icon, prefix, error, hint, right, inputClassName, onFocus, onBlur, multiline, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={label || hint || error ? 'gap-0' : undefined}>
      {label ? <Label>{label}</Label> : null}
      <View
        className={cx(
          'flex-row items-center gap-2.5 rounded-2xl border-[1.5px] bg-white px-4',
          multiline ? 'min-h-[96px] items-start py-3' : 'h-[52px]',
          error ? 'border-[#E5484D]' : focused ? 'border-brand' : 'border-line',
          className,
        )}
        style={focused && !error ? { boxShadow: '0px 0px 0px 4px rgba(22, 50, 158, 0.10)' } : undefined}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.brand : colors.subtle} /> : null}
        {prefix ? (
          <View className="flex-row items-center gap-2">
            <RNText className="font-semibold text-[15px] text-ink">{prefix}</RNText>
            <View className="h-5 w-px bg-line" />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor="#98A1B3"
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cx('flex-1 font-normal text-[15px] text-ink', multiline ? 'min-h-[72px]' : 'h-full', inputClassName)}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
          {...props}
        />
        {right}
      </View>
      {error ? <RNText className="mt-1.5 font-medium text-[12px] text-[#B42318]">{error}</RNText> : hint ? <RNText className="mt-1.5 font-normal text-[12px] text-[#8A93A6]">{hint}</RNText> : null}
    </View>
  );
});

/* ───────────────────────── Containers ───────────────────────── */

const cardVariants = cva('rounded-2xl', {
  variants: {
    variant: {
      elevated: 'border border-line bg-white p-4',
      outline: 'border-[1.5px] border-line bg-white p-4',
      tinted: 'bg-[#EEF2FF] p-4',
      flat: 'bg-white p-4',
    },
  },
  defaultVariants: { variant: 'elevated' },
});
export function Card({ className, variant, onPress, style, children, accessibilityLabel, ...props }: ViewProps & VariantProps<typeof cardVariants> & { className?: string; onPress?: () => void }) {
  const s: StyleProp<ViewStyle> = [variant === 'elevated' || !variant ? shadow.sm : null, style];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} className={cx(cardVariants({ variant }), className)} style={s} scaleTo={0.985}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View className={cx(cardVariants({ variant }), className)} style={s} accessibilityLabel={accessibilityLabel} {...props}>
      {children}
    </View>
  );
}

export type BadgeVariant = Tone;
export function Badge({ label, variant = 'default', icon, dot, solid, size = 'md' }: { label: string; variant?: BadgeVariant | null; icon?: IconName; dot?: boolean; solid?: boolean; size?: 'sm' | 'md' }) {
  const t = toneColors[variant ?? 'default'];
  return (
    <View className={cx('flex-row items-center gap-1 self-start rounded-full', size === 'sm' ? 'px-2 py-[2px]' : 'px-2.5 py-1')} style={{ backgroundColor: solid ? t.fg : t.bg }}>
      {dot ? <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: solid ? '#fff' : t.fg }} /> : null}
      {icon ? <Ionicons name={icon} size={12} color={solid ? '#fff' : t.fg} /> : null}
      <RNText className={cx('font-semibold', size === 'sm' ? 'text-[11px]' : 'text-[12px]')} style={{ color: solid ? '#fff' : t.fg }}>
        {label}
      </RNText>
    </View>
  );
}

export function Chip({ label, active, onPress, icon, count }: { label: string; active: boolean; onPress: () => void; icon?: IconName; count?: number }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cx('h-9 flex-row items-center gap-1.5 rounded-full px-3.5', active ? 'bg-ink' : 'border border-line bg-white')}
    >
      {icon ? <Ionicons name={icon} size={15} color={active ? '#fff' : colors.muted} /> : null}
      <RNText className={cx('font-semibold text-[13px]', active ? 'text-white' : 'text-[#374151]')}>{label}</RNText>
      {count !== undefined ? (
        <View className={cx('min-w-[20px] items-center rounded-full px-1.5', active ? 'bg-white/20' : 'bg-[#EEF0F4]')}>
          <RNText className={cx('font-bold text-[11px]', active ? 'text-white' : 'text-[#374151]')}>{count}</RNText>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** Segmented control (animated pill). */
export function Segmented<K extends string>({ options, value, onChange, dark }: { options: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void; dark?: boolean }) {
  return (
    <View accessibilityRole="tablist" className={cx('flex-row rounded-2xl p-1', dark ? 'bg-white/15' : 'bg-[#E9ECF4]')}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.key)} className="h-10 flex-1 items-center justify-center rounded-xl">
            {active ? <Animated.View entering={FadeIn.duration(180)} className={cx('absolute inset-0 rounded-xl', dark ? 'bg-white' : 'bg-white')} style={shadow.sm} /> : null}
            <View className="flex-row items-center gap-1.5">
              <RNText className={cx('font-semibold text-[13px]', active ? 'text-ink' : dark ? 'text-white/80' : 'text-[#5B6478]')}>{o.label}</RNText>
              {o.count ? (
                <View className={cx('min-w-[18px] items-center rounded-full px-1.5', active ? 'bg-brand' : dark ? 'bg-white/20' : 'bg-[#D5DAE6]')}>
                  <RNText className={cx('font-bold text-[10px]', active ? 'text-white' : dark ? 'text-white' : 'text-ink')}>{o.count}</RNText>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ name, size = 44, light }: { name: string; size?: number; light?: boolean }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '•';
  const c = avatarColor(name || '?');
  return (
    <View className="items-center justify-center rounded-full" style={[{ width: size, height: size }, light ? { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' } : gradientStyle([c, `${c}CC`], 135)]}>
      <RNText className="font-bold text-white" style={{ fontSize: size * 0.36 }}>
        {initials}
      </RNText>
    </View>
  );
}

export function IconCircle({ icon, tone = 'default', size = 44, solid }: { icon: IconName; tone?: Tone | 'gold'; size?: number; solid?: boolean }) {
  const t = tone === 'gold' ? { fg: '#7A4F00', bg: colors.goldSoft } : toneColors[tone];
  return (
    <View className="items-center justify-center rounded-2xl" style={{ width: size, height: size, backgroundColor: solid ? t.fg : t.bg }}>
      <Ionicons name={icon} size={size * 0.46} color={solid ? '#fff' : t.fg} />
    </View>
  );
}

export function ProgressBar({ value, tone = 'default', light, height = 8 }: { value: number; tone?: Tone | 'gold'; light?: boolean; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [pct, w]);
  const anim = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));
  const fill = tone === 'gold' ? gradients.gold : tone === 'success' ? gradients.success : ['#16329E', '#3D5AFE'];
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} className={cx('w-full overflow-hidden rounded-full', light ? 'bg-white/20' : 'bg-[#E6EAF2]')} style={{ height }}>
      <Animated.View className="h-full rounded-full" style={[gradientStyle(fill, 90), anim]} />
    </View>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cx('h-px bg-line', className)} />;
}

export function Skeleton({ className, style }: { className?: string; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 800 }), -1, true));
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View className={cx('rounded-xl bg-[#E4E8F1]', className)} style={[anim, style]} />;
}

/** Placeholder list while the first page loads. */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <View accessibilityLabel="Loading" className={cx('gap-3', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function KeyValue({ label, value, mono, last }: { label: string; value: ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <View className={cx('flex-row items-start justify-between gap-4 py-2.5', !last && 'border-b border-line')}>
      <RNText className="font-normal text-[13px] text-[#5B6478]">{label}</RNText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <RNText selectable className={cx('flex-1 text-right font-semibold text-[14px] text-ink', mono && 'tracking-wide')}>
          {value}
        </RNText>
      ) : (
        <View className="flex-1 items-end">{value}</View>
      )}
    </View>
  );
}

const CALLOUT: Record<'info' | 'warning' | 'danger' | 'success' | 'neutral', { icon: IconName; tone: Tone }> = {
  info: { icon: 'information-circle', tone: 'info' },
  warning: { icon: 'warning', tone: 'warning' },
  danger: { icon: 'alert-circle', tone: 'destructive' },
  success: { icon: 'checkmark-circle', tone: 'success' },
  neutral: { icon: 'shield-checkmark', tone: 'secondary' },
};
export function Callout({ kind = 'info', title, children, icon }: PropsWithChildren<{ kind?: keyof typeof CALLOUT; title?: string; icon?: IconName }>) {
  const c = CALLOUT[kind];
  const t = toneColors[c.tone];
  return (
    <View className="flex-row gap-3 rounded-2xl p-3.5" style={{ backgroundColor: t.bg }}>
      <Ionicons name={icon ?? c.icon} size={18} color={t.fg} style={{ marginTop: 1 }} />
      <View className="flex-1 gap-0.5">
        {title ? (
          <RNText className="font-semibold text-[14px]" style={{ color: t.fg }}>
            {title}
          </RNText>
        ) : null}
        {typeof children === 'string' ? <RNText className="font-normal text-[13px] leading-[19px] text-[#374151]">{children}</RNText> : children}
      </View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction, className, light }: { title: string; action?: string; onAction?: () => void; className?: string; light?: boolean }) {
  return (
    <View className={cx('flex-row items-center justify-between', className)}>
      <RNText accessibilityRole="header" className={cx('font-bold text-[17px]', light ? 'text-white' : 'text-ink')}>
        {title}
      </RNText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} className="flex-row items-center gap-0.5">
          <RNText className="font-semibold text-[13px] text-brand">{action}</RNText>
          <Ionicons name="chevron-forward" size={14} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListItem({
  icon,
  iconTone = 'default',
  leading,
  title,
  subtitle,
  right,
  onPress,
  chevron = !!onPress,
  last,
  destructive,
}: {
  icon?: IconName;
  iconTone?: Tone | 'gold';
  leading?: ReactNode;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  destructive?: boolean;
}) {
  const body = (
    <View className={cx('min-h-[60px] flex-row items-center gap-3 py-3', !last && 'border-b border-line')}>
      {leading ?? (icon ? <IconCircle icon={icon} tone={destructive ? 'destructive' : iconTone} size={40} /> : null)}
      <View className="flex-1">
        <RNText numberOfLines={1} className={cx('font-semibold text-[15px]', destructive ? 'text-[#B42318]' : 'text-ink')}>
          {title}
        </RNText>
        {subtitle ? (
          <RNText numberOfLines={2} className="mt-0.5 font-normal text-[13px] text-[#5B6478]">
            {subtitle}
          </RNText>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={title}>
      {body}
    </PressableScale>
  );
}

export function EmptyState({ icon = 'sparkles-outline', title, body, action, onAction, compact }: { icon?: IconName; title: string; body?: string; action?: string; onAction?: () => void; compact?: boolean }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} className={cx('items-center rounded-3xl border border-dashed border-[#CBD2E1] bg-white px-6', compact ? 'py-6' : 'py-10')}>
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF]">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#DDE4FF]">
          <Ionicons name={icon} size={22} color={colors.brand} />
        </View>
      </View>
      <RNText className="text-center font-bold text-[16px] text-ink">{title}</RNText>
      {body ? <RNText className="mt-1.5 text-center font-normal text-[13px] leading-[19px] text-[#5B6478]">{body}</RNText> : null}
      {action && onAction ? <Button title={action} size="sm" variant="secondary" className="mt-4" onPress={onAction} /> : null}
    </Animated.View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" className="items-center rounded-3xl bg-white px-6 py-8" style={shadow.sm}>
      <IconCircle icon="cloud-offline-outline" tone="destructive" size={52} />
      <RNText className="mt-3 text-center font-bold text-[16px] text-ink">Something went wrong</RNText>
      <RNText className="mt-1 text-center font-normal text-[13px] text-[#5B6478]">{message}</RNText>
      {onRetry ? <Button title="Try again" icon="refresh" size="sm" variant="outline" className="mt-4" onPress={onRetry} /> : null}
    </View>
  );
}

export function StatTile({ label, value, icon, tone = 'default', hint, onPress, className }: { label: string; value: string; icon?: IconName; tone?: Tone | 'gold'; hint?: string; onPress?: () => void; className?: string }) {
  const inner = (
    <>
      <View className="flex-row items-center justify-between">
        {icon ? <IconCircle icon={icon} tone={tone} size={36} /> : <View />}
        {onPress ? <Ionicons name="arrow-forward" size={16} color={colors.subtle} /> : null}
      </View>
      <RNText numberOfLines={1} adjustsFontSizeToFit className="mt-3 font-extrabold text-[24px] tracking-tight text-ink">
        {value}
      </RNText>
      <RNText numberOfLines={1} className="font-medium text-[12px] text-[#5B6478]">
        {label}
      </RNText>
      {hint ? (
        <RNText numberOfLines={1} className="mt-0.5 font-normal text-[11px] text-[#8A93A6]">
          {hint}
        </RNText>
      ) : null}
    </>
  );
  return (
    <Card onPress={onPress} className={cx('flex-1 p-3.5', className)}>
      {inner}
    </Card>
  );
}

/* ───────────────────────── Layout ───────────────────────── */

/**
 * Safe-area aware screen on the soft canvas. `inset="none"` when a HeroHeader draws under the status bar.
 * `scroll` wraps children in a ScrollView (with pull-to-refresh when `onRefresh` is given); `footer` stays pinned.
 */
export function Screen({
  children,
  className,
  inset = 'top',
  statusBar = 'dark',
  scroll,
  refreshing,
  onRefresh,
  contentClassName,
  header,
  footer,
  padded = true,
}: PropsWithChildren<{
  className?: string;
  inset?: 'top' | 'none';
  statusBar?: 'dark' | 'light';
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentClassName?: string;
  header?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(statusBar, true);
    }, [statusBar]),
  );
  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: inset === 'top' ? insets.top : 0 }}>
      {header}
      {scroll ? (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
          contentContainerClassName={cx(padded && 'px-4', 'gap-4 pb-10 pt-2', contentClassName)}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cx('flex-1', padded && 'px-4', 'pt-2', className)}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/** Top bar with back button, title and actions — replaces in-content "← Back" buttons. */
export function AppBar({ title, subtitle, back = true, onBack, right, light, large }: { title?: string; subtitle?: string; back?: boolean; onBack?: () => void; right?: ReactNode; light?: boolean; large?: boolean }) {
  return (
    <View className="px-4 pb-2 pt-1">
      <View className="min-h-[48px] flex-row items-center gap-3">
        {back ? <IconButton icon="chevron-back" label="Back" tone={light ? 'light' : 'plain'} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/' as never)))} /> : null}
        {!large ? (
          <View className="flex-1">
            {title ? (
              <RNText accessibilityRole="header" numberOfLines={1} className={cx('font-bold text-[18px]', light ? 'text-white' : 'text-ink')}>
                {title}
              </RNText>
            ) : null}
            {subtitle ? (
              <RNText numberOfLines={1} className={cx('font-normal text-[12px]', light ? 'text-white/70' : 'text-[#5B6478]')}>
                {subtitle}
              </RNText>
            ) : null}
          </View>
        ) : (
          <View className="flex-1" />
        )}
        {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
      </View>
      {large && title ? (
        <View className="mt-2">
          <RNText accessibilityRole="header" className={cx('font-extrabold text-[28px] tracking-tight', light ? 'text-white' : 'text-ink')}>
            {title}
          </RNText>
          {subtitle ? <RNText className={cx('mt-0.5 font-normal text-[14px]', light ? 'text-white/70' : 'text-[#5B6478]')}>{subtitle}</RNText> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Navy → indigo gradient header with soft orbs; draws under the status bar (use with `Screen inset="none" statusBar="light"`). */
export function HeroHeader({ children, className, colors: stops = gradients.hero, rounded = true, style }: PropsWithChildren<{ className?: string; colors?: readonly string[]; rounded?: boolean; style?: StyleProp<ViewStyle> }>) {
  const insets = useSafeAreaInsets();
  return (
    <View className={cx('overflow-hidden', rounded && 'rounded-b-[32px]')} style={[gradientStyle(stops, 150), { paddingTop: insets.top + 8 }, style]}>
      <View pointerEvents="none" className="absolute -right-16 -top-10 h-56 w-56 rounded-full bg-white/[0.07]" />
      <View pointerEvents="none" className="absolute -left-20 top-24 h-44 w-44 rounded-full bg-white/[0.05]" />
      <View pointerEvents="none" className="absolute right-10 top-40 h-24 w-24 rounded-full" style={{ backgroundColor: 'rgba(245, 185, 66, 0.10)' }} />
      <View className={cx('px-4 pb-6', className)}>{children}</View>
    </View>
  );
}

/** Pinned bottom action area with safe-area padding. */
export function StickyFooter({ children, className }: PropsWithChildren<{ className?: string }>) {
  const insets = useSafeAreaInsets();
  return (
    <View className={cx('gap-2 border-t border-line bg-white px-4 pt-3', className)} style={[{ paddingBottom: Math.max(insets.bottom, 12) + 4 }, { boxShadow: '0px -6px 20px rgba(11, 21, 51, 0.06)' }]}>
      {children}
    </View>
  );
}

/** Modal bottom sheet with backdrop, grabber and title. */
export function BottomSheet({ open, onClose, title, children, footer }: PropsWithChildren<{ open: boolean; onClose: () => void; title?: string; footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-[#0B1533]/50">
          <Pressable accessibilityRole="button" accessibilityLabel="Close" className="flex-1" onPress={onClose} />
        </Animated.View>
        <Animated.View entering={SlideInDown.springify().damping(22).stiffness(220)} exiting={SlideOutDown.duration(200)} className="max-h-[88%] rounded-t-[28px] bg-white" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="items-center pb-1 pt-3">
            <View className="h-1.5 w-10 rounded-full bg-[#D5DAE6]" />
          </View>
          {title ? (
            <View className="flex-row items-center justify-between px-5 pb-2 pt-1">
              <RNText accessibilityRole="header" className="font-bold text-[18px] text-ink">
                {title}
              </RNText>
              <IconButton icon="close" label="Close" size={36} onPress={onClose} />
            </View>
          ) : null}
          <ScrollView contentContainerClassName="gap-4 px-5 pb-4 pt-1" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="flex-row gap-3 border-t border-line px-5 pt-3">{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Numbered progress stepper for multi-step forms. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        {steps.map((s, i) => (
          <View key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EAF2]">
            {i <= current ? <View className="h-full w-full rounded-full" style={gradientStyle(i < current ? gradients.success : ['#16329E', '#3D5AFE'], 90)} /> : null}
          </View>
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <RNText className="font-semibold text-[12px] text-brand">
          Step {Math.min(current + 1, steps.length)} of {steps.length}
        </RNText>
        <RNText className="font-semibold text-[12px] text-[#5B6478]">{steps[current] ?? ''}</RNText>
      </View>
    </View>
  );
}

/** Radio / checkbox row used by forms and assessments. */
export function ChoiceRow({ label, selected, onPress, multi, sub, disabled }: { label: string; selected: boolean; onPress: () => void; multi?: boolean; sub?: string; disabled?: boolean }) {
  return (
    <PressableScale
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.985}
      className={cx('min-h-[52px] flex-row items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3', selected ? 'border-brand bg-[#EEF2FF]' : 'border-line bg-white', disabled && 'opacity-50')}
    >
      <Ionicons name={multi ? (selected ? 'checkbox' : 'square-outline') : selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.brand : colors.subtle} />
      <View className="flex-1">
        <RNText className={cx('text-[15px]', selected ? 'font-semibold text-ink' : 'font-medium text-ink')}>{label}</RNText>
        {sub ? <RNText className="font-normal text-[12px] text-[#5B6478]">{sub}</RNText> : null}
      </View>
    </PressableScale>
  );
}
