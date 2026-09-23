import { Redirect, Tabs } from 'expo-router';

import { routeFor, useSession } from '@/lib/session';

/** Role area: re-checks gates on every render so a revoked gate bounces the user out (F-111). */
export default function TelecallerLayout() {
  const { status, user, gates } = useSession();
  if (status === 'loading') return null;
  if (!user || !gates) return <Redirect href="/(auth)/welcome" />;
  const target = routeFor(user, gates);
  if (target !== '/(telecaller)') return <Redirect href={target as never} />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Queue' }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="record" options={{ href: null }} />
      <Tabs.Screen name="card" options={{ href: null }} />
      <Tabs.Screen name="id-card" options={{ href: null }} />
    </Tabs>
  );
}
