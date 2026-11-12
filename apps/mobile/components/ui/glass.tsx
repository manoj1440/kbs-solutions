import { type PropsWithChildren } from 'react';
import { type StyleProp, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

/**
 * F-820: the frosted "glass" look (ambient orange / teal light + blur, F-818) is gone. The names stay so call sites keep
 * compiling: `GlassScope` is the flat page canvas and `Glass` is a solid white surface. No gradient, no blur, no edge.
 */
export function GlassScope({
  children,
  className,
  style,
}: PropsWithChildren<{ className?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View className={className} style={[styles.scope, style]}>
      {children}
    </View>
  );
}

/** Solid white surface for chrome (tab bar, pinned footers, sheets) and tiles. `strong` / `intensity` are accepted and ignored. */
export function Glass({
  children,
  className,
  style,
  strong,
  intensity,
  ...props
}: ViewProps & { className?: string; strong?: boolean; intensity?: number }) {
  void strong;
  void intensity;
  return (
    <View className={className} style={[styles.surface, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scope: { flex: 1, backgroundColor: '#F4F3F1' },
  surface: { overflow: 'hidden', backgroundColor: '#FFFFFF' },
});
