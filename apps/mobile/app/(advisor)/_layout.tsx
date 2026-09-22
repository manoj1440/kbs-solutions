import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { routeFor, useSession } from '@/lib/session';

const ICONS: Record<string, string> = { index: '🏠', leads: '📋', cards: '💳', payouts: '💰', profile: '☰' };

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function AdvisorLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(advisor)') return <Redirect href={target as never} />;
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#16329E',
        tabBarIcon: ({ focused }) => <Text style={{ opacity: focused ? 1 : 0.45 }}>{ICONS[route.name] ?? '•'}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads' }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards' }} />
      <Tabs.Screen name="payouts" options={{ title: 'Earnings' }} />
      <Tabs.Screen name="profile" options={{ title: 'More' }} />
      <Tabs.Screen name="pending" options={{ href: null }} />
      <Tabs.Screen name="card" options={{ href: null }} />
      <Tabs.Screen name="lead-new" options={{ href: null }} />
      <Tabs.Screen name="lead-created" options={{ href: null }} />
      <Tabs.Screen name="lead" options={{ href: null }} />
      <Tabs.Screen name="payout-request" options={{ href: null }} />
    </Tabs>
  );
}
