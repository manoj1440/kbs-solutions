import '../global.css';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeviceWarningBanner } from '@/components/device-warning';
import { OfflineBanner } from '@/components/offline-banner';
import { UpdateGate } from '@/components/update-gate';
import { ScreenProtection } from '@/components/secure-screen';
import { SessionProvider } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  // F-820: Manrope faces ship with the JS bundle (expo-font is linked by expo) — no native rebuild needed.
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  if (!fontsLoaded && !fontError)
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* F-819: OTA updates apply on open; an Admin-set minimum version blocks outdated installs */}
        <UpdateGate>
          <SessionProvider>
            <StatusBar style="dark" />
            <ScreenProtection />
            <OfflineBanner />
            <DeviceWarningBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.canvas },
                animation: 'fade_from_bottom',
              }}
            />
          </SessionProvider>
        </UpdateGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
