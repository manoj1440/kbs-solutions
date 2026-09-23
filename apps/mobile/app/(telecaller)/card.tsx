import type { AvailableCard } from '@kbs/shared';
import { formatDateTime } from '@kbs/shared';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { ShareButtons } from '@/components/share-buttons';
import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { fileUrl, money } from '@/lib/cards';

/** F-308 §4: Card Detail in Call — image, bank, name, categories, benefits, fees, charges, PDF, link version, provenance. */
export default function CardDetailScreen() {
  const { card: raw, recordId } = useLocalSearchParams<{ card: string; recordId: string }>();
  const card: AvailableCard | null = raw ? (JSON.parse(raw) as AvailableCard) : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (card?.imageFileId && imageUrl === null) {
    setTimeout(() => void fileUrl(card.imageFileId as string).then(setImageUrl).catch(() => setImageUrl('')), 0);
  }
  if (!card) return null;
  return (
    <>
      <Screen>
        <ScrollView contentContainerClassName="gap-3 pb-8">
          <Button title="← Back" variant="ghost" onPress={() => router.back()} />
          <ErrorText>{error}</ErrorText>
          {imageUrl ? <Image accessibilityLabel={`${card.name} card`} source={{ uri: imageUrl }} className="h-44 w-full rounded-xl bg-secondary" resizeMode="contain" /> : null}
          <View>
            <Muted>{card.bank.displayName}</Muted>
            <Heading>{card.name}</Heading>
            <View className="mt-1 flex-row flex-wrap gap-2">
              {card.categories.map((c) => (
                <Badge key={c.key} label={c.label} variant="secondary" />
              ))}
            </View>
          </View>
          {card.description ? <Text>{card.description}</Text> : null}
          <Card className="gap-1">
            <Text className="font-medium">Rewards & benefits</Text>
            {card.benefits.length === 0 ? <Muted>—</Muted> : card.benefits.map((b, i) => <Text key={i}>• {b}</Text>)}
          </Card>
          <Card className="gap-1">
            <Text className="font-medium">Fees & charges</Text>
            <Text>Joining fee: {money(card.joiningFee)}</Text>
            <Text>Annual fee: {money(card.annualFee)}</Text>
            {card.majorCharges.map((m, i) => (
              <Muted key={i}>
                {m.label}: {m.value}
              </Muted>
            ))}
          </Card>
          {card.eligibilityHighlights ? (
            <Card className="gap-1">
              <Text className="font-medium">Eligibility highlights</Text>
              <Text>{card.eligibilityHighlights}</Text>
              <Muted>Indicative only — the bank decides every application.</Muted>
            </Card>
          ) : null}
          {card.disclosures ? (
            <Card className="gap-1">
              <Text className="font-medium">Disclosures</Text>
              <Muted>{card.disclosures}</Muted>
            </Card>
          ) : null}
          <Card className="gap-2">
            <Text className="font-medium">Share with customer</Text>
            {card.benefitPdfFileId ? (
              <Button
                title="Open benefit PDF"
                variant="outline"
                onPress={async () => {
                  try {
                    await Linking.openURL(await fileUrl(card.benefitPdfFileId as string));
                  } catch {
                    setError('Could not open the PDF.');
                  }
                }}
              />
            ) : (
              <Muted>No benefit PDF uploaded for this card.</Muted>
            )}
            {recordId ? <ShareButtons target={{ type: 'CALLING_RECORD', id: recordId }} cardId={card.id} kinds={card.benefitPdfFileId ? ['APPLICATION_LINK', 'BENEFIT_PDF', 'OFFICE_ID'] : ['APPLICATION_LINK', 'OFFICE_ID']} /> : null}
            <Muted>Opens WhatsApp with the approved content (link v{card.link?.version ?? '—'}, sent exactly as configured). “Share sheet opened” is not a delivery confirmation.</Muted>
          </Card>
          <Card className="gap-1">
            <Text className="font-medium">Why this card is offered</Text>
            <Muted>
              Bank marked pincode sourceable (upload {card.provenance.batchUploadedAt ? formatDateTime(card.provenance.batchUploadedAt) : '—'}); published {card.provenance.publication.scope.toLowerCase()}; link v{card.link?.version ?? '—'} for {card.link?.channel ?? '—'}.
            </Muted>
            {Object.entries(card.provenance.rawFlags)
              .slice(0, 6)
              .map(([k, v]) => (
                <Muted key={k}>
                  {k}: {v || '(blank)'}
                </Muted>
              ))}
            <Muted>Sourceable is not a promise of approval. Record {recordId?.slice(0, 8)}</Muted>
          </Card>
        </ScrollView>
      </Screen>
    </>
  );
}
