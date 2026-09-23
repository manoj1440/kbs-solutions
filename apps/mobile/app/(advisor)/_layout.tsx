import { Redirect, router, Tabs } from 'expo-router';

import { TabBar, type TabSpec } from '@/components/tab-bar';
import { routeFor, useSession } from '@/lib/session';

const TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'leads', label: 'Leads', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'cards', label: 'Cards', icon: 'card-outline', iconActive: 'card' },
  { name: 'payouts', label: 'Earnings', icon: 'wallet-outline', iconActive: 'wallet' },
];

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function AdvisorLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(advisor)') return <Redirect href={target as never} />;
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#F4F6FB' } }}
      tabBar={(props) => (
        <TabBar
          {...props}
          tabs={TABS}
          center={{
            icon: 'add',
            label: 'New lead',
            onPress: () => router.push('/(advisor)/cards' as never),
          }}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads' }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards' }} />
      <Tabs.Screen name="payouts" options={{ title: 'Earnings' }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="pending" options={{ href: null }} />
      <Tabs.Screen name="card" options={{ href: null }} />
      <Tabs.Screen name="lead-new" options={{ href: null }} />
      <Tabs.Screen name="lead-created" options={{ href: null }} />
      <Tabs.Screen name="lead" options={{ href: null }} />
      <Tabs.Screen name="payout-request" options={{ href: null }} />
    </Tabs>
  );
}
