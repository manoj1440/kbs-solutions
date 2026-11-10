import { router } from 'expo-router';
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  Keyboard,
  Text as RNText,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear, Icon, IconButton, type IconName, Screen } from '@/components/ui';
import { colors, type Tone, toneColors } from '@/lib/theme';

/**
 * F-805 auth + gate building blocks (local to the (auth) / (gates) screens): brand mark, the canvas-top + white-sheet
 * shell and the full-screen "state" layout used by deactivated / network-blocked. Unslop pass: no gradients, orbs or
 * looping motion — the KBS mark is a flat orange tile, the shell is the graphite page canvas.
 */

/** "KBS" wordmark on a flat tile — brand orange (default) or white. */
export function LogoMark({ size = 56, tone = 'gold' }: { size?: number; tone?: 'gold' | 'white' }) {
  const gold = tone === 'gold';
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="KBS"
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        backgroundColor: gold ? colors.orange : '#fff',
        borderWidth: gold ? 0 : 1,
        borderColor: 'rgba(23, 23, 23, 0.08)',
      }}
    >
      <RNText className="font-medium text-ink" style={{ fontSize: Math.round(size * 0.32) }}>
        KBS
      </RNText>
    </View>
  );
}

/** Was decorative orbs behind gradient backgrounds; kept as a no-op so older call sites compile. */
export function Orbs() {
  return null;
}

/**
 * Was a looping bob for hero artwork. Looping motion that is not live status is gone — this is a plain wrapper now;
 * `delay` / `distance` / `duration` are accepted for older call sites and ignored.
 */
export function Floating({
  children,
  style,
}: PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  return <View style={style}>{children}</View>;
}

/**
 * Brand mark + title on the page canvas, then a white sheet with a hairline for the form.
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
  // F-818: while the keyboard is open the brand header collapses so the field and its button stay above the keyboard
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <Screen inset="none" statusBar="dark" padded={false}>
      <View style={{ paddingTop: insets.top + 4, minHeight: keyboard ? undefined : '30%' }}>
        <View className="h-12 flex-row items-center px-4">
          {back && router.canGoBack() ? (
            <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          ) : null}
        </View>
        <Appear className={keyboard ? 'px-6 pb-6' : 'px-6 pb-8 pt-2'}>
          {keyboard ? null : <LogoMark size={44} />}
          <RNText
            accessibilityRole="header"
            className={
              keyboard ? 'font-medium text-xl text-ink' : 'mt-5 font-medium text-2xl text-ink'
            }
          >
            {title}
          </RNText>
          {keyboard ? null : typeof subtitle === 'string' ? (
            <RNText className="mt-1.5 font-normal text-base text-[#525252]">{subtitle}</RNText>
          ) : (
            subtitle
          )}
        </Appear>
      </View>
      <View className="flex-1 rounded-t-3xl border-t border-line bg-white">
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

/** Quiet icon tile for full-screen states and results (tone colour carries the meaning). */
export function StateIcon({
  icon,
  tone = 'default',
  size = 56,
}: {
  icon: IconName;
  tone?: Tone | 'gold';
  size?: number;
}) {
  const t = tone === 'gold' ? { fg: colors.gold, bg: colors.goldSoft } : toneColors[tone];
  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: t.bg }}
    >
      <Icon name={icon} size={18} color={t.fg} />
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
        <Appear
          index={1}
          className="mt-6 w-full items-center gap-3"
          style={{ alignSelf: 'stretch' }}
        >
          {badge ? <View className="flex-row justify-center">{badge}</View> : null}
          <RNText accessibilityRole="header" className="text-center font-medium text-2xl text-ink">
            {title}
          </RNText>
        </Appear>
        <Appear index={2} className="mt-3 w-full" style={{ alignSelf: 'stretch' }}>
          {children}
        </Appear>
      </ScrollView>
      <View className="gap-2 px-6 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        {actions}
      </View>
    </Screen>
  );
}
