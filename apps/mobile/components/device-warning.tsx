import { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** F-302: non-blocking warning for rooted / compromised devices (REQ-09 §9.3). Dismissible for this app session. */
export function DeviceWarningBanner() {
  const { deviceWarning } = useSession();
  const [hidden, setHidden] = useState(false);
  const insets = useSafeAreaInsets();
  if (!deviceWarning || hidden) return null;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-2.5 border-b border-line bg-[#FDF4E3] pb-2 pl-4 pr-2"
      style={{ paddingTop: insets.top + 6 }}
    >
      <Icon name="warning-outline" size={16} color={colors.warning} />
      <RNText className="flex-1 font-normal text-xs text-[#7A4A05]">{deviceWarning}</RNText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss device warning"
        onPress={() => setHidden(true)}
        hitSlop={12}
        className="min-h-9 flex-row items-center gap-1 rounded-md px-2.5"
      >
        <RNText className="font-medium text-xs text-[#7A4A05]">Dismiss</RNText>
        <Icon name="close" size={16} color={colors.warning} />
      </Pressable>
    </View>
  );
}
