import type { AvailableCard } from '@kbs/shared';
import { formatDateTime } from '@kbs/shared';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Text as RNText, View } from 'react-native';

import { CreditCardArt } from '@/components/brand/credit-card-art';
import { ShareButtons } from '@/components/share-buttons';
import {
  AppBar,
  Appear,
  Badge,
  Button,
  Callout,
  Card,
  ErrorText,
  Icon,
  IconCircle,
  KeyValue,
  Muted,
  Screen,
  SectionHeader,
  Text,
} from '@/components/ui';
import { fileUrl, money } from '@/lib/cards';
import { colors } from '@/lib/theme';

/** F-308 §4: Card Detail in Call — image, bank, name, categories, benefits, fees, charges, PDF, link version, provenance. */
export default function CardDetailScreen() {
  const { card: raw, recordId } = useLocalSearchParams<{ card: string; recordId: string }>();
  const card: AvailableCard | null = raw ? (JSON.parse(raw) as AvailableCard) : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (card?.imageFileId && imageUrl === null) {
    setTimeout(
      () =>
        void fileUrl(card.imageFileId as string)
          .then(setImageUrl)
          .catch(() => setImageUrl('')),
      0,
    );
  }
  if (!card) return null;
  return (
    <Screen
      scroll
      header={
        <AppBar title={card.name} subtitle={`${card.bank.displayName} · share during the call`} />
      }
    >
      <Appear className="items-center gap-4 pt-1">
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
        <View className="w-full items-center gap-1">
          <Muted className="font-semibold uppercase tracking-[1.2px] text-[11px]">
            {card.bank.displayName}
          </Muted>
          <RNText
            accessibilityRole="header"
            className="text-center font-extrabold text-[22px] tracking-tight text-ink"
          >
            {card.name}
          </RNText>
          <View className="mt-1 flex-row flex-wrap justify-center gap-2">
            {card.categories.map((c) => (
              <Badge key={c.key} label={c.label} variant="secondary" size="sm" />
            ))}
          </View>
        </View>
      </Appear>

      <Appear index={1}>
        <View className="flex-row gap-3">
          <Card className="flex-1 items-center py-3">
            <Muted className="text-[12px]">Joining fee</Muted>
            <RNText className="font-extrabold text-[18px] text-ink">
              {money(card.joiningFee)}
            </RNText>
          </Card>
          <Card className="flex-1 items-center py-3">
            <Muted className="text-[12px]">Annual fee</Muted>
            <RNText className="font-extrabold text-[18px] text-ink">{money(card.annualFee)}</RNText>
          </Card>
        </View>
      </Appear>

      <Appear index={2}>
        <Card className="gap-3 border-[#C9D3FF]">
          <View className="flex-row items-center gap-3">
            <IconCircle icon="logo-whatsapp" tone="success" size={40} />
            <View className="flex-1">
              <Text className="font-bold text-[16px]">Share with customer</Text>
              <Muted className="text-[12px]">
                Every share is logged on this customer&apos;s record
              </Muted>
            </View>
          </View>
          {card.benefitPdfFileId ? (
            <Button
              title="Open benefit PDF"
              icon="document-text-outline"
              variant="secondary"
              onPress={async () => {
                try {
                  await Linking.openURL(await fileUrl(card.benefitPdfFileId as string));
                } catch {
                  setError('Could not open the PDF.');
                }
              }}
            />
          ) : (
            <Muted className="text-[13px]">No benefit PDF uploaded for this card.</Muted>
          )}
          {recordId ? (
            <ShareButtons
              target={{ type: 'CALLING_RECORD', id: recordId }}
              cardId={card.id}
              kinds={
                card.benefitPdfFileId
                  ? ['APPLICATION_LINK', 'BENEFIT_PDF', 'OFFICE_ID']
                  : ['APPLICATION_LINK', 'OFFICE_ID']
              }
            />
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Muted className="text-[12px] leading-[18px]">
            Opens WhatsApp with the approved content (link v{card.link?.version ?? '—'}, sent
            exactly as configured). “Share sheet opened” is not a delivery confirmation.
          </Muted>
        </Card>
      </Appear>

      {card.description ? (
        <Appear index={3}>
          <Text className="text-[14px] leading-[21px] text-[#374151]">{card.description}</Text>
        </Appear>
      ) : null}

      <Appear index={4} className="gap-3">
        <SectionHeader title="Rewards & benefits" />
        <Card className="gap-2.5">
          {card.benefits.length === 0 ? (
            <Muted>—</Muted>
          ) : (
            card.benefits.map((b, i) => (
              <View key={i} className="flex-row items-start gap-2.5">
                <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-[#E6F4EC]">
                  <Icon name="checkmark" size={13} color={colors.success} />
                </View>
                <Text className="flex-1 text-[14px] leading-[20px]">{b}</Text>
              </View>
            ))
          )}
        </Card>
      </Appear>

      <Appear index={5} className="gap-3">
        <SectionHeader title="Fees & charges" />
        <Card className="py-1">
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
        </Card>
      </Appear>

      {card.eligibilityHighlights ? (
        <Appear index={6} className="gap-3">
          <SectionHeader title="Eligibility highlights" />
          <Card className="gap-3">
            <Text className="text-[14px] leading-[20px]">{card.eligibilityHighlights}</Text>
            <Callout kind="warning" icon="information-circle">
              Indicative only — the bank decides every application.
            </Callout>
          </Card>
        </Appear>
      ) : null}

      {card.disclosures ? (
        <Appear index={7} className="gap-3">
          <SectionHeader title="Disclosures" />
          <Card>
            <Muted className="leading-[19px]">{card.disclosures}</Muted>
          </Card>
        </Appear>
      ) : null}

      <Appear index={8} className="gap-3">
        <SectionHeader title="Why this card is offered" />
        <Card className="gap-2">
          <View className="flex-row items-start gap-2">
            <Icon name="business-outline" size={15} color={colors.muted} style={{ marginTop: 2 }} />
            <Muted className="flex-1 leading-[19px]">
              Bank marked pincode sourceable (upload{' '}
              {card.provenance.batchUploadedAt
                ? formatDateTime(card.provenance.batchUploadedAt)
                : '—'}
              ); published {card.provenance.publication.scope.toLowerCase()}; link v
              {card.link?.version ?? '—'} for {card.link?.channel ?? '—'}.
            </Muted>
          </View>
          {Object.entries(card.provenance.rawFlags).length ? (
            <View className="rounded-xl bg-[#F6F8FC] px-3 py-1">
              {Object.entries(card.provenance.rawFlags)
                .slice(0, 6)
                .map(([k, v], i, arr) => (
                  <KeyValue key={k} label={k} value={v || '(blank)'} last={i === arr.length - 1} />
                ))}
            </View>
          ) : null}
          <Muted className="text-[12px]">
            Sourceable is not a promise of approval. Record {recordId?.slice(0, 8)}
          </Muted>
        </Card>
      </Appear>
    </Screen>
  );
}
