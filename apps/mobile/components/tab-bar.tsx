import Ionicons from '@expo/vector-icons/Ionicons';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, PressableScale, type IconName } from '@/components/ui';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
export interface TabSpec {
  name: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/**
 * F-805 / F-818 custom tab bar: frosted glass pill, vector icons + labels, animated active pill, optional raised centre action.
 * Hidden while a detail route (not in `tabs`) is focused, so detail screens get the full height and their own AppBar.
 */
export function TabBar({
  state,
  navigation,
  tabs,
  center,
}: BarProps & {
  tabs: TabSpec[];
  center?: { icon: IconName; label: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  const focused = state.routes[state.index]?.name;
  if (!tabs.some((t) => t.name === focused)) return null;
  const items = tabs
    .map((t) => ({ spec: t, route: state.routes.find((r) => r.name === t.name) }))
    .filter((x) => x.route);
  const half = Math.ceil(items.length / 2);
  const render = (x: (typeof items)[number]) => {
    const active = x.route!.name === focused;
    return (
      <Pressable
        key={x.spec.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={x.spec.label}
        onPress={() => {
          const e = navigation.emit({
            type: 'tabPress',
            target: x.route!.key,
            canPreventDefault: true,
          });
          if (!active && !e.defaultPrevented) navigation.navigate(x.route!.name as never);
        }}
        className="flex-1 items-center justify-center gap-1 py-1.5"
      >
        <View className="h-8 w-14 items-center justify-center">
          {active ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="absolute inset-0 rounded-full bg-ink"
            />
          ) : null}
          <Ionicons
            name={active ? x.spec.iconActive : x.spec.icon}
            size={21}
            color={active ? '#fff' : colors.subtle}
          />
        </View>
        <Text
          style={{
            fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
            fontSize: 11,
            color: active ? colors.brand : colors.subtle,
          }}
        >
          {x.spec.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View className="px-3 pt-1.5" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      {/* F-818: frosted pill; the glass is a background layer so the raised centre action is not clipped */}
      <View className="rounded-[28px]" style={{ boxShadow: '0px 8px 24px rgba(28, 25, 23, 0.10)' }}>
        <Glass strong className="rounded-[28px]" style={StyleSheet.absoluteFill} />
        <View className="flex-row items-end px-1 py-1">
          {center ? items.slice(0, half).map(render) : items.map(render)}
          {center ? (
            <View className="flex-1 items-center">
              <PressableScale
                accessibilityLabel={center.label}
                onPress={center.onPress}
                className="-mt-7 h-[58px] w-[58px] items-center justify-center rounded-full border-4 border-canvas"
                style={[gradientStyle(gradients.gold, 135), shadow.gold]}
              >
                <Ionicons name={center.icon} size={28} color="#fff" />
              </PressableScale>
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 11,
                  color: colors.brand,
                  marginTop: 3,
                  marginBottom: 6,
                }}
              >
                {center.label}
              </Text>
            </View>
          ) : null}
          {center ? items.slice(half).map(render) : null}
        </View>
      </View>
    </View>
  );
}
