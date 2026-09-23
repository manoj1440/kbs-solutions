import { router, useLocalSearchParams } from 'expo-router';
import { Text as RNText, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { CopyValue, SectionCard } from '@/components/advisor/parts';
import { CreditCardArt } from '@/components/brand/credit-card-art';
import { ShareButtons } from '@/components/share-buttons';
import {
  Appear,
  Button,
  Callout,
  Card,
  Icon,
  type IconName,
  Muted,
  Screen,
  StickyFooter,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors, gradients, gradientStyle, shadow } from '@/lib/theme';

const NEXT: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'share-social-outline',
    title: 'Share the application link',
    body: 'Send it to the customer so they can apply with the bank.',
  },
  {
    icon: 'person-outline',
    title: 'Customer applies with the bank',
    body: 'The bank decides every application.',
  },
  {
    icon: 'business-outline',
    title: 'Bank status after MIS upload',
    body: 'Stage, decision and activation appear only from the bank MIS.',
  },
];

/** S20 lead created (F-406 §3) with F-407 share CTA. */
export default function LeadCreated() {
  const { id, publicRef, cardName, bankName, customer, cardId } = useLocalSearchParams<{
    id: string;
    publicRef: string;
    cardName: string;
    bankName: string;
    customer: string;
    cardId?: string;
  }>();
  return (
    <Screen
      scroll
      contentClassName="pt-6"
      footer={
        <StickyFooter>
          <Button
            title="View lead"
            icon="document-text-outline"
            onPress={() => router.replace({ pathname: '/(advisor)/lead', params: { id } })}
          />
          <View className="flex-row gap-3">
            <Button
              title="Create another"
              variant="outline"
              className="flex-1"
              onPress={() => router.replace('/(advisor)')}
            />
            <Button
              title="My leads"
              variant="ghost"
              className="flex-1"
              onPress={() => router.replace('/(advisor)/leads')}
            />
          </View>
        </StickyFooter>
      }
    >
      <View className="items-center">
        <Animated.View
          entering={ZoomIn.springify().damping(12).stiffness(160)}
          className="h-28 w-28 items-center justify-center rounded-full bg-[#E6F4EC]"
        >
          <View
            className="h-20 w-20 items-center justify-center rounded-full"
            style={[
              gradientStyle(gradients.success, 135),
              { boxShadow: '0px 10px 24px rgba(31, 122, 77, 0.35)' },
            ]}
          >
            <Icon name="checkmark" size={44} color={colors.white} />
          </View>
        </Animated.View>
        <Appear index={2} className="mt-5 items-center">
          <RNText
            accessibilityRole="header"
            className="font-extrabold text-[26px] tracking-tight text-ink"
          >
            Lead created
          </RNText>
          <Muted className="mt-1 text-center">
            {customer ? `${customer}'s lead is saved in KBS.` : 'The lead is saved in KBS.'}
          </Muted>
          <View
            className="mt-3 flex-row items-center gap-2 rounded-full border border-line bg-white px-4 py-2"
            style={shadow.sm}
          >
            <RNText className="font-semibold text-[11px] uppercase tracking-[1px] text-[#8A93A6]">
              KBS ref
            </RNText>
            <CopyValue value={publicRef} />
          </View>
        </Appear>
      </View>

      <Appear index={3}>
        <Card className="flex-row items-center gap-3.5 p-3">
          <CreditCardArt bank={bankName ?? ''} name={cardName} width={96} compact />
          <View className="flex-1">
            <RNText numberOfLines={1} className="font-bold text-[16px] text-ink">
              {customer}
            </RNText>
            <Muted numberOfLines={2}>
              {bankName} {cardName}
            </Muted>
          </View>
        </Card>
      </Appear>

      <Appear index={4}>
        <Callout kind="info">
          This creates a KBS lead only; bank status will appear after MIS upload.
        </Callout>
      </Appear>

      <Appear index={5}>
        <SectionCard
          icon="share-social-outline"
          title="Send to your customer"
          subtitle="WhatsApp hand-off, logged as KBS activity"
        >
          <ShareButtons
            target={{ type: 'LEAD', id }}
            cardId={cardId}
            kinds={['APPLICATION_LINK']}
            onShared={() => void api.post(`/leads/${id}/link/share`, {}).catch(() => undefined)}
          />
          <Muted>
            Shared as KBS activity. It never changes the bank status — that comes only from the MIS
            upload.
          </Muted>
        </SectionCard>
      </Appear>

      <Appear index={6}>
        <Card className="gap-1 px-4 py-3">
          <RNText accessibilityRole="header" className="mb-1 font-bold text-[15px] text-ink">
            What happens next
          </RNText>
          {NEXT.map((n) => (
            <View key={n.title} className="flex-row gap-3 py-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E8EDFF]">
                <Icon name={n.icon} size={16} color={colors.brand} />
              </View>
              <View className="flex-1">
                <RNText className="font-semibold text-[14px] text-ink">{n.title}</RNText>
                <Muted className="text-[12px]">{n.body}</Muted>
              </View>
            </View>
          ))}
        </Card>
      </Appear>
    </Screen>
  );
}
