import { useEffect } from 'react';
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
import { C } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.black, card: C.black, primary: C.red, text: C.text, border: C.border } };

export default function Root() {
  const [fonts] = useFonts({ BebasNeue_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.black }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <I18nProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <Gate fonts={fonts} />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gate({ fonts }: { fonts: boolean }) {
  const { ready, locked } = useAuth();
  useEffect(() => { if (fonts && ready) SplashScreen.hideAsync().catch(() => {}); }, [fonts, ready]);
  if (!fonts || !ready) return <View style={{ flex: 1, backgroundColor: C.black }} />;
  if (locked) return <LockScreen />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.black }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
