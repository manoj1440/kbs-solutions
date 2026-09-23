import { ApiClientError, formatDateTime, type PendingAction } from '@kbs/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text as RNText, RefreshControl, View } from 'react-native';

import { MetaLine } from '@/components/advisor/parts';
import {
  AppBar,
  Appear,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  IconCircle,
  Muted,
  Screen,
  SkeletonList,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';

/** F-409 Pending Actions (REQ-11 §11.10): owner / what / source / date / CTA. Never invented from blank or generic MIS values. */
export default function PendingActions() {
  const [items, setItems] = useState<PendingAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems((await api.get<PendingAction[]>('/pending-actions')).data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load pending actions.');
    } finally {
      setLoading(false);
      setLoaded(true);
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
  const open = items.filter((i) => !i.doneAt).length;
  return (
    <Screen
      padded={false}
      header={
        <AppBar
          title="Pending actions"
          subtitle={loaded ? `${open} open item${open === 1 ? '' : 's'}` : undefined}
        />
      }
    >
      {!loaded ? (
        <View className="px-4">
          <SkeletonList rows={3} />
        </View>
      ) : error && items.length === 0 ? (
        <View className="px-4">
          <ErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerClassName="gap-3 px-4 pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListHeaderComponent={
            <View className="gap-3">
              <MetaLine icon="information-circle-outline">
                Only explicit follow-up tasks and bank items with a configured route.
              </MetaLine>
              <ErrorText>{error}</ErrorText>
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <EmptyState
                icon="checkmark-done-outline"
                title="Nothing pending."
                body="Bank statuses alone do not create tasks; add a follow-up from a lead when you have something to do."
              />
            )
          }
          renderItem={({ item, index }) => {
            const task = item.source.type === 'KBS_TASK';
            return (
              <Appear index={index}>
                <Card
                  onPress={() =>
                    router.push({ pathname: '/(advisor)/lead', params: { id: item.leadId } })
                  }
                  accessibilityLabel={`${item.customer}: ${item.whatToDo}`}
                  className="gap-3"
                >
                  <View className="flex-row items-center gap-3">
                    <IconCircle
                      icon={task ? 'alarm-outline' : 'business-outline'}
                      tone={task ? 'warning' : 'info'}
                      size={40}
                    />
                    <View className="flex-1">
                      <Text numberOfLines={1} className="font-bold text-[15px]">
                        {item.customer}
                      </Text>
                      <Muted numberOfLines={1} className="text-[12px]">
                        {item.leadRef} · {item.issuer} {item.card}
                      </Muted>
                    </View>
                    <Badge
                      label={task ? 'Follow-up task' : 'Bank MIS'}
                      variant={task ? 'info' : 'secondary'}
                      size="sm"
                    />
                  </View>
                  <View className="rounded-xl bg-[#F4F6FB] px-3 py-2.5">
                    <RNText className="font-semibold text-[14px] leading-[20px] text-ink">
                      {item.whatToDo}
                    </RNText>
                  </View>
                  <MetaLine
                    icon={item.owner.role === 'BANK' ? 'business-outline' : 'person-outline'}
                  >
                    {item.owner.role === 'BANK'
                      ? 'Bank (informational)'
                      : `Owner: ${item.owner.name ?? '—'}`}{' '}
                    · {formatDateTime(item.date)}
                    {item.source.type === 'MIS_FIELD'
                      ? ` · ${item.source.field}${item.source.batchRef ? ` · ${item.source.batchRef}` : ''}`
                      : ''}
                  </MetaLine>
                  {task && !item.doneAt ? (
                    <Button
                      title="Mark done"
                      icon="checkmark"
                      size="sm"
                      variant="secondary"
                      onPress={() => void done(item.id)}
                    />
                  ) : null}
                </Card>
              </Appear>
            );
          }}
        />
      )}
    </Screen>
  );
}
