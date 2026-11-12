import { Link, router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  Text as RNText,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/auth';
import { CreditCardArt } from '@/components/brand/credit-card-art';
import { Appear, Button, Icon, type IconName, Screen } from '@/components/ui';
import { cardArt, colors, gradientStyle } from '@/lib/theme';

/* ───────── slide building blocks (graphite on the page canvas) ───────── */

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-2xl bg-white ${className ?? ''}`}>{children}</View>;
}

function FeatureRow({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <Panel className="flex-row items-center gap-3 px-4 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-raised">
        <Icon name={icon} size={18} color={colors.subtle} />
      </View>
      <View className="flex-1">
        <RNText className="font-medium text-base text-ink">{title}</RNText>
        <RNText className="mt-0.5 font-normal text-sm text-[#525252]">{sub}</RNText>
      </View>
    </Panel>
  );
}

function CheckRow({ icon, label, sub }: { icon: IconName; label: string; sub: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-raised">
        <Icon name={icon} size={18} color={colors.subtle} />
      </View>
      <View className="flex-1">
        <RNText className="font-medium text-base text-ink">{label}</RNText>
        <RNText className="mt-0.5 font-normal text-sm text-[#525252]">{sub}</RNText>
      </View>
    </View>
  );
}

function Headline({ lines, sub, center }: { lines: string[]; sub: string; center?: boolean }) {
  return (
    <View className={center ? 'items-center' : undefined}>
      <RNText
        accessibilityRole="header"
        className={`font-medium text-2xl text-ink ${center ? 'text-center' : ''}`}
      >
        {lines.join('\n')}
      </RNText>
      <RNText
        className={`mt-2 font-normal text-base text-[#525252] ${center ? 'text-center' : ''}`}
      >
        {sub}
      </RNText>
    </View>
  );
}

/* ───────── heroes ───────── */

function CardStack() {
  const cards = [
    { bank: 'Travel Card', seed: 'rose-1', rotate: '-14deg', x: -64, y: 18 },
    { bank: 'Cashback Card', seed: 'teal-a', rotate: '12deg', x: 64, y: 22 },
    { bank: 'Rewards Card', seed: 'kbs-navy', rotate: '-2deg', x: 0, y: 0 },
  ];
  return (
    <View className="h-64 w-full items-center justify-center">
      {cards.map((c) => (
        <View
          key={c.bank}
          className="absolute"
          style={{ transform: [{ translateX: c.x }, { translateY: c.y }, { rotate: c.rotate }] }}
        >
          <CreditCardArt bank={c.bank} seed={c.seed} width={210} name="Card Holder" compact />
        </View>
      ))}
    </View>
  );
}

/** A small card object (keeps its material gradient and a metal chip). */
function MiniCard({ seed }: { seed: string }) {
  return (
    <View
      className="h-10 w-16 overflow-hidden rounded-md p-1.5"
      style={gradientStyle(cardArt(seed), 135)}
    >
      <View className="h-2 w-3 rounded-sm" style={{ backgroundColor: '#D9C38F' }} />
    </View>
  );
}

function DiscoverHero() {
  const rows: [string, string, string][] = [
    ['Rewards Card', 'Online shopping & lifestyle', 'kbs-navy'],
    ['Cashback Card', 'Everyday spends', 'teal-a'],
    ['Fuel Card', 'Fuel & grocery benefits', 'rose-1'],
    ['Travel Card', 'Travel benefits', 'amber'],
  ];
  return (
    <View className="w-full gap-2">
      <Panel className="h-12 flex-row items-center gap-2.5 px-4">
        <Icon name="search" size={18} color={colors.subtle} />
        <RNText className="font-normal text-md text-[#8A8A8A]">Search cards</RNText>
      </Panel>
      <View className="flex-row gap-2">
        {['All', 'Travel', 'Shopping', 'Premium'].map((t, i) => (
          <View
            key={t}
            className={`rounded-full px-3.5 py-1.5 ${i === 0 ? 'bg-ink' : 'border border-line bg-white'}`}
          >
            <RNText className={`font-medium text-xs ${i === 0 ? 'text-white' : 'text-[#525252]'}`}>
              {t}
            </RNText>
          </View>
        ))}
      </View>
      {rows.map(([n, s, seed]) => (
        <Panel key={n} className="flex-row items-center gap-3 p-2.5">
          <MiniCard seed={seed} />
          <View className="flex-1">
            <RNText numberOfLines={1} className="font-medium text-md text-ink">
              {n}
            </RNText>
            <RNText numberOfLines={1} className="font-normal text-xs text-[#737373]">
              {s}
            </RNText>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.subtle} />
        </Panel>
      ))}
    </View>
  );
}

function PhoneHero() {
  return (
    <View className="h-52 w-full items-center justify-center">
      <View
        className="h-48 w-28 rounded-3xl border-4 border-[#E5E5E5] bg-white p-3"
        style={{ boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)' }}
      >
        <View className="mb-2 h-1 w-9 self-center rounded-full bg-[#EBEBEB]" />
        <View className="mb-2 h-12 rounded-md" style={gradientStyle(cardArt('kbs-navy'), 135)} />
        <View className="mb-1.5 h-1.5 w-16 rounded bg-[#EBEBEB]" />
        <View className="mb-3 h-1.5 w-12 rounded bg-[#EBEBEB]" />
        <View className="mb-1.5 flex-row items-center gap-1.5">
          <Icon name="checkmark-circle-outline" size={16} color={colors.success} />
          <View className="h-1.5 flex-1 rounded bg-[#EBEBEB]" />
        </View>
        <View className="mb-3 flex-row items-center gap-1.5">
          <Icon name="checkmark-circle-outline" size={16} color={colors.success} />
          <View className="h-1.5 flex-1 rounded bg-[#EBEBEB]" />
        </View>
        <View className="h-6 items-center justify-center rounded-md bg-gold">
          <View className="h-1.5 w-10 rounded bg-white/70" />
        </View>
      </View>
      <View
        className="absolute right-10 top-8 flex-row items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5"
        style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' }}
      >
        <Icon name="link-outline" size={16} color={colors.subtle} />
        <RNText className="font-medium text-xs text-ink">Instant link</RNText>
      </View>
      <View
        className="absolute bottom-8 left-9 flex-row items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5"
        style={{ boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' }}
      >
        <Icon name="document-text-outline" size={16} color={colors.subtle} />
        <RNText className="font-medium text-xs text-ink">Zero paperwork</RNText>
      </View>
    </View>
  );
}

/** Static bars: neutral steps, the latest one in the accent. */
function EarnHero() {
  return (
    <View className="h-48 w-full items-center justify-end">
      <View className="h-36 flex-row items-end gap-3.5">
        {[30, 52, 74, 100].map((h, i) => (
          <View
            key={h}
            style={{
              width: 44,
              height: `${h}%`,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              backgroundColor: i === 3 ? colors.orange : i === 2 ? '#D4D4D4' : '#E5E5E5',
            }}
          />
        ))}
      </View>
      <View className="h-px w-64 bg-[#D4D4D4]" />
    </View>
  );
}

type Slide = { key: string; cta: string; render: (active: boolean) => ReactNode };

export default function Welcome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList<Slide>>(null);

  const slides: Slide[] = [
    {
      key: 'welcome',
      cta: 'Get Started',
      render: () => (
        <>
          <CardStack />
          <View className="mt-8">
            <Headline
              lines={['More leads,', 'more opportunities']}
              sub="Credit card DSA platform"
            />
          </View>
          <View className="mt-7 flex-row gap-2">
            {(
              [
                ['card-outline', 'Top cards'],
                ['pricetags-outline', 'Best offers'],
                ['wallet-outline', 'Higher earnings'],
              ] as [IconName, string][]
            ).map(([icon, t]) => (
              <Panel key={t} className="flex-1 items-center gap-1.5 px-1 py-3">
                <Icon name={icon} size={18} color={colors.subtle} />
                <RNText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="font-medium text-xs text-[#525252]"
                >
                  {t}
                </RNText>
              </Panel>
            ))}
          </View>
        </>
      ),
    },
    {
      key: 'range',
      cta: 'Next',
      render: () => (
        <>
          <Headline
            lines={['Discover top', 'credit cards']}
            sub="Wide range of cards for every lifestyle"
          />
          <View className="mt-6">
            <DiscoverHero />
          </View>
        </>
      ),
    },
    {
      key: 'digital',
      cta: 'Next',
      render: () => (
        <>
          <PhoneHero />
          <View className="mt-5">
            <Headline
              lines={['100% digital selling']}
              sub={'Help customers get credit cards\nin just a few steps'}
            />
          </View>
          <View className="mt-6 gap-4">
            <CheckRow
              icon="document-text-outline"
              label="Digital application process"
              sub="No paperwork, fully online"
            />
            <CheckRow
              icon="pulse-outline"
              label="Track status"
              sub="Status updates from the bank MIS"
            />
            <CheckRow icon="cash-outline" label="Incentives" sub="Payouts on activated cards" />
          </View>
        </>
      ),
    },
    {
      key: 'need',
      cta: 'Next',
      render: () => (
        <>
          <Headline
            lines={['A card for', 'every need']}
            sub="Offer the right card to the right customer"
          />
          <View className="mt-6 gap-2.5">
            <FeatureRow icon="bag-handle-outline" title="Shopping" sub="Deals & cashback" />
            <FeatureRow
              icon="airplane-outline"
              title="Travel"
              sub="Lounge access & travel benefits"
            />
            <FeatureRow icon="diamond-outline" title="Premium" sub="Lifestyle privileges" />
            <FeatureRow icon="car-sport-outline" title="Fuel" sub="Savings on fuel" />
            <FeatureRow icon="briefcase-outline" title="Business" sub="For business owners" />
          </View>
        </>
      ),
    },
    {
      key: 'earn',
      cta: "Let's Login",
      render: () => (
        <>
          <EarnHero />
          <View className="mt-6">
            <Headline
              lines={['Grow your earnings']}
              sub="The more customers you help, the more you earn"
            />
          </View>
          <View className="mt-6 gap-4">
            <CheckRow icon="wallet-outline" label="Payouts" sub="On every activated card" />
            <CheckRow
              icon="shield-checkmark-outline"
              label="Card partnerships"
              sub="Work with leading card issuers"
            />
            <CheckRow
              icon="school-outline"
              label="Support & training"
              sub="Training before you start, support after"
            />
          </View>
        </>
      ),
    },
  ];

  const last = page === slides.length - 1;
  const next = () => {
    if (last) router.push('/(auth)/mobile?purpose=LOGIN' as never);
    else list.current?.scrollToIndex({ index: page + 1, animated: true });
  };
  const skip = () => list.current?.scrollToIndex({ index: slides.length - 1, animated: true });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const ox = e.nativeEvent.contentOffset.x;
    const p = Math.round(ox / width);
    if (p !== page && p >= 0 && p < slides.length) setPage(p);
  };

  return (
    <Screen inset="none" statusBar="dark" padded={false}>
      <View
        style={{ paddingTop: insets.top + 6 }}
        className="h-auto flex-row items-center justify-between px-5"
      >
        <View className="flex-row items-center gap-2.5">
          <LogoMark size={32} />
          <RNText className="font-medium text-base text-ink">KBS Solutions</RNText>
        </View>
        {!last ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
            onPress={skip}
            hitSlop={10}
            className="h-11 flex-row items-center gap-1 rounded-lg px-3"
          >
            <RNText className="font-medium text-sm text-[#525252]">Skip</RNText>
            <Icon name="chevron-forward" size={16} color={colors.subtle} />
          </Pressable>
        ) : (
          <View className="h-11" />
        )}
      </View>
      <FlatList
        ref={list}
        data={slides}
        horizontal
        pagingEnabled
        className="flex-1"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index }) => (
          <View style={{ width }} className="flex-1 justify-center px-6">
            <Appear>{item.render(index === page)}</Appear>
          </View>
        )}
      />
      <View className="gap-4 px-6 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12) + 10 }}>
        <View
          accessibilityLabel={`Slide ${page + 1} of ${slides.length}`}
          className="flex-row items-center justify-center gap-1.5"
        >
          {slides.map((s, i) => (
            <View
              key={s.key}
              className={`h-1.5 rounded-full ${i === page ? 'w-5 bg-ink' : 'w-1.5 bg-[#D4D4D4]'}`}
            />
          ))}
        </View>
        <Button
          title={slides[page]?.cta ?? 'Next'}
          variant="gold"
          size="lg"
          iconRight="arrow-forward"
          onPress={next}
        />
        {last ? (
          <Link href="/(auth)/mobile?purpose=ADVISOR_SIGNUP" asChild>
            <Pressable accessibilityRole="button" className="min-h-11 items-center justify-center">
              <RNText className="font-normal text-md text-[#525252]">
                New here? <RNText className="font-medium text-gold">Create account</RNText>
              </RNText>
            </Pressable>
          </Link>
        ) : (
          <View className="min-h-11" />
        )}
      </View>
    </Screen>
  );
}
