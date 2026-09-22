import { View } from 'react-native';

import { Card, Heading, Muted, Screen, Text } from '@/components/ui';

/** My Leads placeholder — list arrives with F-408. */
export default function LeadsPlaceholder() {
  return (
    <Screen>
      <View className="gap-4">
        <Heading>My leads</Heading>
        <Card>
          <Text>Your leads and their bank status will appear here.</Text>
          <Muted>Bank stage, decision and activation come only from the MIS upload (Awaiting MIS Update until then).</Muted>
        </Card>
      </View>
    </Screen>
  );
}
