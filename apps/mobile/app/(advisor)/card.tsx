import { ApiClientError, type BrowseCard, digitsOnly, formatDateTime } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Text as RNText, View } from 'react-native';

import { MetaLine, SectionCard } from '@/components/advisor/parts';
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
import { fileUrl, money } from '@/lib/cards';
import { colors, gradients } from '@/lib/theme';

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
  const [prov, setProv] = useState(card?.sourceabilityProvenance ?? null);
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
      setSourcing(me?.sourceableAtPincode ?? 'unknown');
      setProv(me?.sourceabilityProvenance ?? null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not check.');
    }
  };
  return (
    <Screen
      inset="none"
      statusBar="light"
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
                router.push({ pathname: '/(advisor)/lead-new', params: { cardId: card.id } })
              }
            />
          </View>
          <Muted className="text-center text-[12px]">
            Creates a KBS operational lead only; the bank status appears after the MIS upload.
          </Muted>
        </StickyFooter>
      }
    >
      <HeroHeader colors={gradients.heroDeep} className="pb-8">
        <View className="flex-row items-center gap-3">
          <IconButton
            icon="chevron-back"
            label="Back"
            tone="light"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(advisor)/cards' as never)
            }
          />
          <View className="flex-1">
            <RNText numberOfLines={1} className="font-medium text-[12px] text-white/70">
              {card.bank.displayName}
            </RNText>
            <RNText
              accessibilityRole="header"
              numberOfLines={1}
              className="font-bold text-[18px] text-white"
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
              className="h-48 w-full rounded-2xl"
              resizeMode="contain"
            />
          ) : (
            <CreditCardArt bank={card.bank.displayName} name={card.name} width={300} />
          )}
        </Appear>
        {card.categories.length ? (
          <View className="mt-5 flex-row flex-wrap justify-center gap-2">
            {card.categories.map((c) => (
              <View
                key={c.key}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1"
              >
                <RNText className="font-semibold text-[12px] text-white">{c.label}</RNText>
              </View>
            ))}
          </View>
        ) : null}
      </HeroHeader>

      <View className="mt-4 gap-4 px-4">
        {card.description ? (
          <Appear index={1}>
            <Text className="text-[15px] leading-[22px] text-[#374151]">{card.description}</Text>
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
                    <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-[#E6F4EC]">
                      <Icon name="checkmark" size={13} color={colors.success} />
                    </View>
                    <Text className="flex-1 text-[14px] leading-[20px]">{b}</Text>
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
              <Text className="text-[14px] leading-[20px]">{card.eligibilityHighlights}</Text>
              <Callout kind="warning" icon="information-circle">
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
            subtitle="From the bank's uploaded pincode data"
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
                className="h-[52px]"
                disabled={!/^\d{6}$/.test(pincode)}
                onPress={() => void check()}
              />
            </View>
            {sourcing !== null ? (
              <Badge
                label={
                  sourcing === true
                    ? 'Bank sources this pincode'
                    : sourcing === false
                      ? 'Bank does not source this pincode'
                      : 'No sourcing data from this bank yet'
                }
                variant={
                  sourcing === true ? 'success' : sourcing === false ? 'destructive' : 'warning'
                }
                icon={
                  sourcing === true
                    ? 'checkmark-circle'
                    : sourcing === false
                      ? 'close-circle'
                      : 'help-circle'
                }
              />
            ) : null}
            {prov?.batchUploadedAt ? (
              <MetaLine icon="cloud-upload-outline">
                From the bank pincode upload of {formatDateTime(prov.batchUploadedAt)}. Sourceable
                is not a promise of approval.
              </MetaLine>
            ) : null}
            <ErrorText>{error}</ErrorText>
          </SectionCard>
        </Appear>
      </View>
    </Screen>
  );
}
