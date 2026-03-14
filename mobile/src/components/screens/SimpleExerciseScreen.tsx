/**
 * SimpleExerciseScreen
 *
 * Minimal recording interface for MVP: START -> 3-2-1 countdown -> live rep
 * count + velocity -> STOP. No session planning, no sets, no rest timer.
 * Directly uses recordingStore + voltraStore without the exercise session layer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useStore } from 'zustand';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, getSemanticColors } from '@titan-design/react-ui';

import { TrainingModeNames } from '@/domain/device';
import { useConnectionStore, selectIsConnected, createRecordingStore } from '@/stores';
import { RecordingDisplayView, WorkoutControls } from '@/components/recording';

const t = getSemanticColors('dark');

// =============================================================================
// Types
// =============================================================================

export type ExerciseState = 'idle' | 'preparing' | 'countdown' | 'recording';

export function getInstruction(state: ExerciseState): string {
  if (state === 'recording') return 'Lift!';
  if (state === 'countdown') return 'Get Ready';
  return 'Press Start';
}

export function isActiveState(state: ExerciseState): boolean {
  return state === 'countdown' || state === 'recording';
}

// =============================================================================
// Component
// =============================================================================

export function SimpleExerciseScreen() {
  const router = useRouter();
  const isConnected = useConnectionStore(selectIsConnected);
  const voltraStore = useConnectionStore((s) => s.getPrimaryDevice());

  const mode = useStore(voltraStore!, (s) => s.mode);
  const weight = useStore(voltraStore!, (s) => s.weight);

  const recordingStore = useMemo(() => createRecordingStore(), []);
  const repCount = useStore(recordingStore, (s) => s.repCount);
  const lastRepPeakVelocity = useStore(recordingStore, (s) => s.lastRepPeakVelocity);

  const [exerciseState, setExerciseState] = useState<ExerciseState>('idle');
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modeName = TrainingModeNames[mode] ?? 'Unknown';

  // Handle disconnection: navigate to connection screen
  useEffect(() => {
    if (!isConnected) {
      cleanupCountdown();
      router.replace('/');
    }
  }, [isConnected, router]);

  function cleanupCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  const startRecording = useCallback(() => {
    recordingStore.getState().startRecording();
    recordingStore.getState().setUIState('recording');
    setExerciseState('recording');
  }, [recordingStore]);

  const handleStart = useCallback(async () => {
    if (!voltraStore) return;

    try {
      setExerciseState('preparing');
      await voltraStore.getState().prepareWorkout();
      await voltraStore.getState().engageMotor();

      // Start countdown
      setCountdown(3);
      setExerciseState('countdown');
      recordingStore.getState().setUIState('countdown');

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            cleanupCountdown();
            startRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', `Failed to start workout: ${message}`);
      setExerciseState('idle');
    }
  }, [voltraStore, recordingStore, startRecording]);

  const handleStop = useCallback(async () => {
    if (!voltraStore) return;

    cleanupCountdown();
    recordingStore.getState().stopRecording(weight);
    recordingStore.getState().setUIState('idle');

    try {
      await voltraStore.getState().disengageMotor();
    } catch {
      // Best-effort disengage
    }

    recordingStore.getState().reset();
    setExerciseState('idle');
  }, [voltraStore, recordingStore, weight]);

  const handleBack = useCallback(() => {
    if (exerciseState === 'recording' || exerciseState === 'countdown') {
      Alert.alert('Stop Workout?', 'This will stop the current recording.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            await handleStop();
            router.replace('/modes');
          },
        },
      ]);
    } else {
      router.replace('/modes');
    }
  }, [exerciseState, handleStop, router]);

  // Subscribe to voltra telemetry during recording
  useEffect(() => {
    if (exerciseState !== 'recording' || !voltraStore) return;

    const unsubscribe = voltraStore.subscribe((state, prevState) => {
      if (state.currentSample && state.currentSample !== prevState.currentSample) {
        recordingStore.getState().processSample(state.currentSample);
      }
    });

    return unsubscribe;
  }, [voltraStore, recordingStore, exerciseState]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => cleanupCountdown();
  }, []);

  const isActive = isActiveState(exerciseState);

  const displayUIState =
    exerciseState === 'recording'
      ? 'recording'
      : exerciseState === 'countdown'
        ? 'countdown'
        : 'idle';

  const instruction = getInstruction(exerciseState);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 px-4 pt-2">
        {/* Header: back button + mode/weight */}
        <View className="mb-4 flex-row items-center">
          <Button variant="ghost" size="sm" onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={t['text-primary']} />
          </Button>
          <View className="ml-2 flex-1">
            <Text className="text-lg font-bold text-text-primary">{modeName}</Text>
            <Text className="text-sm text-text-secondary">{weight} lbs</Text>
          </View>
        </View>

        {/* Main content */}
        <View className="flex-1 justify-center" style={{ overflow: 'hidden' }}>
          {exerciseState === 'preparing' ? (
            <View className="items-center">
              <Text className="text-lg text-text-disabled">Preparing...</Text>
            </View>
          ) : (
            <RecordingDisplayView
              uiState={displayUIState}
              instruction={instruction}
              subInstruction={`${modeName} - ${weight} lbs`}
              startCountdown={countdown}
              repCount={repCount}
              lastRepPeakVelocity={lastRepPeakVelocity}
            />
          )}
        </View>

        {/* Controls */}
        <View className="pb-4 pt-2">
          <WorkoutControls
            isActive={isActive}
            onStart={handleStart}
            onStop={handleStop}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
