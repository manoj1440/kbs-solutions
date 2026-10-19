import { BlurTargetView, BlurView } from 'expo-blur';
import { createContext, type PropsWithChildren, type RefObject, useContext, useRef } from 'react';
import {
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { shadow } from '@/lib/theme';

/**
 * F-818 glass (mirrors the web `.glass` / `.glass-strong`, F-817).
 *
 * Android blurs a `BlurTargetView` that must not contain the blur itself, so every `GlassScope` paints the ambient
 * orange / teal light into its own target *behind* the content, and every `Glass` inside blurs the nearest scope.
 * iOS and the web preview blur whatever is behind natively. `Screen` and the tab layouts are scopes.
 */
const BlurTarget = createContext<RefObject<View | null> | null>(null);

const glow = (at: string, color: string, size: string): ViewStyle => {
  const css = `radial-gradient(circle ${size} at ${at}, ${color} 0%, rgba(242, 238, 232, 0) 100%)`;
  return (
    Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }
  ) as ViewStyle;
};

/** Cream canvas + ambient light; children render above it and can use `Glass`. */
export function GlassScope({
  children,
  className,
  style,
}: PropsWithChildren<{ className?: string; style?: StyleProp<ViewStyle> }>) {
  const target = useRef<View | null>(null);
  return (
    <View className={className} style={[styles.scope, style]}>
      <BlurTargetView ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[StyleSheet.absoluteFill, glow('100% 0%', 'rgba(240, 90, 40, 0.30)', '420px')]}
        />
        <View
          style={[StyleSheet.absoluteFill, glow('0% 100%', 'rgba(20, 150, 140, 0.20)', '400px')]}
        />
        <View
          style={[StyleSheet.absoluteFill, glow('30% 40%', 'rgba(253, 200, 160, 0.28)', '300px')]}
        />
      </BlurTargetView>
      <BlurTarget.Provider value={target}>{children}</BlurTarget.Provider>
    </View>
  );
}

/**
 * Frosted surface: blur of what is behind + a warm-white tint + a light edge. `strong` for sheets and bars that sit over
 * content (more opaque). Lists, forms and bank-status rows stay on solid `Card`s — glass is for chrome and KPI tiles.
 */
export function Glass({
  children,
  className,
  style,
  strong,
  intensity,
  ...props
}: ViewProps & { className?: string; strong?: boolean; intensity?: number }) {
  const target = useContext(BlurTarget);
  return (
    <View className={className} style={[styles.edge, shadow.sm, style]} {...props}>
      <BlurView
        tint="light"
        intensity={intensity ?? (strong ? 60 : 40)}
        blurTarget={target ?? undefined}
        // SDK 31+ only: older Android phones get the tinted fallback instead of a costly blur
        blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? 'rgba(255, 253, 250, 0.74)' : 'rgba(255, 253, 250, 0.52)' },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scope: { flex: 1, backgroundColor: '#F2EEE8' },
  edge: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)' },
});
