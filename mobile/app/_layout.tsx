import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { ThemeProvider as TitanThemeProvider } from '@titan-design/react-ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { useConnectionStore } from '@/stores';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  useEffect(() => {
    useConnectionStore.getState().restoreLastConnection();
    const appStateCleanup = useConnectionStore.getState()._setupAppStateListener();
    const autoScanCleanup = useConnectionStore.getState().startAutoScan();
    return () => {
      appStateCleanup();
      autoScanCleanup();
    };
  }, []);

  // TitanThemeProvider registers titan's semantic color tokens as native CSS
  // variables so descendant titan organisms (e.g. SetRow) resolve their
  // `--color-*` className tokens on-device instead of falling back to black.
  // Mobile is dark-only today. Harmless on web (global.css already defines them).
  return (
    <TitanThemeProvider mode="dark">
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="settings"
            options={{ presentation: 'modal', headerShown: true, title: 'Settings' }}
          />
        </Stack>
      </ThemeProvider>
    </TitanThemeProvider>
  );
}
