import { View } from 'react-native';

import { SecureScreen } from '@/components/secure-screen';
import { Card, Heading, Muted, Screen, Text } from '@/components/ui';

/** My Calling Queue placeholder (F-307). Protected surface → SecureScreen (F-302). */
export default function TelecallerHome() {
  return (
    <SecureScreen>
      <Screen>
        <View className="gap-4">
          <Heading>My calling queue</Heading>
          <Card>
            <Text>Training passed and office network verified.</Text>
            <Muted>Your assigned customers appear here once the calling-list import and allocation features (F-303, F-305, F-307) are built.</Muted>
          </Card>
        </View>
      </Screen>
    </SecureScreen>
  );
}
