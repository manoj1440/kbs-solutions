import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Heading, Muted, Screen, Text } from '@/components/ui';

/** Create Lead placeholder — the multi-step flow arrives with F-406. */
export default function LeadNewPlaceholder() {
  const { cardName, bankName } = useLocalSearchParams<{ cardId: string; cardName: string; bankName: string }>();
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Create lead</Heading>
        <Card>
          <Text>
            {bankName} {cardName}
          </Text>
          <Muted>The customer lead steps (mobile, details, PAN, pincode, employment, income, declarations) arrive with F-406.</Muted>
        </Card>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
