import { Redirect } from 'expo-router';
import { ActivityIndicator, Text as RNText, View } from 'react-native';

import { LogoMark, Orbs } from '@/components/auth';
import { gradients, gradientStyle } from '@/lib/theme';
import { routeFor, useSession } from '@/lib/session';

/** Entry: route by session + gates (REQ-04 §4.2). */
export default function Index() {
  const { status, user, gates } = useSession();
  if (status === 'loading') {
    return (
      <View
        accessibilityLabel="Loading"
        className="flex-1 items-center justify-center"
        style={gradientStyle(gradients.heroDeep, 165)}
      >
        <Orbs />
        <LogoMark size={76} />
        <RNText className="mt-5 font-extrabold text-[22px] tracking-tight text-white">
          KBS Solutions
        </RNText>
        <RNText className="mt-1 font-medium text-[13px] text-white/60">
          Credit Card DSA Platform
        </RNText>
        <ActivityIndicator color="#F5B942" style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (status === 'signed-out' || !user || !gates) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href={routeFor(user, gates) as never} />;
}
