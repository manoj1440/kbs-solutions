import { Redirect, Tabs } from 'expo-router';

import { routeFor, useSession } from '@/lib/session';

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function ManagerLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(manager)') return <Redirect href={target as never} />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Team' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="create-telecaller" options={{ href: null }} />
      <Tabs.Screen name="telecaller" options={{ href: null }} />
      <Tabs.Screen name="payout-request" options={{ href: null }} />
    </Tabs>
  );
}
