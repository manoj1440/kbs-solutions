import { ApiClientError, formatDateTime, type PendingAction } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

/** F-409 Pending Actions (REQ-11 §11.10): owner / what / source / date / CTA. Never invented from blank or generic MIS values. */
export default function PendingActions() {
  const [items, setItems] = useState<PendingAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems((await api.get<PendingAction[]>('/pending-actions')).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load pending actions.');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const done = async (id: string) => {
    try {
      await api.post(`/follow-ups/${id.replace(/^task:/, '')}/done`, {});
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not update the task.');
    }
  };
  return (
    <Screen>
      <View className="mb-3">
        <Heading>Pending actions</Heading>
        <Muted>Only explicit follow-up tasks and bank items with a configured route.</Muted>
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>Nothing pending.</Text>
              <Muted>Bank statuses alone do not create tasks; add a follow-up from a lead when you have something to do.</Muted>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/(advisor)/lead', params: { id: item.leadId } })}>
            <Card className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-medium">{item.customer}</Text>
                <Badge label={item.source.type === 'KBS_TASK' ? 'Follow-up task' : 'Bank MIS'} variant={item.source.type === 'KBS_TASK' ? 'info' : 'secondary'} />
              </View>
              <Muted>
                {item.leadRef} · {item.issuer} {item.card}
              </Muted>
              <Text>{item.whatToDo}</Text>
              <Muted>
                {item.owner.role === 'BANK' ? 'Bank (informational)' : `Owner: ${item.owner.name ?? '—'}`} · {formatDateTime(item.date)}
                {item.source.type === 'MIS_FIELD' ? ` · ${item.source.field}${item.source.batchRef ? ` · ${item.source.batchRef}` : ''}` : ''}
              </Muted>
              {item.source.type === 'KBS_TASK' && !item.doneAt ? <Button title="Mark done" variant="outline" onPress={() => void done(item.id)} /> : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
