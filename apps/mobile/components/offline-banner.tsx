import { useNetworkState } from 'expo-network';
import { useEffect } from 'react';
import { Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { setSsidHint } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * F-802: offline banner (REQ-20 §20.3 adaptive states) and the Telecaller network hint header. Android does not expose
 * the Wi-Fi name without location permission, so the hint is the connection type (e.g. `wifi`); the server only
 * stores it next to the access decision, which is always made from the request IP (F-301).
 */
export function OfflineBanner() {
  const net = useNetworkState();
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const isTelecaller = user?.role === 'TELECALLER';
  useEffect(() => {
    setSsidHint(isTelecaller && net.type ? `type:${String(net.type).toLowerCase()}` : undefined);
  }, [isTelecaller, net.type]);
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2.5 bg-[#B42318] px-4 pb-2"
      style={{ paddingTop: insets.top + 6 }}
    >
      <Icon name="cloud-offline-outline" size={16} color="#fff" />
      <RNText className="flex-1 font-medium text-[12px] leading-[17px] text-white">
        You are offline. Changes will not be saved until the connection is back.
      </RNText>
    </View>
  );
}
