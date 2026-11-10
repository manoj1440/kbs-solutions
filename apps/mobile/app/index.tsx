import { Redirect } from 'expo-router';
import { ActivityIndicator, Text as RNText, View } from 'react-native';

import { LogoMark } from '@/components/auth';
import { colors } from '@/lib/theme';
import { routeFor, useSession } from '@/lib/session';

/** Entry: route by session + gates (REQ-04 §4.2). */
export default function Index() {
  const { status, user, gates } = useSession();
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
