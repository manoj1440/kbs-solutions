import { Text as RNText, View } from 'react-native';

import { GateState } from '@/components/auth';
import { Badge, Button, Card, Icon } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** REQ-09 §9.1: Telecaller outside the office network without a WFH exception. */
export default function NetworkBlocked() {
  const { gates, refresh, signOut } = useSession();
  const reason = gates?.network.reason;
  const notConfigured = reason === 'ALLOWLIST_EMPTY';
  return (
    <GateState
      icon={notConfigured ? 'settings' : 'wifi'}
      tone="warning"
      title="Office network required"
      badge={
        <Badge
          label={notConfigured ? 'Not configured' : 'Outside office network'}
          variant="warning"
          dot
        />
      }
      actions={
        <>
          <Button title="Try again" size="lg" icon="refresh" onPress={() => void refresh()} />
          <Button
            title="Sign out"
            variant="ghost"
            icon="log-out-outline"
            onPress={() => void signOut()}
          />
        </>
      }
    >
      <Card className="gap-3 p-4">
        <RNText className="text-center font-normal text-[15px] leading-[22px] text-[#374151]">
          {notConfigured
            ? 'The office network is not configured yet. Contact the Admin.'
            : 'Connect to the office Wi-Fi, or ask your Manager for a work-from-home exception.'}
        </RNText>
        {!notConfigured ? (
          <View className="flex-row gap-2 border-t border-line pt-3">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon name="business-outline" size={16} color={colors.brand} />
              <RNText className="flex-1 font-medium text-[12px] text-[#5B6478]">
                Office Wi-Fi
              </RNText>
            </View>
            <View className="flex-1 flex-row items-center gap-2">
              <Icon name="home-outline" size={16} color={colors.brand} />
              <RNText className="flex-1 font-medium text-[12px] text-[#5B6478]">
                WFH exception
              </RNText>
            </View>
          </View>
        ) : null}
      </Card>
    </GateState>
  );
}
