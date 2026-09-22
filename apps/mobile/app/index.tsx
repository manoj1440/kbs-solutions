import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { routeFor, useSession } from '@/lib/session';

/** Entry: route by session + gates (REQ-04 §4.2). */
export default function Index() {
  const { status, user, gates } = useSession();
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }
  if (status === 'signed-out' || !user || !gates) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href={routeFor(user, gates) as never} />;
}
