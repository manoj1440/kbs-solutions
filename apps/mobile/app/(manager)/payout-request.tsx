import { useLocalSearchParams } from 'expo-router';

import { PayoutRequestDetail } from '@/components/payout-request-detail';
import { AppBar, Screen } from '@/components/ui';

/** F-604: one payout request — evidence, the two approval rows and the Manager's approve / reject actions. */
export default function ManagerPayoutRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen
      scroll
      header={<AppBar title="Payout request" subtitle="Review the evidence before you decide" />}
    >
      <PayoutRequestDetail id={id} />
    </Screen>
  );
}
