import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { I18nProvider } from '../lib/i18n';
import { AuthProvider, useAuth } from '../lib/auth';
import { LockScreen } from '../components/LockScreen';
import { ToastProvider } from '../components/Toast';
import { Preloader } from '../components/Preloader';
import { usePushRouting } from '../lib/push';
import { useLaunchUpdate } from '../lib/updates';
import { C } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// the red S fades into the app instead of cutting
try { SplashScreen.setOptions({ fade: true, duration: 350 }); } catch { /* web */ }
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.black, card: C.black, primary: C.red, text: C.text, border: C.border } };

export default function Root() {
  const [fonts] = useFonts({ BebasNeue_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.black }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="light" />
                <Gate fonts={fonts} />
              </ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gate({ fonts }: { fonts: boolean }) {
  const { ready: signedIn, locked, inside } = useAuth();
  const updated = useLaunchUpdate();
  const ready = signedIn && updated;
  usePushRouting();
  // the website's 0–100 % opening plays on every launch; the app appears as it fades
  const [intro, setIntro] = useState(true), [shown, setShown] = useState(false);
  const full = useCallback(() => setShown(true), []), done = useCallback(() => setIntro(false), []);
  useEffect(() => { if (fonts) SplashScreen.hideAsync().catch(() => {}); }, [fonts]);
  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.black }} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.black }}>
      {shown && ready ? (locked ? <LockScreen /> : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.black }, animation: 'slide_from_right' }}>
          {/* not signed in: the welcome screen comes first */}
          <Stack.Protected guard={!inside} redirectTo="/">
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          </Stack.Protected>
          {/* signed in, or looking around: the app */}
          <Stack.Protected guard={inside} redirectTo="/welcome">
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="listing/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="order/[id]" />
          </Stack.Protected>
          <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="settings" />
        </Stack>
      )) : null}
      {intro ? <Preloader ready={ready} onFull={full} onDone={done} /> : null}
    </View>
  );
}
