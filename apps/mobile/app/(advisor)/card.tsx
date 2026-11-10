import { ApiClientError, type BrowseCard, digitsOnly } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Text as RNText, View } from 'react-native';

import { SectionCard } from '@/components/advisor/parts';
import { CreditCardArt } from '@/components/brand/credit-card-art';
import {
  Appear,
  Badge,
  Button,
  Callout,
  ErrorText,
  HeroHeader,
  Icon,
  IconButton,
  Input,
  KeyValue,
  Muted,
  Screen,
  StickyFooter,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { bankName, fileUrl, money } from '@/lib/cards';
import { colors } from '@/lib/theme';

/** S12 card detail (F-405) with sourcing-availability check and the Create Lead CTA (F-406). */
export default function AdvisorCardDetail() {
  const { card: raw, pincode: initialPincode } = useLocalSearchParams<{
    card: string;
    pincode?: string;
  }>();
  const card: BrowseCard | null = raw ? (JSON.parse(raw) as BrowseCard) : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pincode, setPincode] = useState(initialPincode ?? '');
  const [sourcing, setSourcing] = useState<BrowseCard['sourceableAtPincode']>(
    card?.sourceableAtPincode ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  if (card?.imageFileId && imageUrl === null)
    setTimeout(
      () =>
        void fileUrl(card.imageFileId as string)
          .then(setImageUrl)
          .catch(() => setImageUrl('')),
      0,
    );
  if (!card) return null;
  const check = async () => {
    setError(null);
    try {
      const r = await api.get<{ cards: BrowseCard[] }>(
        `/cards/browse?pincode=${pincode}&bankId=${card.bank.id}`,
      );
      const me = r.data.cards.find((c) => c.id === card.id);
      setSourcing(Boolean(me)); // browse with a pincode returns only the cards available there
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not check.');
    }
  };
  return (
    <Screen
      inset="none"
      scroll
      padded={false}
      contentClassName="pt-0"
      footer={
        <StickyFooter>
          <View className="flex-row gap-3">
            {card.benefitPdfFileId ? (
              <Button
                title="Benefit PDF"
                icon="document-text-outline"
                variant="outline"
                className="flex-1"
                onPress={() =>
                  void fileUrl(card.benefitPdfFileId as string)
                    .then((u) => Linking.openURL(u))
                    .catch(() => setError('Could not open the PDF.'))
                }
              />
            ) : null}
            <Button
              title="Create lead for a customer"
              icon="person-add-outline"
              className="flex-[2]"
              onPress={() =>
                router.push({
                  pathname: '/(advisor)/lead-new',
                  params: { cardId: card.id, pincode },
                })
              }
            />
          </View>
          <Muted className="text-center text-xs">
            Creates a KBS operational lead only; the bank status appears after the MIS upload.
          </Muted>
        </StickyFooter>
      }
    >
      <HeroHeader className="pb-6">
        <View className="flex-row items-center gap-3">
          <IconButton
            icon="chevron-back"
            label="Back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(advisor)/cards' as never)
            }
          />
          <View className="flex-1">
            {bankName(card.bank) ? (
              <RNText numberOfLines={1} className="font-normal text-xs text-[#737373]">
                {bankName(card.bank)}
              </RNText>
            ) : null}
            <RNText
              accessibilityRole="header"
              numberOfLines={1}
              className="font-medium text-lg text-ink"
            >
              {card.name}
            </RNText>
          </View>
        </View>
        <Appear className="mt-6 items-center">
          {imageUrl ? (
            <Image
              accessibilityLabel={`${card.name} card`}
              source={{ uri: imageUrl }}
              className="h-48 w-full rounded-xl"
              resizeMode="contain"
            />
          ) : (
            <CreditCardArt bank={bankName(card.bank)} name={card.name} width={300} />
          )}
        </Appear>
        {card.categories.length ? (
          <View className="mt-5 flex-row flex-wrap justify-center gap-2">
            {card.categories.map((c) => (
              <View key={c.key} className="rounded-md border border-line bg-white px-2 py-1">
                <RNText className="font-normal text-xs text-[#525252]">{c.label}</RNText>
              </View>
            ))}
          </View>
        ) : null}
      </HeroHeader>

      <View className="mt-4 gap-4 px-4">
        {card.description ? (
          <Appear index={1}>
            <Text className="text-base text-[#525252]">{card.description}</Text>
          </Appear>
        ) : null}

        <Appear index={2}>
          <SectionCard icon="gift-outline" tone="gold" title="Rewards & benefits">
            {card.benefits.length === 0 ? (
              <Muted>—</Muted>
            ) : (
              <View className="gap-2.5">
                {card.benefits.map((b, i) => (
                  <View key={i} className="flex-row items-start gap-2.5">
                    <Icon
                      name="checkmark"
                      size={16}
                      color={colors.success}
                      style={{ marginTop: 2 }}
                    />
                    <Text className="flex-1 text-md">{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        </Appear>

        <Appear index={3}>
          <SectionCard icon="receipt-outline" title="Fees & charges">
            <View>
              <KeyValue label="Joining fee" value={money(card.joiningFee)} />
              <KeyValue
                label="Annual fee"
                value={money(card.annualFee)}
                last={card.majorCharges.length === 0}
              />
              {card.majorCharges.map((m, i) => (
                <KeyValue
                  key={i}
                  label={m.label}
                  value={m.value}
                  last={i === card.majorCharges.length - 1}
                />
              ))}
            </View>
          </SectionCard>
        </Appear>

        {card.eligibilityHighlights ? (
          <Appear index={4}>
            <SectionCard icon="person-circle-outline" tone="info" title="Eligibility highlights">
              <Text className="text-md">{card.eligibilityHighlights}</Text>
              <Callout kind="warning" icon="information-circle-outline">
                Indicative only — the bank decides every application.
              </Callout>
            </SectionCard>
          </Appear>
        ) : null}

        {card.disclosures ? (
          <Appear index={5}>
            <SectionCard icon="document-lock-outline" tone="secondary" title="Disclosures">
              <Muted>{card.disclosures}</Muted>
            </SectionCard>
          </Appear>
        ) : null}

        <Appear index={6}>
          <SectionCard
            icon="location-outline"
            tone="success"
            title="Sourcing availability"
            subtitle="Pincodes KBS has set for this card"
          >
            <View className="flex-row items-start gap-2">
              <View className="flex-1">
                <Input
                  icon="navigate-outline"
                  placeholder="Customer pincode"
                  value={pincode}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(t) => setPincode(digitsOnly(t, 6))}
                  onSubmitEditing={() => void check()}
                />
              </View>
              <Button
                title="Check"
                variant="secondary"
                className="h-12"
                disabled={!/^\d{6}$/.test(pincode)}
                onPress={() => void check()}
              />
            </View>
            {sourcing !== null ? (
              <Badge
                label={
                  sourcing === true ? 'Available at this pincode' : 'Not available at this pincode'
                }
                variant={sourcing === true ? 'success' : 'destructive'}
                icon={sourcing === true ? 'checkmark-circle-outline' : 'close-circle-outline'}
              />
            ) : null}
            <ErrorText>{error}</ErrorText>
          </SectionCard>
        </Appear>
      </View>
    </Screen>
  );
}
