import { ApiClientError, type UserSummary } from '@kbs/shared';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Badge, Button, Card, ErrorText, Heading, Muted, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';

type TeamUser = UserSummary & { lastLoginAt: string | null };

/** F-201: Manager team overview (mobile). Training columns arrive with F-205. */
export default function ManagerHome() {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<TeamUser[]>('/users?pageSize=200');
      setRows(r.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load your team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const telecallers = rows.filter((u) => u.role === 'TELECALLER');
  const advisors = rows.filter((u) => u.role === 'ADVISOR');

  return (
    <Screen>
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Heading>My team</Heading>
          <Muted>
            {telecallers.length} Telecallers · {advisors.length} Advisors
          </Muted>
        </View>
        <Link href="/(manager)/create-telecaller" asChild>
          <Button title="Create" />
        </Link>
      </View>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={[...telecallers, ...advisors]}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          loading ? null : (
            <Card>
              <Text>No team members yet.</Text>
              <Muted>Create a Telecaller with a name and mobile number. Advisors join when they apply your Agent Code.</Muted>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Card className="gap-1" onTouchEnd={() => item.role === 'TELECALLER' && router.push({ pathname: '/(manager)/telecaller', params: { id: item.id } })}>
            <View className="flex-row items-center justify-between">
              <Text className="font-medium">{item.fullName || '(onboarding)'}</Text>
              <Badge label={item.role} variant="secondary" />
            </View>
            <Muted>
              {item.mobileMasked}
              {item.employeeCode ? ` · ${item.employeeCode}` : ''}
            </Muted>
            <Badge label={item.status} variant={item.status === 'ACTIVE' ? 'success' : 'unknown'} />
          </Card>
        )}
      />
    </Screen>
  );
}
