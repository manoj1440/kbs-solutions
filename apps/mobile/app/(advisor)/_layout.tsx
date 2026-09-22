import { Redirect, Tabs } from 'expo-router';

import { routeFor, useSession } from '@/lib/session';

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function AdvisorLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(advisor)') return <Redirect href={target as never} />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="leads" options={{ title: 'My leads' }} />
      <Tabs.Screen name="pending" options={{ title: 'Pending' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="card" options={{ href: null }} />
      <Tabs.Screen name="lead-new" options={{ href: null }} />
      <Tabs.Screen name="lead-created" options={{ href: null }} />
      <Tabs.Screen name="lead" options={{ href: null }} />
    </Tabs>
  );
}
