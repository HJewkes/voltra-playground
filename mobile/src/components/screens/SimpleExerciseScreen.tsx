/**
 * SimpleExerciseScreen
 *
 * Training view for a selected mode. Weight/eccentric/chains config at top,
 * live telemetry always visible in the middle, start/stop pinned at bottom.
 * Config stays interactive between sets for adjust-and-go-again flow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, Pressable, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Surface, getSemanticColors, alpha } from '@titan-design/react-ui';

import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { getRPEColor } from '@/domain/workout';
import { useConnectionStore, selectIsConnected, createRecordingStore } from '@/stores';
import { WorkoutControls } from '@/components/recording';
import { AdvancedAccordion } from '@/components/mode';
import { TempoBar, SetTargets, EMPTY_TARGETS, VerticalWeightJog } from '@/components/exercise';
import type { SetTargetsState } from '@/components/exercise';
import { MovementPhase } from '@voltras/workout-analytics';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

type ExerciseState = 'idle' | 'preparing' | 'recording' | 'summary';

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
  const mode = useStore(voltraStore, (s) => s.mode);
  const setMode = useStore(voltraStore, (s) => s.setMode);
  const weight = useStore(voltraStore, (s) => s.weight);
  const currentSample = useStore(voltraStore, (s) => s.currentSample);
  const eccentric = useStore(voltraStore, (s) => s.eccentric);
  const setEccentric = useStore(voltraStore, (s) => s.setEccentric);
  const { chains, inverseChains } = useStore(
    voltraStore,
    useShallow((s) => ({ chains: s.chains, inverseChains: s.inverseChains })),
  );
  const setChains = useStore(voltraStore, (s) => s.setChains);
  const setInverseChains = useStore(voltraStore, (s) => s.setInverseChains);

  const showEccentric = mode === TrainingMode.WeightTraining || mode === TrainingMode.ResistanceBand;
  const showChains = mode === TrainingMode.WeightTraining;

  const recordingStore = useMemo(() => createRecordingStore(), []);
  const repCount = useStore(recordingStore, (s) => s.repCount);
  const lastRepPeakVelocity = useStore(recordingStore, (s) => s.lastRepPeakVelocity);
  const meanVelocity = useStore(recordingStore, (s) => s.meanVelocity);
  const rpe = useStore(recordingStore, (s) => s.rpe);
  const rir = useStore(recordingStore, (s) => s.rir);
  const velocityLoss = useStore(recordingStore, (s) => s.velocityLoss);
  const liveMessage = useStore(recordingStore, (s) => s.liveMessage);
  const currentPhase = useStore(recordingStore, (s) => s.currentPhase);
  const phaseElapsedMs = useStore(recordingStore, (s) => s.phaseElapsedMs);
  const repPhaseDurations = useStore(recordingStore, (s) => s.repPhaseDurations);

  const [exerciseState, setExerciseState] = useState<ExerciseState>('idle');
  const [duration, setDuration] = useState(0);
  const [setTargets, setSetTargets] = useState<SetTargetsState>(EMPTY_TARGETS);
  const startTimeRef = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerProgress = useSharedValue(0);

  const modeName = TrainingModeNames[mode] ?? 'Unknown';
  const isRecording = exerciseState === 'recording';
  const isSummary = exerciseState === 'summary';
  const isActive = isRecording || exerciseState === 'preparing';

  const toggleDrawer = useCallback(() => {
    if (isRecording) return;
    setDrawerOpen((prev) => {
      const next = !prev;
      drawerProgress.value = withSpring(next ? 1 : 0, { damping: 20, stiffness: 200 });
      return next;
    });
  }, [isRecording, drawerProgress]);

  const handleSelectMode = useCallback((m: TrainingMode) => {
    setMode(m);
    setDrawerOpen(false);
    drawerProgress.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, [setMode, drawerProgress]);

  // Live duration timer
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const handleStart = useCallback(async () => {
    try {
      setExerciseState('preparing');
      await voltraStore.getState().prepareWorkout();
      await voltraStore.getState().engageMotor();

      recordingStore.getState().startRecording();
      recordingStore.getState().setUIState('recording');
      startTimeRef.current = Date.now();
      setDuration(0);
      setExerciseState('recording');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', `Failed to start: ${message}`);
      setExerciseState('idle');
    }
  }, [voltraStore, recordingStore]);

  const handleStop = useCallback(async () => {
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    recordingStore.getState().stopRecording(weight);
    recordingStore.getState().setUIState('idle');

    try {
      await voltraStore.getState().disengageMotor();
    } catch {
      // Best-effort disengage
    }

    setDuration(elapsed);
    setExerciseState('summary');
  }, [voltraStore, recordingStore, weight]);

  const handleGoAgain = useCallback(() => {
    recordingStore.getState().reset();
    handleStart();
  }, [recordingStore, handleStart]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drawerProgress.value * 180}deg` }],
  }));

  // Telemetry subscription
  useEffect(() => {
    if (!isRecording) return;
    const unsubscribe = voltraStore.subscribe((state, prevState) => {
      if (state.currentSample && state.currentSample !== prevState.currentSample) {
        recordingStore.getState().processSample(state.currentSample);
      }
    });
    return unsubscribe;
  }, [voltraStore, recordingStore, isRecording]);

  const hasMetrics = repCount > 0;
  const rpeColor = hasMetrics ? getRPEColor(rpe) : t['text-disabled'];

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <SafeAreaView className="flex-1 bg-surface-400" edges={['top']}>
      {/* Header — tappable mode switcher */}
      <Pressable
        onPress={toggleDrawer}
        style={{ opacity: isRecording ? 0.5 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={`${modeName} — tap to switch mode`}
      >
        <View className="flex-row items-center justify-center px-4 pt-2 pb-1 gap-2">
          <Ionicons
            name={MODE_META[mode]?.icon ?? 'barbell-outline'}
            size={18}
            color={t['brand-primary']}
          />
          <Text className="text-base font-bold text-text-primary">{modeName}</Text>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color={t['text-tertiary']} />
          </Animated.View>
        </View>
      </Pressable>

      {/* Mode drawer */}
      {drawerOpen && (
        <ModeDrawer
          currentMode={mode}
          onSelect={handleSelectMode}
          onClose={toggleDrawer}
        />
      )}

      <ScrollView className="flex-1" scrollEnabled={!isRecording}>
        <View className="px-4 pb-4">
          {/* Unified config: Sets | Reps/RIR | Weight | Tempo | Rest */}
          <Surface elevation={1} className="mt-1 rounded-xl py-3 px-2">
            <SetTargets
              targets={setTargets}
              onChange={setSetTargets}
              disabled={isActive}
              weightSlot={
                <VerticalWeightJog
                  weight={weight}
                  onWeightChange={(w) => { voltraStore.getState().setWeight(w); }}
                  disabled={isActive}
                />
              }
            />
            {/* Advanced settings (eccentric, chains) */}
            {(showEccentric || showChains) && (
              <View
                className="px-1"
                style={{ opacity: isActive ? 0.4 : 1 }}
                pointerEvents={isActive ? 'none' : 'auto'}
              >
                <AdvancedAccordion
                  showEccentric={showEccentric}
                  showChains={showChains}
                  eccentric={eccentric}
                  setEccentric={setEccentric}
                  chains={chains}
                  inverseChains={inverseChains}
                  setChains={setChains}
                  setInverseChains={setInverseChains}
                />
              </View>
            )}
          </Surface>

          {/* Unified telemetry card */}
          <Surface elevation={1} className="mt-2 rounded-xl p-4">
            {/* Row 1: Rep count + peak velocity */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-3xl font-bold text-text-primary">
                  {repCount}
                </Text>
                <Text className="text-sm text-text-tertiary">
                  {repCount === 1 ? 'rep' : 'reps'}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-text-disabled">Peak</Text>
                <Text className="text-lg font-bold text-text-primary">
                  {hasMetrics ? lastRepPeakVelocity?.toFixed(2) ?? '–' : '–'}
                  <Text className="text-sm text-text-tertiary"> m/s</Text>
                </Text>
              </View>
            </View>

            {/* Row 2: Duration + avg velocity */}
            <View className="mt-1 flex-row items-center justify-between">
              <View className="flex-row items-baseline gap-1.5">
                <Text className="text-sm text-text-tertiary">
                  {isRecording || isSummary ? durationStr : '–'}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm text-text-tertiary">
                  {hasMetrics ? `${meanVelocity.toFixed(2)} m/s avg` : '–'}
                </Text>
              </View>
            </View>

            {/* Tempo bar */}
            <View className="mt-3">
              <TempoBar
                currentPhase={isRecording ? currentPhase : MovementPhase.IDLE}
                phaseElapsedMs={phaseElapsedMs}
                repPhaseDurations={repPhaseDurations}
              />
            </View>

            {/* Metrics bar: RPE + RIR + Vel Loss */}
            <View
              className="mt-2 flex-row items-center justify-around rounded-lg px-4 py-2"
              style={{ backgroundColor: alpha('#fff', 0.06) }}
            >
              <MetricCell
                label="RPE"
                value={hasMetrics ? rpe.toFixed(1) : '–'}
                color={rpeColor}
              />
              <MetricCell
                label="RIR"
                value={hasMetrics ? (rir >= 5 ? '5+' : `~${Math.round(rir)}`) : '–'}
                color={hasMetrics ? t['text-primary'] : t['text-disabled']}
              />
              <MetricCell
                label="Vel Loss"
                value={hasMetrics ? `${Math.round(velocityLoss)}%` : '–'}
                color={hasMetrics ? velLossColor(velocityLoss) : t['text-disabled']}
              />
            </View>

            {/* Effort message — only during recording */}
            {liveMessage && !isSummary ? (
              <Text className="mt-2 text-center text-sm font-medium" style={{ color: rpeColor }}>
                {liveMessage}
              </Text>
            ) : null}

            {/* Bottom section: fatigue bar OR set complete */}
            {isSummary ? (
              <View className="mt-3">
                <View
                  className="flex-row items-center justify-center gap-2 rounded-lg py-2.5"
                  style={{ backgroundColor: alpha(t['status-success'], 0.12) }}
                >
                  <Ionicons name="checkmark-circle" size={18} color={t['status-success']} />
                  <Text className="text-sm font-semibold" style={{ color: t['status-success'] }}>
                    Set Complete
                  </Text>
                  <Text className="text-sm text-text-tertiary">
                    {modeName} · {weight} lbs
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleGoAgain}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Go Again"
                  className="mt-3 items-center rounded-lg py-2.5"
                  style={{ backgroundColor: t['brand-primary'] }}
                >
                  <Text className="text-sm font-bold text-white">Go Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mt-2.5">
                <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: alpha('#fff', 0.08) }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: hasMetrics ? `${Math.min(velocityLoss, 50) * 2}%` : '0%',
                      backgroundColor: velLossColor(velocityLoss),
                    }}
                  />
                </View>
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-[10px] text-text-disabled">Fresh</Text>
                  <Text className="text-[10px] text-text-disabled">Fatigued</Text>
                </View>
              </View>
            )}
          </Surface>
        </View>
      </ScrollView>

      {/* Pinned start/stop */}
      {!isSummary && (
        <View className="px-4 pb-4 pt-2">
          <WorkoutControls
            isActive={isRecording}
            onStart={handleStart}
            onStop={handleStop}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// Mode drawer & helpers
// =============================================================================

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

function ModeDrawer({
  currentMode,
  onSelect,
  onClose,
}: {
  currentMode: TrainingMode;
  onSelect: (m: TrainingMode) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: alpha('#000', 0.4),
        }}
      />
      {/* Panel */}
      <View
        style={{
          zIndex: 11,
          backgroundColor: t['surface-300'] ?? '#1a1a1a',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 12,
          ...Platform.select({
            web: {
              boxShadow: `0 8px 24px ${alpha('#000', 0.5)}`,
            } as any,
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            },
          }),
        }}
      >
        <View className="flex-row flex-wrap gap-2">
          {TRAINING_MODES.map((modeValue) => {
            const isSelected = currentMode === modeValue;
            const meta = MODE_META[modeValue]!;
            return (
              <TouchableOpacity
                key={modeValue}
                onPress={() => onSelect(modeValue)}
                activeOpacity={0.7}
                style={{
                  width: '48%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: isSelected
                    ? alpha(t['brand-primary'], 0.12)
                    : alpha('#fff', 0.04),
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: isSelected ? alpha(t['brand-primary'], 0.3) : 'transparent',
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Ionicons
                  name={meta.icon}
                  size={16}
                  color={isSelected ? t['brand-primary'] : t['text-secondary']}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: isSelected ? '700' : '600',
                      color: isSelected ? t['brand-primary'] : t['text-primary'],
                    }}
                  >
                    {TrainingModeNames[modeValue]}
                  </Text>
                  <Text style={{ fontSize: 9, color: t['text-tertiary'] }}>
                    {meta.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

function velLossColor(loss: number): string {
  if (loss > 30) return t['status-error'];
  if (loss > 20) return t['status-warning'];
  return t['status-success'];
}

function MetricCell({ label, value, color }: {
  label: string; value: string; color: string;
}) {
  return (
    <View className="items-center">
      <Text className="text-[10px] text-text-disabled">{label}</Text>
      <Text className="text-base font-bold" style={{ color }}>{value}</Text>
    </View>
  );
}
