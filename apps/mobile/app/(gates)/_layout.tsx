import { Redirect, Stack, useSegments } from 'expo-router';

import { routeFor, useSession } from '@/lib/session';

/**
 * Gate screens (training, onboarding, network): a revoked or ended session goes back to sign-in, and a gate that has
 * cleared (or changed) sends the user where they now belong. The assessment keeps its result screen; it leaves by its
 * own Continue button.
 */
export default function GatesLayout() {
  const { status, unreachable, user, gates } = useSession();
  const segments = useSegments() as string[];
  if (status === 'signed-out') return <Redirect href="/(auth)/welcome" />;
  if (status === 'loading' && unreachable) return <Redirect href="/" />;
  if (user && gates && segments[0] === '(gates)' && segments[1] && segments[2] !== 'assessment') {
    const target = routeFor(user, gates);
    if (target !== `/(gates)/${segments[1]}`) return <Redirect href={target as never} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
