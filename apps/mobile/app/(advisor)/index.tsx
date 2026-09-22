import { View } from 'react-native';

import { Card, Heading, Muted, Screen, Text } from '@/components/ui';

/** S08 Credit Card Home placeholder (F-405). */
export default function AdvisorHome() {
  return (
    <Screen>
      <View className="gap-4">
        <Heading>Credit cards</Heading>
        <Card>
          <Text>Browse cards, create leads and track bank MIS results.</Text>
          <Muted>Catalogue, Create Lead and My Leads arrive with F-405 → F-408. Bank status is shown only after KBS uploads the bank&apos;s MIS.</Muted>
        </Card>
      </View>
    </Screen>
  );
}
