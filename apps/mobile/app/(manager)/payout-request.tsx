import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { PayoutRequestDetail } from '@/components/payout-request-detail';
import { Button, Screen } from '@/components/ui';

export default function ManagerPayoutRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-3 pb-8">
        <Button title="← Back" variant="ghost" onPress={() => router.back()} />
        <PayoutRequestDetail id={id} />
      </ScrollView>
    </Screen>
  );
}
