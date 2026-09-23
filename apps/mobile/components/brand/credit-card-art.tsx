import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cardArt, gradientStyle, shadow } from '@/lib/theme';

/**
 * F-805: generic credit-card artwork drawn with Views (no bank logos or brand marks — the bank name is plain text).
 * Palette is deterministic per bank so the same issuer always looks the same across the app.
 */
export function CreditCardArt({
  bank,
  name,
  width = 300,
  seed,
  style,
  masked = '•••• •••• •••• 4821',
  compact,
}: {
  bank: string;
  name?: string;
  width?: number;
  seed?: string;
  style?: StyleProp<ViewStyle>;
  masked?: string;
  compact?: boolean;
}) {
  const h = width * 0.63;
  const stops = cardArt(seed ?? bank);
  const s = width / 300;
  return (
    <View
      accessibilityLabel={`${bank}${name ? ` ${name}` : ''} card`}
      className="overflow-hidden"
      style={[
        { width, height: h, borderRadius: 18 * s, padding: 18 * s },
        gradientStyle(stops, 135),
        shadow.lg,
        style,
      ]}
    >
      <View
        pointerEvents="none"
        className="absolute rounded-full"
        style={{
          width: width * 0.9,
          height: width * 0.9,
          right: -width * 0.45,
          top: -width * 0.35,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />
      <View
        pointerEvents="none"
        className="absolute rounded-full"
        style={{
          width: width * 0.6,
          height: width * 0.6,
          left: -width * 0.25,
          bottom: -width * 0.38,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      />
      <View className="flex-row items-start justify-between">
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 13 * s,
            letterSpacing: 1.2 * s,
            color: '#fff',
            maxWidth: width * 0.6,
          }}
        >
          {bank.toUpperCase()}
        </Text>
        <Ionicons
          name="wifi"
          size={18 * s}
          color="rgba(255,255,255,0.85)"
          style={{ transform: [{ rotate: '90deg' }] }}
        />
      </View>
      <View
        style={{
          marginTop: (compact ? 10 : 18) * s,
          width: 38 * s,
          height: 28 * s,
          borderRadius: 6 * s,
          ...gradientStyle(['#F9D37A', '#E0A93A', '#F5CD6E'], 120),
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 12 * s,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(122,79,0,0.35)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 13 * s,
            height: 1,
            backgroundColor: 'rgba(122,79,0,0.35)',
          }}
        />
      </View>
      {!compact ? (
        <Text
          style={{
            marginTop: 14 * s,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14 * s,
            letterSpacing: 2 * s,
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          {masked}
        </Text>
      ) : null}
      <View
        className="absolute flex-row items-end justify-between"
        style={{ left: 18 * s, right: 18 * s, bottom: 16 * s }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12 * s,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {name ?? ''}
        </Text>
        <View className="flex-row">
          <View
            style={{
              width: 22 * s,
              height: 22 * s,
              borderRadius: 11 * s,
              backgroundColor: 'rgba(255,255,255,0.55)',
            }}
          />
          <View
            style={{
              width: 22 * s,
              height: 22 * s,
              borderRadius: 11 * s,
              marginLeft: -8 * s,
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
          />
        </View>
      </View>
    </View>
  );
}
