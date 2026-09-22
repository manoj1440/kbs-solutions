import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ShareButtons } from '@/components/share-buttons';
import { Badge, Button, Card, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

/** S20 lead created (F-406 §3) with F-407 share CTA. */
export default function LeadCreated() {
  const { id, publicRef, cardName, bankName, customer, cardId } = useLocalSearchParams<{ id: string; publicRef: string; cardName: string; bankName: string; customer: string; cardId?: string }>();
  return (
    <Screen>
      <View className="gap-4">
        <Badge label="Lead created" variant="success" />
        <Heading>{publicRef}</Heading>
        <Card className="gap-1">
          <Text className="font-medium">{customer}</Text>
          <Muted>
            {bankName} {cardName}
          </Muted>
          <Muted>This creates a KBS lead only; bank status will appear after MIS upload.</Muted>
        </Card>
        <Card className="gap-2">
          <Text className="font-medium">Share application link</Text>
          <ShareButtons target={{ type: 'LEAD', id }} cardId={cardId} kinds={['APPLICATION_LINK']} onShared={() => void api.post(`/leads/${id}/link/share`, {}).catch(() => undefined)} />
          <Muted>Shared as KBS activity. It never changes the bank status — that comes only from the MIS upload.</Muted>
        </Card>
        <Button title="View lead" onPress={() => router.replace({ pathname: '/(advisor)/lead', params: { id } })} />
        <Button title="Create another" variant="outline" onPress={() => router.replace('/(advisor)')} />
        <Button title="My leads" variant="ghost" onPress={() => router.replace('/(advisor)/leads')} />
      </View>
    </Screen>
  );
}
