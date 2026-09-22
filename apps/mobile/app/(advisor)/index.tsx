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

/** S08 Credit Card Home (F-405): search, category chips, card list, entries to leads. Copy never promises approval. */
export default function AdvisorHome() {
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
        <View className="flex-row items-center justify-between">
          <Heading>Credit cards</Heading>
          <Button title="My leads" variant="outline" onPress={() => router.push('/(advisor)/leads')} />
        </View>
        <Input placeholder="Search card or bank" value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" />
        <Input placeholder="Customer pincode (optional) — checks bank sourcing" value={pincode} keyboardType="number-pad" maxLength={6} onChangeText={setPincode} onSubmitEditing={() => void load()} />
        <View className="flex-row flex-wrap gap-2">
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: category === null }} onPress={() => setCategory(null)} className={`rounded-full px-3 py-1.5 ${category === null ? 'bg-primary' : 'bg-secondary'}`}>
            <Text className={`text-xs ${category === null ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>All</Text>
          </Pressable>
          {cats.map((c) => (
            <Pressable key={c.key} accessibilityRole="tab" accessibilityState={{ selected: category === c.key }} onPress={() => setCategory(category === c.key ? null : c.key)} className={`rounded-full px-3 py-1.5 ${category === c.key ? 'bg-primary' : 'bg-secondary'}`}>
              <Text className={`text-xs ${category === c.key ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>{c.label}</Text>
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
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/card', params: { card: JSON.stringify(item), pincode } })}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-medium">{item.name}</Text>
                {item.sourceableAtPincode !== null ? <Badge label={item.sourceableAtPincode === true ? `Sourceable at ${pincode}` : item.sourceableAtPincode === false ? 'Not sourceable here' : 'Sourcing data pending'} variant={item.sourceableAtPincode === true ? 'success' : item.sourceableAtPincode === false ? 'destructive' : 'warning'} /> : null}
              </View>
              <Muted>
                {item.bank.displayName} · {item.categories.map((c) => c.label).join(', ') || 'uncategorised'}
              </Muted>
              <Muted>
                Joining {money(item.joiningFee)} · annual {money(item.annualFee)}
              </Muted>
              {item.benefits[0] ? <Muted>• {item.benefits[0]}</Muted> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
