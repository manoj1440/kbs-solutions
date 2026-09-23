import { Redirect, Tabs } from 'expo-router';

import { TabBar, type TabSpec } from '@/components/tab-bar';
import { routeFor, useSession } from '@/lib/session';

const TABS: TabSpec[] = [
  { name: 'index', label: 'Team', icon: 'people-outline', iconActive: 'people' },
  { name: 'advisors', label: 'Advisors', icon: 'briefcase-outline', iconActive: 'briefcase' },
  {
    name: 'approvals',
    label: 'Approvals',
    icon: 'checkmark-done-circle-outline',
    iconActive: 'checkmark-done-circle',
  },
  { name: 'profile', label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function ManagerLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(manager)') return <Redirect href={target as never} />;
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#F4F6FB' } }}
      tabBar={(props) => <TabBar {...props} tabs={TABS} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Team' }} />
      <Tabs.Screen name="advisors" options={{ title: 'Advisors' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="create-telecaller" options={{ href: null }} />
      <Tabs.Screen name="telecaller" options={{ href: null }} />
      <Tabs.Screen name="payout-request" options={{ href: null }} />
      <Tabs.Screen name="advisor" options={{ href: null }} />
      <Tabs.Screen name="lead" options={{ href: null }} />
    </Tabs>
  );
}
