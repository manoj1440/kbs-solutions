import { Link, router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  Text as RNText,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Floating, LogoMark, Orbs } from '@/components/auth';
import { CreditCardArt } from '@/components/brand/credit-card-art';
import { Appear, Button, Icon, type IconName, Screen } from '@/components/ui';
import { cardArt, colors, gradients, gradientStyle } from '@/lib/theme';

/* ───────── slide building blocks (white-on-navy) ───────── */

function Glass({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`rounded-2xl border border-white/10 bg-white/[0.07] ${className ?? ''}`}
      style={{ boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.08)' }}
    >
      {children}
    </View>
  );
}

function FeatureRow({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <Glass className="flex-row items-center gap-3.5 px-4 py-3">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/10">
        <Icon name={icon} size={22} color={colors.gold} />
      </View>
      <View className="flex-1">
        <RNText className="font-bold text-[15px] text-white">{title}</RNText>
        <RNText className="mt-0.5 font-normal text-[13px] text-white/60">{sub}</RNText>
      </View>
      <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
    </Glass>
  );
}

function CheckRow({ icon, label, sub }: { icon: IconName; label: string; sub: string }) {
  return (
    <View className="flex-row items-center gap-3.5">
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={gradientStyle(gradients.gold, 135)}
      >
        <Icon name={icon} size={20} color={colors.ink} />
      </View>
      <View className="flex-1">
        <RNText className="font-bold text-[15px] text-white">{label}</RNText>
        <RNText className="mt-0.5 font-normal text-[13px] text-white/60">{sub}</RNText>
      </View>
      <Icon name="checkmark-circle" size={20} color="#4ADE80" />
    </View>
  );
}

function Headline({
  lines,
  accent,
  sub,
  center,
}: {
  lines: string[];
  accent?: number;
  sub: string;
  center?: boolean;
}) {
  return (
    <View className={center ? 'items-center' : undefined}>
      <RNText
        accessibilityRole="header"
        className={`font-extrabold text-[30px] leading-[37px] tracking-tight text-white ${center ? 'text-center' : ''}`}
      >
        {lines.map((l, i) => (
          <RNText key={l} style={i === accent ? { color: colors.gold } : undefined}>
            {l}
            {i < lines.length - 1 ? '\n' : ''}
          </RNText>
        ))}
      </RNText>
      <RNText
        className={`mt-2 font-medium text-[15px] leading-[22px] text-white/65 ${center ? 'text-center' : ''}`}
      >
        {sub}
      </RNText>
    </View>
  );
}

/* ───────── heroes ───────── */

function CardStack() {
  const cards = [
    { bank: 'ICICI Bank', seed: 'rose-1', rotate: '-14deg', x: -64, y: 18, delay: 400 },
    { bank: 'SBI Card', seed: 'teal-a', rotate: '12deg', x: 64, y: 22, delay: 800 },
    { bank: 'HDFC Bank', seed: 'kbs-navy', rotate: '-2deg', x: 0, y: 0, delay: 0 },
  ];
  return (
    <View className="h-[250px] w-full items-center justify-center">
      <View
        pointerEvents="none"
        className="absolute h-56 w-56 rounded-full"
        style={{ backgroundColor: 'rgba(61, 90, 254, 0.28)' }}
      />
      {cards.map((c) => (
        <View
          key={c.bank}
          className="absolute"
          style={{ transform: [{ translateX: c.x }, { translateY: c.y }, { rotate: c.rotate }] }}
        >
          <Floating delay={c.delay} distance={7}>
            <CreditCardArt bank={c.bank} seed={c.seed} width={210} name="Card Holder" compact />
          </Floating>
        </View>
      ))}
    </View>
  );
}

function MiniCard({ seed }: { seed: string }) {
  return (
    <View
      className="h-10 w-16 overflow-hidden rounded-lg p-1.5"
      style={gradientStyle(cardArt(seed), 135)}
    >
      <View className="h-2 w-3 rounded-[3px]" style={gradientStyle(gradients.gold, 120)} />
      <View
        pointerEvents="none"
        className="absolute -right-4 -top-4 h-10 w-10 rounded-full bg-white/10"
      />
    </View>
  );
}

function DiscoverHero() {
  const rows: [string, string, string][] = [
    ['HDFC Millennia Credit Card', 'Best for online shopping & lifestyle', 'kbs-navy'],
    ['SBI SimplyCLICK', 'Best for everyday spends', 'teal-a'],
    ['Axis ACE', 'Fuel & grocery benefits', 'rose-1'],
    ['ICICI Coral', 'Travel benefits', 'amber'],
  ];
  return (
    <View className="w-full gap-2.5">
      <Glass className="h-12 flex-row items-center gap-2.5 px-4">
        <Icon name="search" size={18} color="rgba(255,255,255,0.6)" />
        <RNText className="font-medium text-[14px] text-white/55">Search cards, banks…</RNText>
      </Glass>
      <View className="flex-row gap-2">
        {['All', 'Travel', 'Shopping', 'Premium'].map((t, i) => (
          <View
            key={t}
            className={`rounded-full px-3.5 py-1.5 ${i === 0 ? 'bg-gold' : 'border border-white/15 bg-white/[0.06]'}`}
          >
            <RNText
              className={`font-semibold text-[12px] ${i === 0 ? 'text-ink' : 'text-white/80'}`}
            >
              {t}
            </RNText>
          </View>
        ))}
      </View>
      {rows.map(([n, s, seed], i) => (
        <Floating key={n} delay={i * 250} distance={2} duration={2600}>
          <Glass className="flex-row items-center gap-3 p-2.5">
            <MiniCard seed={seed} />
            <View className="flex-1">
              <RNText numberOfLines={1} className="font-bold text-[14px] text-white">
                {n}
              </RNText>
              <RNText numberOfLines={1} className="font-normal text-[12px] text-white/55">
                {s}
              </RNText>
            </View>
            <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </Glass>
        </Floating>
      ))}
    </View>
  );
}

function PhoneHero() {
  return (
    <View className="h-[210px] w-full items-center justify-center">
      <View
        pointerEvents="none"
        className="absolute h-48 w-48 rounded-full"
        style={{ backgroundColor: 'rgba(61, 90, 254, 0.3)' }}
      />
      <Floating distance={6}>
        <View
          className="h-[200px] w-[118px] rounded-[26px] border-[5px] border-white/20 bg-white p-3"
          style={{ boxShadow: '0px 18px 40px rgba(0,0,0,0.35)' }}
        >
          <View className="mb-2 h-1.5 w-10 self-center rounded-full bg-[#E6EAF2]" />
          <View className="mb-2 h-12 rounded-lg" style={gradientStyle(cardArt('kbs-navy'), 135)} />
          <View className="mb-1.5 h-1.5 w-16 rounded bg-[#E6EAF2]" />
          <View className="mb-3 h-1.5 w-12 rounded bg-[#E6EAF2]" />
          <View className="mb-1.5 flex-row items-center gap-1.5">
            <Icon name="checkmark-circle" size={11} color={colors.success} />
            <View className="h-1.5 flex-1 rounded bg-[#E6EAF2]" />
          </View>
          <View className="mb-3 flex-row items-center gap-1.5">
            <Icon name="checkmark-circle" size={11} color={colors.success} />
            <View className="h-1.5 flex-1 rounded bg-[#E6EAF2]" />
          </View>
          <View
            className="h-6 items-center justify-center rounded-md"
            style={gradientStyle(['#16329E', '#3D5AFE'], 120)}
          >
            <View className="h-1.5 w-10 rounded bg-white/70" />
          </View>
        </View>
      </Floating>
      <Floating delay={500} distance={5} style={{ position: 'absolute', right: 40, top: 30 }}>
        <View
          className="flex-row items-center gap-1.5 rounded-full bg-white px-3 py-1.5"
          style={{ boxShadow: '0px 8px 20px rgba(0,0,0,0.25)' }}
        >
          <Icon name="flash" size={12} color={colors.warning} />
          <RNText className="font-bold text-[11px] text-ink">Instant link</RNText>
        </View>
      </Floating>
      <Floating delay={1100} distance={5} style={{ position: 'absolute', left: 36, bottom: 34 }}>
        <View
          className="flex-row items-center gap-1.5 rounded-full bg-white px-3 py-1.5"
          style={{ boxShadow: '0px 8px 20px rgba(0,0,0,0.25)' }}
        >
          <Icon name="document-text" size={12} color={colors.brand} />
          <RNText className="font-bold text-[11px] text-ink">Zero paperwork</RNText>
        </View>
      </Floating>
    </View>
  );
}

function Bar({ h, i, active }: { h: number; i: number; active: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(
      active
        ? withDelay(
            150 + i * 120,
            withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }),
          )
        : 0,
    );
  }, [active, i, v]);
  const anim = useAnimatedStyle(() => ({ height: `${h * v.get()}%` }));
  return (
    <Animated.View
      className="w-11 rounded-t-xl"
      style={[
        gradientStyle(
          i === 3 ? gradients.gold : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.12)'],
          180,
        ),
        anim,
      ]}
    />
  );
}

function EarnHero({ active }: { active: boolean }) {
  return (
    <View className="h-[200px] w-full items-center justify-end">
      <Floating distance={6} style={{ position: 'absolute', top: 0, right: 34 }}>
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={[
            gradientStyle(gradients.gold, 135),
            { boxShadow: '0px 10px 24px rgba(227,155,27,0.4)' },
          ]}
        >
          <Icon name="trophy" size={28} color={colors.ink} />
        </View>
      </Floating>
      <View className="h-[150px] flex-row items-end gap-3.5">
        {[30, 52, 74, 100].map((h, i) => (
          <Bar key={h} h={h} i={i} active={active} />
        ))}
      </View>
      <View className="h-px w-64 bg-white/20" />
      <View className="absolute left-8 top-6 flex-row items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5">
        <Icon name="trending-up" size={14} color="#4ADE80" />
        <RNText className="font-bold text-[12px] text-white">Growing every month</RNText>
      </View>
    </View>
  );
}

/* ───────── pagination ───────── */

function Dot({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const anim = useAnimatedStyle(() => {
    const p = x.get() / width;
    const t = interpolate(p, [i - 1, i, i + 1], [0, 1, 0], 'clamp');
    return { width: 8 + t * 20, opacity: 0.35 + t * 0.65 };
  });
  return <Animated.View className="h-2 rounded-full bg-gold" style={anim} />;
}

type Slide = { key: string; cta: string; render: (active: boolean) => ReactNode };

export default function Welcome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList<Slide>>(null);
  const x = useSharedValue(0);

  const slides: Slide[] = [
    {
      key: 'welcome',
      cta: 'Get Started',
      render: () => (
        <>
          <CardStack />
          <View className="mt-8">
            <Headline
              lines={['More Leads', 'More Opportunities', 'A Brighter Tomorrow']}
              accent={2}
              sub="Credit Card DSA Platform"
            />
          </View>
          <View className="mt-7 flex-row gap-2">
            {(
              [
                ['business', 'Top Banks'],
                ['pricetags', 'Best Offers'],
                ['trending-up', 'Higher Earnings'],
              ] as [IconName, string][]
            ).map(([icon, t]) => (
              <Glass key={t} className="flex-1 items-center gap-1.5 px-1 py-3">
                <Icon name={icon} size={20} color={colors.gold} />
                <RNText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="font-semibold text-[12px] tracking-tight text-white/85"
                >
                  {t}
                </RNText>
              </Glass>
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
            lines={['Discover Top', 'Credit Cards']}
            accent={1}
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
              lines={['100% Digital Selling']}
              sub={'Help customers get credit cards\nin just a few steps'}
            />
          </View>
          <View className="mt-6 gap-4">
            <CheckRow
              icon="document-text"
              label="Digital Application Process"
              sub="No paperwork, fully online"
            />
            <CheckRow icon="pulse" label="Track Status Easily" sub="Real-time status updates" />
            <CheckRow
              icon="cash"
              label="Earn Attractive Incentives"
              sub="Higher payouts on activations"
            />
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
            lines={['A Card for', 'Every Need']}
            accent={1}
            sub="Offer the right card to the right customer"
          />
          <View className="mt-6 gap-2.5">
            <FeatureRow icon="bag-handle" title="Shopping" sub="Best deals & cashback" />
            <FeatureRow icon="airplane" title="Travel" sub="Lounge access & travel benefits" />
            <FeatureRow icon="diamond" title="Premium" sub="Exclusive lifestyle privileges" />
            <FeatureRow icon="car-sport" title="Fuel" sub="Savings on every ride" />
            <FeatureRow icon="briefcase" title="Business" sub="Designed for business owners" />
          </View>
        </>
      ),
    },
    {
      key: 'earn',
      cta: "Let's Login",
      render: (active) => (
        <>
          <EarnHero active={active} />
          <View className="mt-6">
            <Headline lines={['Grow Your Earnings']} sub="The more you help, the more you earn" />
          </View>
          <View className="mt-6 gap-4">
            <CheckRow icon="wallet" label="Handsome Payouts" sub="On every activated card" />
            <CheckRow
              icon="shield-checkmark"
              label="Trusted Bank Partnerships"
              sub="Work with leading banks"
            />
            <CheckRow icon="school" label="Support & Training" sub="We're with you at every step" />
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
    x.set(ox);
    const p = Math.round(ox / width);
    if (p !== page && p >= 0 && p < slides.length) setPage(p);
  };

  return (
    <Screen inset="none" statusBar="light" padded={false}>
      <View
        pointerEvents="none"
        className="absolute inset-0"
        style={gradientStyle(gradients.heroDeep, 165)}
      />
      <Orbs />
      <View
        style={{ paddingTop: insets.top + 6 }}
        className="h-auto flex-row items-center justify-between px-5"
      >
        <View className="flex-row items-center gap-2.5">
          <LogoMark size={36} />
          <RNText className="font-bold text-[15px] tracking-[0.5px] text-white">
            KBS Solutions
          </RNText>
        </View>
        {!last ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
            onPress={skip}
            hitSlop={10}
            className="h-11 flex-row items-center gap-1 rounded-full border border-white/15 bg-white/10 px-4"
          >
            <RNText className="font-semibold text-[13px] text-white">Skip</RNText>
            <Icon name="chevron-forward" size={14} color="#fff" />
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
          <View style={{ width }} className="flex-1 px-6 pt-5">
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
            <Dot key={s.key} i={i} x={x} width={width} />
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
            <Pressable
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center"
            >
              <RNText className="font-medium text-[14px] text-white/70">
                New here? <RNText className="font-bold text-gold">Create Account</RNText>
              </RNText>
            </Pressable>
          </Link>
        ) : (
          <View className="min-h-[44px] items-center justify-center">
            <RNText className="font-medium text-[12px] text-white/45">Swipe to explore</RNText>
          </View>
        )}
      </View>
    </Screen>
  );
}
