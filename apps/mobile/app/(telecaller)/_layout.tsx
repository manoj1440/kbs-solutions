import { Redirect, Tabs } from 'expo-router';

import { TabBar, type TabSpec } from '@/components/tab-bar';
import { routeFor, useSession } from '@/lib/session';

const TABS: TabSpec[] = [
  { name: 'index', label: 'Queue', icon: 'call-outline', iconActive: 'call' },
  { name: 'id-card', label: 'ID card', icon: 'id-card-outline', iconActive: 'id-card' },
  { name: 'profile', label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function TelecallerLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(telecaller)') return <Redirect href={target as never} />;
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#F4F6FB' } }}
      tabBar={(props) => <TabBar {...props} tabs={TABS} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Queue' }} />
      <Tabs.Screen name="id-card" options={{ title: 'ID card' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="record" options={{ href: null }} />
      <Tabs.Screen name="card" options={{ href: null }} />
    </Tabs>
  );
}
