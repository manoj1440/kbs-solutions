import { View } from 'react-native';

import { Badge, Button, Card, Heading, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';

/** REQ-09 §9.1: Telecaller outside the office network without a WFH exception. */
export default function NetworkBlocked() {
  const { gates, refresh, signOut } = useSession();
  const reason = gates?.network.reason;
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Office network required</Heading>
        <Card className="gap-2">
          <Badge label={reason === 'ALLOWLIST_EMPTY' ? 'Not configured' : 'Outside office network'} variant="warning" />
          <Text>
            {reason === 'ALLOWLIST_EMPTY'
              ? 'The office network is not configured yet. Contact the Admin.'
              : 'Connect to the office Wi-Fi, or ask your Manager for a work-from-home exception.'}
          </Text>
        </Card>
        <Button title="Try again" onPress={() => void refresh()} />
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
