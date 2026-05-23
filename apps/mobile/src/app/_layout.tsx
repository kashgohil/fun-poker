import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authClient } from '@/lib/auth-client';
import { SplashIntro } from '@/components/splash-intro';

// Hand the native splash off to our animated one as soon as React mounts.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // Hide the static native splash so our animated intro is what's visible.
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {!introDone || isPending ? (
          <SplashIntro onDone={() => setIntroDone(true)} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={!session}>
              <Stack.Screen name="sign-in" />
            </Stack.Protected>
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
