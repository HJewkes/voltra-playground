import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import 'react-native-reanimated';

// Import global CSS for NativeWind
import '../global.css';

import { useConnectionStore } from '@/stores';
import { getAdapter, getExerciseRepository, getSessionRepository } from '@/data/provider';
import { bootstrapExercises } from '@/data/exercises';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { ResumeSessionPrompt } from '@/components/exercise';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
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
  const router = useRouter();

  // Session resumption state
  const [inProgressSession, setInProgressSession] = useState<StoredExerciseSession | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Initialize stores and data on app start
  useEffect(() => {
    // Bootstrap exercises from catalog
    bootstrapExercises(getExerciseRepository(), getAdapter())
      .then((result) => {
        if (result.added > 0) {
          console.log(`Bootstrapped ${result.added} exercises from catalog`);
        }
      })
      .catch((err) => {
        console.error('Failed to bootstrap exercises:', err);
      });

    // Check for in-progress session
    getSessionRepository()
      .getInProgress()
      .then((session) => {
        if (session) {
          console.log('[Layout] Found in-progress session:', session.id);
          setInProgressSession(session);
          setShowResumePrompt(true);
        }
      })
      .catch((err) => {
        console.error('Failed to check for in-progress session:', err);
      });

    // Restore last BLE connection
    useConnectionStore.getState().restoreLastConnection();

    // Set up app state listener for auto-reconnect on foreground
    const appStateCleanup = useConnectionStore.getState()._setupAppStateListener();

    // Start auto-scan for nearby devices
    const autoScanCleanup = useConnectionStore.getState().startAutoScan();

    return () => {
      appStateCleanup();
      autoScanCleanup();
    };
  }, []);

  // Handle resume - navigate to workout screen
  const handleResume = useCallback(() => {
    setShowResumePrompt(false);
    // Navigate to the workout tab which will load the session
    router.push('/(tabs)/workout');
  }, [router]);

  // Handle discard - mark session as abandoned
  const handleDiscard = useCallback(async () => {
    if (inProgressSession) {
      try {
        const repo = getSessionRepository();
        // Update session status to abandoned
        await repo.save({
          ...inProgressSession,
          status: 'abandoned',
          endTime: Date.now(),
        });
        await repo.setCurrent(null);
        console.log('[Layout] Discarded in-progress session:', inProgressSession.id);
      } catch (err) {
        console.error('Failed to discard session:', err);
      }
    }
    setInProgressSession(null);
    setShowResumePrompt(false);
  }, [inProgressSession]);

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      {/* Session resumption prompt */}
      {inProgressSession && (
        <ResumeSessionPrompt
          session={inProgressSession}
          visible={showResumePrompt}
          onResume={handleResume}
          onDiscard={handleDiscard}
        />
      )}
    </ThemeProvider>
  );
}
