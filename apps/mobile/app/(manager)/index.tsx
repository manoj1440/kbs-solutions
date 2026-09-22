import { View } from 'react-native';

import { Card, Heading, Muted, Screen, Text } from '@/components/ui';

export default function ManagerHome() {
  return (
    <Screen>
      <View className="gap-4">
        <Heading>My team</Heading>
        <Card>
          <Text>Create Telecallers, track training and approve payouts.</Text>
          <Muted>Team screens arrive with F-201, F-205, F-313 and F-604.</Muted>
        </Card>
      </View>
    </Screen>
  );
}
