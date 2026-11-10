import Ionicons from '@expo/vector-icons/Ionicons';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, PressableScale, type IconName } from '@/components/ui';
import { colors } from '@/lib/theme';

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
export interface TabSpec {
  name: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/**
 * F-805 / F-818 custom tab bar: frosted glass pill, icons + labels; the selected tab is the accent. The optional centre
 * action is the one filled accent button in the bar.
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
        className="min-h-12 flex-1 items-center justify-center gap-1 py-1.5"
      >
        <View className="h-6 items-center justify-center">
          <Ionicons
            name={active ? x.spec.iconActive : x.spec.icon}
            size={18}
            color={active ? colors.gold : colors.subtle}
          />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            lineHeight: 16,
            color: active ? colors.gold : colors.subtle,
          }}
        >
          {x.spec.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View className="px-3 pt-1.5" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      {/* F-818: frosted pill; the glass is a background layer so the centre action is not clipped */}
      <View className="rounded-[24px]" style={{ boxShadow: '0px 8px 24px rgba(28, 25, 23, 0.10)' }}>
        <Glass strong className="rounded-[24px]" style={StyleSheet.absoluteFill} />
        <View className="flex-row items-end px-1 py-1">
          {center ? items.slice(0, half).map(render) : items.map(render)}
          {center ? (
            <View className="flex-1 items-center gap-1 py-1.5">
              <PressableScale
                accessibilityLabel={center.label}
                onPress={center.onPress}
                className="h-8 w-12 items-center justify-center rounded-lg bg-gold"
              >
                <Ionicons name={center.icon} size={18} color="#fff" />
              </PressableScale>
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12,
                  lineHeight: 16,
                  color: colors.ink,
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
