/**
 * ExerciseSessionFlow
 *
 * Wrapper that orchestrates the exercise session flow:
 * - No session: Show ExercisePickerScreen
 * - Session active: Show ExerciseScreen
 *
 * This is the main entry point for the Workout tab.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnectionStore } from '@/stores';
import { getSessionRepository } from '@/data/provider';
import type { Exercise } from '@/domain/exercise';
import type { ExercisePlan } from '@/domain/workout';
import { ConnectPrompt } from '@/components/device';
import { ExercisePickerScreen } from './ExercisePickerScreen';
import { ExerciseScreen } from './ExerciseScreen';
import { colors } from '@/theme';

type FlowState = 'loading' | 'picker' | 'session';

/**
 * ExerciseSessionFlow - manages the exercise session lifecycle.
 */
export function ExerciseSessionFlow() {
  const { primaryDeviceId, devices } = useConnectionStore();
  const voltraStore = primaryDeviceId ? devices.get(primaryDeviceId) : null;

  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [sessionExercise, setSessionExercise] = useState<Exercise | null>(null);
  const [sessionPlan, setSessionPlan] = useState<ExercisePlan | null>(null);

  // Check for existing in-progress session on mount
  // Note: Session resumption is now handled at the app layout level
  useEffect(() => {
    setFlowState('picker');
  }, []);

  // Handle starting a session
  const handleStartSession = useCallback(
    (exercise: Exercise, plan: ExercisePlan) => {
      setSessionExercise(exercise);
      setSessionPlan(plan);
      setFlowState('session');
    },
    []
  );

  // Handle session complete
  const handleSessionComplete = useCallback(() => {
    setSessionExercise(null);
    setSessionPlan(null);
    setFlowState('picker');
  }, []);

  // Handle new session from results screen
  const handleNewSession = useCallback(() => {
    setFlowState('picker');
  }, []);

  // Require device connection
  if (!voltraStore) {
    return (
      <ConnectPrompt subtitle="Connect to your Voltra to start a workout" />
    );
  }

  // Loading state
  if (flowState === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text className="text-content-muted mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  // Picker state
  if (flowState === 'picker') {
    return (
      <ExercisePickerScreen
        onStartSession={handleStartSession}
      />
    );
  }

  // Session state
  if (flowState === 'session' && sessionExercise && sessionPlan) {
    return (
      <ExerciseScreen
        exercise={sessionExercise}
        plan={sessionPlan}
        voltraStore={voltraStore}
        repository={getSessionRepository()}
        onComplete={handleSessionComplete}
        onNewSession={handleNewSession}
      />
    );
  }

  // Fallback
  return null;
}
