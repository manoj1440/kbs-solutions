import Ionicons from '@expo/vector-icons/Ionicons';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, type IconName } from '@/components/ui';
import { colors } from '@/lib/theme';

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
export interface TabSpec {
  name: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/**
 * F-820 tab bar: full-width white bar with icons + labels; the selected tab is the accent. The optional centre action
 * (e.g. New lead) is a filled accent circle with no label — its accessibility label names it.
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
        className="h-16 flex-1 items-center justify-center gap-1"
      >
        <View className="h-6 items-center justify-center">
          <Ionicons
            name={active ? x.spec.iconActive : x.spec.icon}
            size={24}
            color={active ? colors.gold : '#8A847D'}
          />
        </View>
        <Text
          style={{
            fontFamily: 'Manrope_600SemiBold',
            fontSize: 12,
            lineHeight: 16,
            color: active ? colors.gold : '#6A625D',
          }}
        >
          {x.spec.label}
        </Text>
      </Pressable>
    );
  };
  return (
    // F-820: a plain full-width bar — white, hairline on top, 64 px targets. The centre action is the one filled circle.
    <View
      className="flex-row items-center border-t border-line bg-white px-2"
      style={{ paddingBottom: Math.max(insets.bottom, 6) }}
    >
      {center ? items.slice(0, half).map(render) : items.map(render)}
      {center ? (
        <View className="h-16 flex-1 items-center justify-center">
          <PressableScale
            accessibilityLabel={center.label}
            onPress={center.onPress}
            className="h-12 w-12 items-center justify-center rounded-full bg-gold"
            style={{ boxShadow: '0px 6px 14px rgba(22, 19, 15, 0.18)' }}
          >
            <Ionicons name={center.icon} size={24} color="#fff" />
          </PressableScale>
        </View>
      ) : null}
      {center ? items.slice(half).map(render) : null}
    </View>
  );
}
