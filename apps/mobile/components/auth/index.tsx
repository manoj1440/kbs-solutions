import { router } from 'expo-router';
import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import { Text as RNText, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear, Icon, IconButton, type IconName, Screen } from '@/components/ui';
import { colors, gradients, gradientStyle, shadow, type Tone, toneColors } from '@/lib/theme';

/**
 * F-805 auth + gate building blocks (local to the (auth) / (gates) screens): brand mark, gradient-top + white-sheet shell,
 * floating motion wrapper and the full-screen "state" layout used by deactivated / network-blocked.
 */

/** "KBS" wordmark in a rounded badge — gold (default) or white. */
export function LogoMark({ size = 56, tone = 'gold' }: { size?: number; tone?: 'gold' | 'white' }) {
  const gold = tone === 'gold';
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="KBS"
      className="items-center justify-center"
      style={[
        { width: size, height: size, borderRadius: size * 0.3 },
        gold ? gradientStyle(gradients.gold, 135) : { backgroundColor: '#fff' },
        gold ? shadow.gold : shadow.md,
      ]}
    >
      <RNText
        className="font-extrabold text-ink"
        style={{ fontSize: size * 0.32, letterSpacing: size * 0.02 }}
      >
        KBS
      </RNText>
    </View>
  );
}

/** Soft decorative orbs for gradient backgrounds (no business meaning). */
export function Orbs() {
  return (
    <>
      <View
        pointerEvents="none"
        className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-white/[0.05]"
      />
      <View
        pointerEvents="none"
        className="absolute -left-24 top-40 h-52 w-52 rounded-full bg-white/[0.03]"
      />
    </>
  );
}

/** Gently bobbing wrapper (Reanimated withRepeat) for hero artwork. */
export function Floating({
  children,
  delay = 0,
  distance = 8,
  duration = 2200,
  style,
}: PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-distance, { duration, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        ),
      ),
    );
  }, [y, delay, distance, duration]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/**
 * Navy gradient top (~35% of the screen) with brand mark + title, then a white rounded-top sheet for the form.
 * Used by the mobile-number and OTP screens.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  back = true,
}: PropsWithChildren<{ title: string; subtitle: ReactNode; footer?: ReactNode; back?: boolean }>) {
  const insets = useSafeAreaInsets();
  return (
    <Screen inset="none" statusBar="light" padded={false}>
      <View
        pointerEvents="none"
        className="absolute inset-0"
        style={gradientStyle(gradients.heroDeep, 160)}
      />
      <View className="overflow-hidden" style={{ paddingTop: insets.top + 4, minHeight: '34%' }}>
        <Orbs />
        <View className="h-12 flex-row items-center px-4">
          {back && router.canGoBack() ? (
            <IconButton
              icon="chevron-back"
              label="Back"
              tone="light"
              onPress={() => router.back()}
            />
          ) : null}
        </View>
        <Appear className="px-6 pb-10 pt-2">
          <LogoMark size={52} />
          <RNText
            accessibilityRole="header"
            className="mt-5 font-extrabold text-[30px] leading-[36px] tracking-tight text-white"
          >
            {title}
          </RNText>
          {typeof subtitle === 'string' ? (
            <RNText className="mt-1.5 font-medium text-[15px] leading-[22px] text-white/70">
              {subtitle}
            </RNText>
          ) : (
            subtitle
          )}
        </Appear>
      </View>
      <View
        className="-mt-2 flex-1 rounded-t-[32px] bg-white"
        style={{ boxShadow: '0px -10px 30px rgba(5, 15, 38, 0.25)' }}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-5 px-6 pt-8"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        >
          {children}
        </ScrollView>
        {footer}
      </View>
    </Screen>
  );
}

/** Concentric-ring icon badge for full-screen states and results. */
export function StateIcon({
  icon,
  tone = 'default',
  size = 96,
}: {
  icon: IconName;
  tone?: Tone | 'gold';
  size?: number;
}) {
  const t = tone === 'gold' ? { fg: '#7A4F00', bg: colors.goldSoft } : toneColors[tone];
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size * 1.45, height: size * 1.45, backgroundColor: `${t.bg}99` }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: t.bg }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={[{ width: size * 0.62, height: size * 0.62, backgroundColor: t.fg }, shadow.md]}
        >
          <Icon name={icon} size={size * 0.3} color="#fff" />
        </View>
      </View>
    </View>
  );
}

/** Polished full-screen state: big icon, title, optional badge, explanation and pinned actions. */
export function GateState({
  icon,
  tone,
  title,
  badge,
  children,
  actions,
}: PropsWithChildren<{
  icon: IconName;
  tone: Tone | 'gold';
  title: string;
  badge?: ReactNode;
  actions: ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Screen padded={false}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center justify-center px-6 py-10"
      >
        <Appear className="items-center">
          <StateIcon icon={icon} tone={tone} />
        </Appear>
        <Appear index={1} className="mt-6 w-full items-center gap-3">
          {badge ? <View className="flex-row justify-center">{badge}</View> : null}
          <RNText
            accessibilityRole="header"
            className="text-center font-extrabold text-[26px] leading-[32px] tracking-tight text-ink"
          >
            {title}
          </RNText>
        </Appear>
        <Appear index={2} className="mt-3 w-full">
          {children}
        </Appear>
      </ScrollView>
      <View className="gap-2 px-6 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        {actions}
      </View>
    </Screen>
  );
}
