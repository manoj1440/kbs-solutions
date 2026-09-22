import { ApiClientError, type BrowseCard, formatDateTime } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { fileUrl, money } from '@/lib/cards';

/** S12 card detail (F-405) with sourcing-availability check and the Create Lead CTA (F-406). */
export default function AdvisorCardDetail() {
  const { card: raw, pincode: initialPincode } = useLocalSearchParams<{ card: string; pincode?: string }>();
  const card: BrowseCard | null = raw ? (JSON.parse(raw) as BrowseCard) : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pincode, setPincode] = useState(initialPincode ?? '');
  const [sourcing, setSourcing] = useState<BrowseCard['sourceableAtPincode']>(card?.sourceableAtPincode ?? null);
  const [prov, setProv] = useState(card?.sourceabilityProvenance ?? null);
  const [error, setError] = useState<string | null>(null);
  if (card?.imageFileId && imageUrl === null) setTimeout(() => void fileUrl(card.imageFileId as string).then(setImageUrl).catch(() => setImageUrl('')), 0);
  if (!card) return null;
  const check = async () => {
    setError(null);
    try {
      const r = await api.get<{ cards: BrowseCard[] }>(`/cards/browse?pincode=${pincode}&bankId=${card.bank.id}`);
      const me = r.data.cards.find((c) => c.id === card.id);
      setSourcing(me?.sourceableAtPincode ?? 'unknown');
      setProv(me?.sourceabilityProvenance ?? null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not check.');
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-3 pb-8">
        <Button title="← Back" variant="ghost" onPress={() => router.back()} />
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
          <Text className="font-medium">Sourcing availability</Text>
          <Input placeholder="Customer pincode" value={pincode} keyboardType="number-pad" maxLength={6} onChangeText={setPincode} onSubmitEditing={() => void check()} />
          <Button title="Check" variant="outline" disabled={!/^\d{6}$/.test(pincode)} onPress={() => void check()} />
          {sourcing !== null ? <Badge label={sourcing === true ? 'Bank sources this pincode' : sourcing === false ? 'Bank does not source this pincode' : 'No sourcing data from this bank yet'} variant={sourcing === true ? 'success' : sourcing === false ? 'destructive' : 'warning'} /> : null}
          {prov?.batchUploadedAt ? <Muted>From the bank pincode upload of {formatDateTime(prov.batchUploadedAt)}. Sourceable is not a promise of approval.</Muted> : null}
          <ErrorText>{error}</ErrorText>
        </Card>
        <Card className="gap-2">
          {card.benefitPdfFileId ? <Button title="Open benefit PDF" variant="outline" onPress={() => void fileUrl(card.benefitPdfFileId as string).then((u) => Linking.openURL(u)).catch(() => setError('Could not open the PDF.'))} /> : null}
          <Button title="Create lead for a customer" onPress={() => router.push({ pathname: '/(advisor)/lead-new', params: { cardId: card.id, cardName: card.name, bankName: card.bank.displayName } })} />
          <Muted>Creates a KBS operational lead only; the bank status appears after the MIS upload.</Muted>
        </Card>
      </ScrollView>
    </Screen>
  );
}
