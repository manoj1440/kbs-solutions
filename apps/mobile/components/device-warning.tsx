import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useSession } from '@/lib/session';

/** F-302: non-blocking warning for rooted / compromised devices (REQ-09 §9.3). Dismissible for this app session. */
export function DeviceWarningBanner() {
  const { deviceWarning } = useSession();
  const [hidden, setHidden] = useState(false);
  const insets = useSafeAreaInsets();
  if (!deviceWarning || hidden) return null;
  return (
    <View
      accessibilityRole="alert"
      className="bg-warning flex-row items-start gap-3 px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Text className="text-warning-foreground flex-1 text-sm">{deviceWarning}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss device warning"
        onPress={() => setHidden(true)}
        hitSlop={12}
      >
        <Text className="text-warning-foreground font-semibold">Dismiss</Text>
      </Pressable>
    </View>
  );
}
