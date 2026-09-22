import { ApiClientError, type BrowseCard } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Input, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/cards';

interface Category {
  key: string;
  label: string;
}

const TINTS = ['bg-brand', 'bg-sky-800', 'bg-rose-700', 'bg-orange-600', 'bg-emerald-700', 'bg-indigo-800'];

/** Card-art thumbnail — bank + card name on a tinted block (no image assets). */
function CardThumb({ item, index }: { item: BrowseCard; index: number }) {
  return (
    <View className={`h-16 w-24 rounded-lg ${TINTS[index % TINTS.length]} justify-between p-2`}>
      <View className="h-2.5 w-6 rounded-sm bg-amber-300" />
      <View>
        <Text className="text-[9px] font-semibold text-white" numberOfLines={1}>
          {item.bank.displayName.toUpperCase()}
        </Text>
        <Muted className="text-[8px] text-white/70" numberOfLines={1}>
          {item.name}
        </Muted>
      </View>
    </View>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      if (/^\d{6}$/.test(pincode)) params.set('pincode', pincode);
      const [c, k] = await Promise.all([api.get<{ cards: BrowseCard[] }>(`/cards/browse?${params.toString()}`), cats.length ? Promise.resolve(null) : api.get<Category[]>('/catalogue/categories')]);
      setCards(c.data.cards);
      if (k) setCats(k.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load the catalogue.');
    } finally {
      setLoading(false);
    }
  }, [category, q, pincode, cats.length]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <View className="mb-3 gap-3">
        <Heading>Card Catalogue</Heading>
        <Input placeholder="🔍 Search cards, banks…" value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" className="rounded-xl" />
        <Input placeholder="Customer pincode (optional) — checks bank sourcing" value={pincode} keyboardType="number-pad" maxLength={6} onChangeText={setPincode} onSubmitEditing={() => void load()} className="rounded-xl" />
        <View className="flex-row flex-wrap gap-2">
          {[{ key: null, label: 'All' } as { key: string | null; label: string }, ...cats].map((c) => (
            <Pressable key={c.key ?? 'all'} accessibilityRole="tab" accessibilityState={{ selected: category === c.key }} onPress={() => setCategory(category === c.key ? null : c.key)} className={`rounded-full px-3 py-1.5 ${category === c.key || (c.key === null && category === null) ? 'bg-primary' : 'bg-secondary'}`}>
              <Text className={`text-xs ${category === c.key || (c.key === null && category === null) ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>No cards match.</Text>
              <Muted>Cards appear here once KBS publishes them with an application link. Bank status for any application is shown only after the MIS upload.</Muted>
            </Card>
          )
        }
        renderItem={({ item, index }) => (
          <Card className="flex-row items-center gap-3 p-3">
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/card', params: { card: JSON.stringify(item), pincode } })}>
              <CardThumb item={item} index={index} />
            </Pressable>
            <Pressable accessibilityRole="button" className="flex-1" onPress={() => router.push({ pathname: '/(advisor)/card', params: { card: JSON.stringify(item), pincode } })}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {item.name}
                </Text>
                {item.sourceableAtPincode !== null ? <Badge label={item.sourceableAtPincode === true ? 'Sourceable' : item.sourceableAtPincode === false ? 'Not here' : 'Pending'} variant={item.sourceableAtPincode === true ? 'success' : item.sourceableAtPincode === false ? 'destructive' : 'warning'} /> : null}
              </View>
              <Muted className="text-xs" numberOfLines={1}>
                {item.bank.displayName}
              </Muted>
              <Muted className="text-xs" numberOfLines={1}>
                {money(item.joiningFee)} Joining Fee
                {item.benefits[0] ? ` · ${item.benefits[0]}` : ''}
              </Muted>
            </Pressable>
            <Button title="Apply" className="h-9 rounded-lg px-4" onPress={() => router.push({ pathname: '/(advisor)/lead-new', params: { cardId: item.id, pincode } })} />
          </Card>
        )}
      />
    </Screen>
  );
}
