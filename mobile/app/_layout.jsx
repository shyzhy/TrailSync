import '../global.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SourceSerif4_400Regular, SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4';
import * as SplashScreen from 'expo-splash-screen';

import { SessionProvider } from '../src/lib/useSession';
import { COLORS } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" backgroundColor={COLORS.paper} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.paper },
            headerTintColor: COLORS.ink,
            headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
            contentStyle: { backgroundColor: COLORS.paper },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
