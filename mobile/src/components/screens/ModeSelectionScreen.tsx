/**
 * ModeSelectionScreen
 *
 * Unified training screen: mode selection, weight configuration, and exercise
 * recording in a single flow. Top section (modes + settings) disables during
 * active workout. Bottom section shows telemetry and start/stop controls.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from 'zustand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent, Section, SectionContent, getSemanticColors, alpha } from '@titan-design/react-ui';
import {
  MovementPhase,
  getSetVelocityLossPct,
  getSetMeanVelocity,
  getSetRepVelocities,
  estimateSetRIR,
} from '@voltras/workout-analytics';

import { useConnectionStore, selectIsConnected, createRecordingStore } from '@/stores';
import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { getEffortLabel, getRPEColor } from '@/domain/workout';
import { ModeControls } from '@/components/mode';
import { RecordingDisplayView, WorkoutControls } from '@/components/recording';
import { PhaseIndicator } from '@/components/recording/PhaseIndicator';
import type { VoltraStoreApi } from '@/stores/voltra-store';
import type { CompletedSet } from '@/domain/workout';

const t = getSemanticColors('dark');

type IconName = keyof typeof Ionicons.glyphMap;
const MODE_META: Partial<Record<TrainingMode, { desc: string; icon: IconName }>> = {
  [TrainingMode.WeightTraining]: { desc: 'Free weights & cables', icon: 'barbell-outline' },
  [TrainingMode.ResistanceBand]: { desc: 'Elastic resistance', icon: 'fitness-outline' },
  [TrainingMode.Rowing]: { desc: 'Row machine simulation', icon: 'boat-outline' },
  [TrainingMode.Damper]: { desc: 'Fluid resistance', icon: 'water-outline' },
  [TrainingMode.Isokinetic]: { desc: 'Constant velocity', icon: 'speedometer-outline' },
  [TrainingMode.Isometric]: { desc: 'Static holds', icon: 'hand-left-outline' },
};

const TRAINING_MODES = Object.keys(MODE_META).map(Number) as TrainingMode[];

type WorkoutState = 'idle' | 'preparing' | 'countdown' | 'recording' | 'summary';

export function ModeSelectionScreen() {
  const router = useRouter();
  const isConnected = useConnectionStore(selectIsConnected);
  const voltraStore = useConnectionStore((s) => s.getPrimaryDevice());
  const disconnectAll = useConnectionStore((s) => s.disconnectAll);

  useEffect(() => {
    if (!isConnected) router.replace('/');
  }, [isConnected, router]);

  if (!voltraStore) return null;

  return <UnifiedTrainingScreen voltraStore={voltraStore} disconnectAll={disconnectAll} />;
}

function UnifiedTrainingScreen({ voltraStore, disconnectAll }: {
  voltraStore: VoltraStoreApi;
  disconnectAll: () => Promise<void>;
}) {
  const mode = useStore(voltraStore, (s) => s.mode);
  const setMode = useStore(voltraStore, (s) => s.setMode);
  const weight = useStore(voltraStore, (s) => s.weight);
  const deviceName = useStore(voltraStore, (s) => s.deviceName) ?? 'Voltra';
  const currentSample = useStore(voltraStore, (s) => s.currentSample);

  const recordingStore = useMemo(() => createRecordingStore(), []);
  const repCount = useStore(recordingStore, (s) => s.repCount);
  const lastRepPeakVelocity = useStore(recordingStore, (s) => s.lastRepPeakVelocity);
  const rpe = useStore(recordingStore, (s) => s.rpe);
  const rir = useStore(recordingStore, (s) => s.rir);
  const velocityLoss = useStore(recordingStore, (s) => s.velocityLoss);
  const liveMessage = useStore(recordingStore, (s) => s.liveMessage);

  const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [summary, setSummary] = useState<CompletedSet | null>(null);
  const [duration, setDuration] = useState(0);
  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const isIdle = mode === TrainingMode.Idle;
  const isActive = workoutState === 'countdown' || workoutState === 'recording';
  const configDisabled = isActive || workoutState === 'preparing';
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
    setWorkoutState('recording');
  }, [recordingStore]);

  const handleStart = useCallback(async () => {
    try {
      setWorkoutState('preparing');
      await voltraStore.getState().prepareWorkout();
      await voltraStore.getState().engageMotor();

      setCountdown(3);
      setWorkoutState('countdown');
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
      Alert.alert('Error', `Failed to start: ${message}`);
      setWorkoutState('idle');
    }
  }, [voltraStore, recordingStore, startRecording]);

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
    setWorkoutState('summary');
  }, [voltraStore, recordingStore, weight]);

  const handleDismissSummary = useCallback(() => {
    recordingStore.getState().reset();
    setSummary(null);
    setWorkoutState('idle');
  }, [recordingStore]);

  const handleDisconnect = async () => {
    setShowDisconnectMenu(false);
    if (isActive) await handleStop();
    await disconnectAll();
  };

  // Subscribe to voltra telemetry during recording
  useEffect(() => {
    if (workoutState !== 'recording') return;
    const unsubscribe = voltraStore.subscribe((state, prevState) => {
      if (state.currentSample && state.currentSample !== prevState.currentSample) {
        recordingStore.getState().processSample(state.currentSample);
      }
    });
    return unsubscribe;
  }, [voltraStore, recordingStore, workoutState]);

  useEffect(() => {
    return () => cleanupCountdown();
  }, []);

  const rpeColor = getRPEColor(rpe);
  const phase = currentSample?.phase ?? MovementPhase.IDLE;

  return (
    <SafeAreaView className="flex-1 bg-surface-400">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <View className="flex-row items-center gap-3">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: t['status-success'] }} />
          <Text className="text-sm font-semibold text-text-primary">{deviceName}</Text>
        </View>
        <View className="relative">
          <TouchableOpacity
            onPress={() => setShowDisconnectMenu((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Device settings"
          >
            <Ionicons name="cog-outline" size={22} color={t['text-secondary']} />
          </TouchableOpacity>
          {showDisconnectMenu && (
            <View className="absolute right-0 top-8 z-10 rounded-lg bg-surface-300 p-1 shadow-lg">
              <TouchableOpacity
                onPress={handleDisconnect}
                className="flex-row items-center gap-2 rounded-md px-4 py-2.5"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Disconnect device"
              >
                <Ionicons name="bluetooth-outline" size={16} color={t['status-error']} />
                <Text style={{ color: t['status-error'] }} className="text-sm font-medium">
                  Disconnect
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" scrollEnabled={!isActive}>
        <View className="px-4 pb-4">
          {/* Mode cards */}
          <View style={{ opacity: configDisabled ? 0.4 : 1 }} pointerEvents={configDisabled ? 'none' : 'auto'}>
            <Section>
              <SectionContent>
                <View className="flex-row flex-wrap gap-2">
                  {TRAINING_MODES.map((modeValue) => {
                    const isSelected = mode === modeValue;
                    const meta = MODE_META[modeValue]!;
                    return (
                      <View key={modeValue} className="w-[48%]">
                        <Card
                          variant={isSelected ? 'outline' : 'filled'}
                          elevation={isSelected ? 2 : 1}
                          isInteractive
                          onPress={() => setMode(modeValue)}
                          borderColor={isSelected ? t['brand-primary'] : undefined}
                          accessibilityState={{ selected: isSelected }}
                        >
                          <CardContent className="flex-row items-center gap-3 px-4">
                            <Ionicons
                              name={meta.icon}
                              size={18}
                              color={isSelected ? t['brand-primary'] : t['text-secondary']}
                            />
                            <View className="flex-1">
                              <Text
                                className="text-xs font-semibold"
                                style={{ color: isSelected ? t['brand-primary'] : t['text-primary'] }}
                              >
                                {TrainingModeNames[modeValue]}
                              </Text>
                              <Text className="text-[10px] text-text-tertiary">{meta.desc}</Text>
                            </View>
                          </CardContent>
                        </Card>
                      </View>
                    );
                  })}
                </View>
              </SectionContent>
            </Section>

            {/* Weight + eccentric + chains */}
            <ModeControls mode={mode} voltraStore={voltraStore} />
          </View>

          {/* Telemetry area */}
          {workoutState === 'preparing' && (
            <View className="mt-4 items-center py-8">
              <Text className="text-lg text-text-disabled">Preparing...</Text>
            </View>
          )}

          {workoutState === 'countdown' && (
            <View className="mt-4">
              <RecordingDisplayView
                uiState="countdown"
                instruction="Get Ready"
                subInstruction={`${modeName} - ${weight} lbs`}
                startCountdown={countdown}
                repCount={0}
                lastRepPeakVelocity={null}
              />
            </View>
          )}

          {workoutState === 'recording' && (
            <View className="mt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <PhaseIndicator phase={phase} />
                {liveMessage ? (
                  <Text className="text-sm font-medium" style={{ color: rpeColor }}>
                    {liveMessage}
                  </Text>
                ) : null}
              </View>

              <RecordingDisplayView
                uiState="recording"
                instruction="Lift!"
                repCount={repCount}
                lastRepPeakVelocity={lastRepPeakVelocity}
              />

              <View
                className="mt-3 flex-row items-center justify-between rounded-xl px-4 py-3"
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

              <View className="mt-3">
                <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: alpha('#fff', 0.08) }}>
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

          {workoutState === 'summary' && (
            <View className="mt-4">
              <WorkoutSummary
                summary={summary}
                duration={duration}
                modeName={modeName}
                weight={weight}
              />
              <TouchableOpacity
                onPress={handleDismissSummary}
                activeOpacity={0.7}
                accessibilityRole="button"
                className="mt-3 items-center rounded-xl py-3"
                style={{ backgroundColor: t['surface-elevated'] }}
              >
                <Text className="text-sm font-semibold text-text-primary">Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pinned bottom button */}
      {!isIdle && workoutState !== 'summary' && (
        <View className="px-4 pb-4 pt-2">
          <WorkoutControls
            isActive={isActive}
            onStart={handleStart}
            onStop={handleStop}
          />
        </View>
      )}
    </SafeAreaView>
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
    <View className="items-center rounded-3xl p-6"
      style={{ backgroundColor: alpha(t['status-success'], 0.12) }}
    >
      <Ionicons name="checkmark-circle" size={40} color={t['status-success']} />
      <Text className="mt-2 text-xl font-bold text-text-primary">Workout Complete</Text>
      <Text className="mt-1 text-sm text-text-secondary">{modeName} - {weight} lbs</Text>

      <View className="mt-4 w-full flex-row justify-around">
        <SummaryStat label="Reps" value={String(repCount)} />
        <SummaryStat label="Duration" value={durationStr} />
        <SummaryStat
          label="Peak Vel"
          value={peakVel > 0 ? peakVel.toFixed(2) : '--'}
          unit="m/s"
        />
      </View>

      {repCount > 0 && (
        <View className="mt-3 w-full flex-row justify-around">
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
      <Text className="text-lg font-bold text-text-primary">
        {value}
        {unit && <Text className="text-sm text-text-secondary"> {unit}</Text>}
      </Text>
    </View>
  );
}
