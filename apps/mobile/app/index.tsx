import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text as RNText, View } from 'react-native';

import { LogoMark } from '@/components/auth';
import { Button } from '@/components/ui';
import { colors } from '@/lib/theme';
import { routeFor, useSession } from '@/lib/session';

/** Entry: route by session + gates (REQ-04 §4.2). */
export default function Index() {
  const { status, unreachable, user, gates, refresh, signOut } = useSession();
  const [retrying, setRetrying] = useState(false);
  // signed in but the session could not be checked (offline / server error): retry instead of signing out
  if (status === 'loading' && unreachable) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas px-8">
        <LogoMark size={56} />
        <RNText className="mt-3 text-center font-medium text-xl text-ink">
          Could not reach KBS
        </RNText>
        <RNText className="mb-3 text-center font-normal text-sm text-[#737373]">
          Check your connection and try again. You are still signed in.
        </RNText>
        <Button
          title="Try again"
          size="lg"
          icon="refresh"
          loading={retrying}
          disabled={retrying}
          onPress={async () => {
            setRetrying(true);
            await refresh();
            setRetrying(false);
          }}
        />
        <Button
          title="Sign out"
          variant="ghost"
          icon="log-out-outline"
          onPress={() => void signOut()}
        />
      </View>
    );
  }
  if (status === 'loading') {
    return (
      <View accessibilityLabel="Loading" className="flex-1 items-center justify-center bg-canvas">
        <LogoMark size={56} />
        <RNText className="mt-5 font-medium text-xl text-ink">KBS Solutions</RNText>
        <RNText className="mt-1 font-normal text-sm text-[#737373]">
          Credit card DSA platform
        </RNText>
        <ActivityIndicator color={colors.subtle} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (status === 'signed-out' || !user || !gates) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href={routeFor(user, gates) as never} />;
}
