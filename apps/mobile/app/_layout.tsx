import '../global.css';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeviceWarningBanner } from '@/components/device-warning';
import { OfflineBanner } from '@/components/offline-banner';
import { ScreenProtection } from '@/components/secure-screen';
import { SessionProvider } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  // F-805: Inter faces ship with the JS bundle (expo-font is linked by expo) — no native rebuild needed.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.navy }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <ScreenProtection />
          <OfflineBanner />
          <DeviceWarningBanner />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade_from_bottom' }} />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
