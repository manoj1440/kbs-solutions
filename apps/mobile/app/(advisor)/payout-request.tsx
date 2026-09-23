import { useLocalSearchParams } from 'expo-router';

import { PayoutRequestDetail } from '@/components/payout-request-detail';
import { AppBar, Screen } from '@/components/ui';

export default function AdvisorPayoutRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen
      scroll
      header={<AppBar title="Payout request" subtitle="Approvals, payment and card events" />}
    >
      <PayoutRequestDetail id={id} />
    </Screen>
  );
}
