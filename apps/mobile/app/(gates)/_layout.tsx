import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/lib/session';

/** Gate screens (training, onboarding, network): a revoked or ended session goes back to sign-in. */
export default function GatesLayout() {
  const { status } = useSession();
  if (status === 'signed-out') return <Redirect href="/(auth)/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
