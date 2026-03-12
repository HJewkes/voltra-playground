/**
 * SimpleExerciseScreen
 *
 * Recording interface: auto-starts countdown on mount, shows live telemetry
 * (RPE, velocity loss, phase) during recording, and a summary on stop.
 * No session planning, no sets, no rest timer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { useStore } from 'zustand';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, getSemanticColors, alpha } from '@titan-design/react-ui';

import { TrainingModeNames } from '@/domain/device';
import { getEffortLabel, getRPEColor } from '@/domain/workout';
import { useConnectionStore, selectIsConnected, createRecordingStore } from '@/stores';
import { RecordingDisplayView, WorkoutControls } from '@/components/recording';
import { PhaseIndicator } from '@/components/recording/PhaseIndicator';
import {
  MovementPhase,
  getSetVelocityLossPct,
  getSetMeanVelocity,
  getSetRepVelocities,
  estimateSetRIR,
} from '@voltras/workout-analytics';
import type { VoltraStoreApi } from '@/stores/voltra-store';
import type { CompletedSet } from '@/domain/workout';

const t = getSemanticColors('dark');

type ExerciseState = 'preparing' | 'countdown' | 'recording' | 'summary';

export function SimpleExerciseScreen() {
  const router = useRouter();
  const isConnected = useConnectionStore(selectIsConnected);
  const voltraStore = useConnectionStore((s) => s.getPrimaryDevice());

  useEffect(() => {
    if (!isConnected) router.replace('/');
  }, [isConnected, router]);

  if (!voltraStore) return null;

  return <ExerciseInner voltraStore={voltraStore} />;
}

function ExerciseInner({ voltraStore }: { voltraStore: VoltraStoreApi }) {
  const router = useRouter();
  const mode = useStore(voltraStore, (s) => s.mode);
  const weight = useStore(voltraStore, (s) => s.weight);
  const currentSample = useStore(voltraStore, (s) => s.currentSample);

  const recordingStore = useMemo(() => createRecordingStore(), []);
  const repCount = useStore(recordingStore, (s) => s.repCount);
  const lastRepPeakVelocity = useStore(recordingStore, (s) => s.lastRepPeakVelocity);
  const rpe = useStore(recordingStore, (s) => s.rpe);
  const rir = useStore(recordingStore, (s) => s.rir);
  const velocityLoss = useStore(recordingStore, (s) => s.velocityLoss);
  const liveMessage = useStore(recordingStore, (s) => s.liveMessage);

  const [exerciseState, setExerciseState] = useState<ExerciseState>('preparing');
  const [countdown, setCountdown] = useState(3);
  const [summary, setSummary] = useState<CompletedSet | null>(null);
  const [duration, setDuration] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const modeName = TrainingModeNames[mode] ?? 'Unknown';

  function cleanupCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  const startRecording = useCallback(() => {
    recordingStore.getState().startRecording();
    recordingStore.getState().setUIState('recording');
    startTimeRef.current = Date.now();
    setExerciseState('recording');
  }, [recordingStore]);

  const beginCountdown = useCallback(async () => {
    try {
      setExerciseState('preparing');
      await voltraStore.getState().prepareWorkout();
      await voltraStore.getState().engageMotor();

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
      router.replace('/modes');
    }
  }, [voltraStore, recordingStore, startRecording, router]);

  // Auto-start on mount
  useEffect(() => {
    beginCountdown();
    return () => cleanupCountdown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = useCallback(async () => {
    cleanupCountdown();
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    const completedSet = recordingStore.getState().stopRecording(weight);
    recordingStore.getState().setUIState('idle');

    try {
      await voltraStore.getState().disengageMotor();
    } catch {
      // Best-effort disengage
    }

    setDuration(elapsed);
    setSummary(completedSet);
    setExerciseState('summary');
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

  const handleGoAgain = useCallback(() => {
    recordingStore.getState().reset();
    setSummary(null);
    beginCountdown();
  }, [recordingStore, beginCountdown]);

  // Subscribe to voltra telemetry during recording
  useEffect(() => {
    if (exerciseState !== 'recording') return;

    const unsubscribe = voltraStore.subscribe((state, prevState) => {
      if (state.currentSample && state.currentSample !== prevState.currentSample) {
        recordingStore.getState().processSample(state.currentSample);
      }
    });

    return unsubscribe;
  }, [voltraStore, recordingStore, exerciseState]);

  const isActive = exerciseState === 'countdown' || exerciseState === 'recording';

  if (exerciseState === 'summary') {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Header modeName={modeName} weight={weight} onBack={() => router.replace('/modes')} />

          <View className="flex-1 justify-center">
            <WorkoutSummary
              summary={summary}
              duration={duration}
              modeName={modeName}
              weight={weight}
            />
          </View>

          <View className="flex-row gap-3 pb-4 pt-2">
            <TouchableOpacity
              onPress={() => router.replace('/modes')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Done"
              className="flex-1 items-center rounded-2xl py-4"
              style={{ backgroundColor: t['surface-elevated'] }}
            >
              <Text className="text-base font-bold text-text-primary">Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleGoAgain}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go Again"
              className="flex-1 items-center rounded-2xl py-4"
              style={{ backgroundColor: t['brand-primary'] }}
            >
              <Text className="text-base font-bold text-white">Go Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const rpeColor = getRPEColor(rpe);
  const phase = currentSample?.phase ?? MovementPhase.IDLE;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 px-4 pt-2">
        <Header modeName={modeName} weight={weight} onBack={handleBack} />

        <View className="flex-1 justify-center" style={{ overflow: 'hidden' }}>
          {exerciseState === 'preparing' ? (
            <View className="items-center">
              <Text className="text-lg text-text-disabled">Preparing...</Text>
            </View>
          ) : exerciseState === 'countdown' ? (
            <RecordingDisplayView
              uiState="countdown"
              instruction="Get Ready"
              subInstruction={`${modeName} - ${weight} lbs`}
              startCountdown={countdown}
              repCount={0}
              lastRepPeakVelocity={null}
            />
          ) : (
            <View>
              {/* Phase indicator */}
              <View className="mb-3 flex-row items-center justify-between">
                <PhaseIndicator phase={phase} />
                {liveMessage ? (
                  <Text className="text-sm font-medium" style={{ color: rpeColor }}>
                    {liveMessage}
                  </Text>
                ) : null}
              </View>

              {/* Main recording display */}
              <RecordingDisplayView
                uiState="recording"
                instruction="Lift!"
                repCount={repCount}
                lastRepPeakVelocity={lastRepPeakVelocity}
              />

              {/* Live metrics bar */}
              <View className="mt-3 flex-row items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: alpha('#000', 0.3) }}
              >
                <MetricPill label="RPE" value={rpe.toFixed(1)} color={rpeColor} />
                <MetricPill
                  label="RIR"
                  value={rir >= 5 ? '5+' : `~${Math.round(rir)}`}
                  color={t['text-primary']}
                />
                <MetricPill
                  label="Vel Loss"
                  value={`${Math.round(velocityLoss)}%`}
                  color={velocityLoss > 30 ? t['status-error'] : velocityLoss > 20 ? t['status-warning'] : t['status-success']}
                />
              </View>

              {/* Fatigue bar */}
              <View className="mt-3">
                <View className="h-2 overflow-hidden rounded-full"
                  style={{ backgroundColor: alpha('#fff', 0.08) }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(velocityLoss, 50) * 2}%`,
                      backgroundColor:
                        velocityLoss > 30 ? t['status-error']
                          : velocityLoss > 20 ? t['status-warning']
                          : t['status-success'],
                    }}
                  />
                </View>
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-xs text-text-disabled">Fresh</Text>
                  <Text className="text-xs text-text-disabled">Fatigued</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Stop button only during active recording */}
        {isActive && (
          <View className="pb-4 pt-2">
            <WorkoutControls isActive onStart={() => {}} onStop={handleStop} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Header({ modeName, weight, onBack }: {
  modeName: string; weight: number; onBack: () => void;
}) {
  return (
    <View className="mb-4 flex-row items-center">
      <Button
        variant="ghost"
        size="sm"
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={t['text-primary']} />
      </Button>
      <View className="ml-2 flex-1">
        <Text className="text-lg font-bold text-text-primary">{modeName}</Text>
        <Text className="text-sm text-text-secondary">{weight} lbs</Text>
      </View>
    </View>
  );
}

function MetricPill({ label, value, color }: {
  label: string; value: string; color: string;
}) {
  return (
    <View className="items-center">
      <Text className="text-xs text-text-disabled">{label}</Text>
      <Text className="text-lg font-bold" style={{ color }}>{value}</Text>
    </View>
  );
}

function WorkoutSummary({ summary, duration, modeName, weight }: {
  summary: CompletedSet | null;
  duration: number;
  modeName: string;
  weight: number;
}) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const data = summary?.data;
  const repVelocities = data ? getSetRepVelocities(data) : [];
  const repCount = repVelocities.length;
  const meanVel = data ? getSetMeanVelocity(data) : 0;
  const peakVel = repVelocities.length > 0 ? Math.max(...repVelocities) : 0;
  const velLoss = data ? getSetVelocityLossPct(data) : 0;
  const { rpe } = data ? estimateSetRIR(data) : { rpe: 0 };

  return (
    <View className="items-center rounded-3xl p-8"
      style={{ backgroundColor: alpha(t['status-success'], 0.12) }}
    >
      <Ionicons name="checkmark-circle" size={48} color={t['status-success']} />
      <Text className="mt-3 text-2xl font-bold text-text-primary">Workout Complete</Text>
      <Text className="mt-1 text-base text-text-secondary">{modeName} - {weight} lbs</Text>

      <View className="mt-6 w-full flex-row justify-around">
        <SummaryStat label="Reps" value={String(repCount)} />
        <SummaryStat label="Duration" value={durationStr} />
        <SummaryStat
          label="Peak Vel"
          value={peakVel > 0 ? peakVel.toFixed(2) : '--'}
          unit="m/s"
        />
      </View>

      {repCount > 0 && (
        <View className="mt-4 w-full flex-row justify-around">
          <SummaryStat label="Avg Vel" value={meanVel.toFixed(2)} unit="m/s" />
          <SummaryStat label="Vel Loss" value={`${Math.round(velLoss)}%`} />
          <SummaryStat label="Est. RPE" value={rpe.toFixed(1)} />
        </View>
      )}
    </View>
  );
}

function SummaryStat({ label, value, unit }: {
  label: string; value: string; unit?: string;
}) {
  return (
    <View className="items-center">
      <Text className="text-xs text-text-disabled">{label}</Text>
      <Text className="text-xl font-bold text-text-primary">
        {value}
        {unit && <Text className="text-sm text-text-secondary"> {unit}</Text>}
      </Text>
    </View>
  );
}
