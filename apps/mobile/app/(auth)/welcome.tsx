import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Button, Muted, Screen, Text } from '@/components/ui';

/** Small white-on-navy credit card used on the welcome hero. */
function HeroCard({ bank, tint }: { bank: string; tint: string }) {
  return (
    <View className={`h-24 w-40 rounded-xl ${tint} p-3 shadow`}>
      <View className="h-3 w-8 rounded-sm bg-amber-300" />
      <Text className="mt-6 text-xs font-semibold text-white">{bank}</Text>
      <Muted className="text-[10px] text-white/70">•••• 4242</Muted>
    </View>
  );
}

function FeatureRow({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View className="w-full flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary">
        <Text className="text-xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold">{title}</Text>
        <Muted>{sub}</Muted>
      </View>
    </View>
  );
}

function CheckRow({ label, sub }: { label: string; sub: string }) {
  return (
    <View className="w-full flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
        <Text className="text-base font-bold text-primary-foreground">✓</Text>
      </View>
      <View>
        <Text className="font-semibold">{label}</Text>
        <Muted className="text-xs">{sub}</Muted>
      </View>
    </View>
  );
}

type Slide = {
  key: string;
  hero: React.ReactNode;
  title: string;
  sub: string;
  body?: React.ReactNode;
  cta: string;
};

export default function Welcome() {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList<Slide>>(null);

  const slides: Slide[] = [
    {
      key: 'welcome',
      cta: 'Get Started →',
      title: 'More Leads\nMore Opportunities\nA Brighter Tomorrow',
      sub: 'Credit Card DSA Platform',
      hero: (
        <View className="w-full flex-1 items-center justify-center rounded-b-3xl bg-navy pb-8">
          <Text className="mb-6 text-3xl font-bold text-white">🏦 KBS</Text>
          <View className="flex-row gap-3">
            <HeroCard bank="HDFC BANK" tint="bg-brand" />
            <HeroCard bank="ICICI Bank" tint="bg-rose-700" />
          </View>
          <View className="-mt-6">
            <HeroCard bank="SBICARD" tint="bg-sky-800" />
          </View>
          <View className="mt-6 flex-row gap-6">
            {['Top Banks', 'Best Offers', 'Higher Earnings'].map((t) => (
              <View key={t} className="items-center">
                <Text className="text-lg text-white">◉</Text>
                <Muted className="text-[10px] text-white/80">{t}</Muted>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'range',
      cta: 'Next →',
      title: 'Discover Top Credit Cards',
      sub: 'Wide range of cards for every lifestyle',
      hero: (
        <View className="w-full gap-2 px-4">
          <View className="h-10 rounded-xl border border-border bg-card px-3 py-2">
            <Muted>🔍 Search cards, banks…</Muted>
          </View>
          <View className="flex-row gap-2">
            {['All', 'Travel', 'Shopping', 'Premium'].map((t, i) => (
              <View key={t} className={`rounded-full px-3 py-1 ${i === 0 ? 'bg-primary' : 'bg-secondary'}`}>
                <Text className={`text-xs ${i === 0 ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>{t}</Text>
              </View>
            ))}
          </View>
          {[
            ['HDFC Millennia Credit Card', 'Best for online shopping & lifestyle'],
            ['SBI SimplyCLICK', 'Best for everyday spends'],
            ['Axis ACE', 'Fuel & grocery benefits'],
            ['ICICI Coral', 'Travel benefits'],
          ].map(([n, s], i) => (
            <View key={n} className="w-full flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
              <View className={`h-9 w-14 rounded-md ${['bg-brand', 'bg-sky-800', 'bg-rose-700', 'bg-orange-600'][i]}`} />
              <View className="flex-1">
                <Text className="text-sm font-semibold">{n}</Text>
                <Muted className="text-xs">{s}</Muted>
              </View>
              <Text className="text-muted-foreground">›</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: 'digital',
      cta: 'Next →',
      title: '100% Digital Selling',
      sub: 'Help customers get credit cards\nin just a few steps',
      hero: (
        <View className="w-full items-center px-6">
          <View className="mb-6 h-44 w-28 rounded-2xl border-4 border-foreground/10 bg-card p-3">
            <View className="mb-2 h-2 w-14 rounded bg-secondary" />
            <View className="mb-2 h-2 w-20 rounded bg-secondary" />
            <View className="mb-2 h-16 rounded-lg bg-brand/10" />
            <View className="h-6 rounded-md bg-primary" />
          </View>
        </View>
      ),
      body: (
        <View className="w-full gap-4 px-6">
          <CheckRow label="Digital Application Process" sub="No paperwork, fully online" />
          <CheckRow label="Track Status Easily" sub="Real-time updates via MIS" />
          <CheckRow label="Earn Attractive Incentives" sub="Higher payouts on activations" />
        </View>
      ),
    },
    {
      key: 'need',
      cta: 'Next →',
      title: 'A Card for\nEvery Need',
      sub: 'Offer the right card to the right customer',
      hero: null,
      body: (
        <View className="w-full gap-3 px-6">
          <FeatureRow icon="🛍️" title="Shopping" sub="Best deals & cashback" />
          <FeatureRow icon="✈️" title="Travel" sub="Lounge access & travel benefits" />
          <FeatureRow icon="👑" title="Premium" sub="Exclusive lifestyle privileges" />
          <FeatureRow icon="⛽" title="Fuel" sub="Savings on every ride" />
          <FeatureRow icon="💼" title="Business" sub="Designed for business owners" />
        </View>
      ),
    },
    {
      key: 'earn',
      cta: "Let's Login →",
      title: 'Grow Your Earnings',
      sub: 'The more you help, the more you earn',
      hero: (
        <View className="w-full items-center px-10 py-4">
          <Text className="mb-2 text-4xl">🏆</Text>
          <View className="mb-2 h-24 w-full flex-row items-end justify-center gap-3">
            {[30, 55, 75, 95].map((h, i) => (
              <View key={i} className="w-10 rounded-t-md bg-primary" style={{ height: `${h}%` }} />
            ))}
          </View>
          <Text className="text-2xl">📈</Text>
        </View>
      ),
      body: (
        <View className="w-full gap-4 px-6">
          <CheckRow label="Handsome Payouts" sub="On every activated card" />
          <CheckRow label="Trusted Bank Partnerships" sub="Work with leading banks" />
          <CheckRow label="Support & Training" sub="We're with you at every step" />
        </View>
      ),
    },
  ];

  const last = page === slides.length - 1;
  const next = () => {
    if (last) router.push('/(auth)/mobile?purpose=LOGIN' as never);
    else list.current?.scrollToIndex({ index: page + 1, animated: true });
  };

  return (
    <Screen className="px-0 pb-8 pt-0">
      <FlatList
        ref={list}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1">
            {item.hero}
            <View className="mt-6 items-center gap-2 px-6">
              <Text className="text-center text-2xl font-bold">{item.title}</Text>
              <Muted className="text-center">{item.sub}</Muted>
            </View>
            {item.body ? <View className="mt-6 flex-1">{item.body}</View> : null}
            <View className="mt-auto gap-3 px-6">
              <Button title={item.cta} onPress={next} />
              <View className="flex-row justify-center gap-1.5 pb-2">
                {slides.map((s, i) => (
                  <View key={s.key} className={`h-1.5 rounded-full ${i === page ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />
                ))}
              </View>
            </View>
          </View>
        )}
      />
      {last ? (
        <View className="px-6 pb-2">
          <Link href="/(auth)/mobile?purpose=ADVISOR_SIGNUP" asChild>
            <Pressable accessibilityRole="button" className="items-center py-1">
              <Muted>
                New here? <Text className="font-semibold text-primary">Create Account</Text>
              </Muted>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </Screen>
  );
}
