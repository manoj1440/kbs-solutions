import { ApiClientError, type BrowseCard, digitsOnly } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text as RNText, RefreshControl, ScrollView, View } from 'react-native';

import { CreditCardArt } from '@/components/brand/credit-card-art';
import {
  Appear,
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  EmptyState,
  ErrorText,
  Icon,
  Input,
  Muted,
  PressableScale,
  Screen,
  SkeletonList,
} from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/cards';
import { colors } from '@/lib/theme';

interface Category {
  key: string;
  label: string;
}

function SourcingBadge({ value }: { value: BrowseCard['sourceableAtPincode'] }) {
  if (value === null) return null;
  return (
    <Badge
      size="sm"
      dot
      label={value === true ? 'Sourceable' : value === false ? 'Not here' : 'Pending'}
      variant={value === true ? 'success' : value === false ? 'destructive' : 'warning'}
    />
  );
}

/** S10 Card Catalogue (F-405): search, category chips, card rows with Apply CTA. */
export default function CardCatalogue() {
  const [cards, setCards] = useState<BrowseCard[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      if (/^\d{6}$/.test(pincode)) params.set('pincode', pincode);
      const [c, k] = await Promise.all([
        api.get<{ cards: BrowseCard[] }>(`/cards/browse?${params.toString()}`),
        cats.length ? Promise.resolve(null) : api.get<Category[]>('/catalogue/categories'),
      ]);
      setCards(c.data.cards);
      if (k) setCats(k.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the catalogue.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [category, q, pincode, cats.length]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openCard = (item: BrowseCard) =>
    router.push({ pathname: '/(advisor)/card', params: { card: JSON.stringify(item), pincode } });

  const header = (
    <View className="gap-3 pb-1">
      <View>
        <RNText
          accessibilityRole="header"
          className="font-extrabold text-[28px] tracking-tight text-ink"
        >
          Card Catalogue
        </RNText>
        <Muted>
          {loaded ? `${cards.length} card${cards.length === 1 ? '' : 's'}` : 'Loading cards…'}
        </Muted>
      </View>
      <Callout kind="info" icon="add-circle">
        Pick a card to start a new lead
      </Callout>
      <Input
        icon="search"
        placeholder="Search cards, banks…"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load()}
        returnKeyType="search"
      />
      <Input
        icon="location-outline"
        placeholder="Customer pincode (optional)"
        hint="Checks bank sourcing for the customer's pincode"
        value={pincode}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(t) => setPincode(digitsOnly(t, 6))}
        onSubmitEditing={() => void load()}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerClassName="gap-2 px-4"
      >
        {[{ key: null, label: 'All' } as { key: string | null; label: string }, ...cats].map(
          (c) => (
            <Chip
              key={c.key ?? 'all'}
              label={c.label}
              active={category === c.key || (c.key === null && category === null)}
              onPress={() => setCategory(category === c.key ? null : c.key)}
            />
          ),
        )}
      </ScrollView>
      <ErrorText>{error}</ErrorText>
    </View>
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={loaded ? cards : []}
        keyExtractor={(c) => c.id}
        contentContainerClassName="gap-3 px-4 pb-10 pt-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading && loaded}
            onRefresh={() => void load()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loaded ? (
            <SkeletonList rows={3} />
          ) : loading ? null : (
            <EmptyState
              icon="card-outline"
              title="No cards match."
              body="Cards appear here once KBS publishes them with an application link. Bank status for any application is shown only after the MIS upload."
            />
          )
        }
        renderItem={({ item, index }) => (
          <Appear index={index}>
            <Card className="gap-3 p-3.5">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.bank.displayName}. View details`}
                scaleTo={0.985}
                onPress={() => openCard(item)}
                className="flex-row gap-3.5"
              >
                <CreditCardArt bank={item.bank.displayName} name={item.name} width={120} compact />
                <View className="flex-1 justify-center gap-1">
                  <RNText
                    numberOfLines={2}
                    className="font-bold text-[16px] leading-[20px] text-ink"
                  >
                    {item.name}
                  </RNText>
                  <Muted numberOfLines={1}>{item.bank.displayName}</Muted>
                  <SourcingBadge value={item.sourceableAtPincode} />
                </View>
              </PressableScale>
              <View className="flex-row items-center gap-3 border-t border-line pt-3">
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-1.5">
                    <Icon name="pricetag-outline" size={13} color={colors.subtle} />
                    <RNText numberOfLines={1} className="font-semibold text-[13px] text-ink">
                      {money(item.joiningFee)} Joining Fee
                    </RNText>
                  </View>
                  {item.benefits[0] ? (
                    <View className="flex-row items-center gap-1.5">
                      <Icon name="sparkles-outline" size={13} color="#B7791F" />
                      <Muted numberOfLines={1} className="flex-1 text-[12px]">
                        {item.benefits[0]}
                      </Muted>
                    </View>
                  ) : null}
                </View>
                <Button
                  title="Apply"
                  size="sm"
                  iconRight="arrow-forward"
                  onPress={() =>
                    router.push({
                      pathname: '/(advisor)/lead-new',
                      params: { cardId: item.id, pincode },
                    })
                  }
                />
              </View>
            </Card>
          </Appear>
        )}
      />
    </Screen>
  );
}
