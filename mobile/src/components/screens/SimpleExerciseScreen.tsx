/**
 * SimpleExerciseScreen
 *
 * Training view for a selected mode. Plan-as-you-go workflow:
 * - Quick config bar: Reps/RIR dial, weight jog, add set button
 * - Advanced accordion: eccentric, chains, tempo
 * - Live telemetry during recording
 * - Unified set list with charts
 *
 * Session orchestration is delegated to exercise-session-store.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, Pressable, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Surface, getSemanticColors, alpha } from '@titan-design/react-ui';

import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { createEmptyPlan } from '@/domain/workout';
import type { TempoTarget, PlannedSet } from '@/domain/workout';
import { createExercise } from '@/domain/exercise';
import { useConnectionStore, selectIsConnected, createRecordingStore, createExerciseSessionStore } from '@/stores';
import { WorkoutControls } from '@/components/recording';
import { AdvancedAccordion } from '@/components/mode';
import { QuickConfig, VerticalWeightJog, SetLog } from '@/components/exercise';
import type { TargetMode } from '@/components/exercise';
import { MovementPhase } from '@voltras/workout-analytics';
import type { VoltraStoreApi } from '@/stores/voltra-store';

const t = getSemanticColors('dark');

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
  const deviceWeight = useStore(voltraStore, (s) => s.weight);
  const eccentric = useStore(voltraStore, (s) => s.eccentric);

  // Default to 45 lbs (empty barbell) if device reports 0
  const weight = deviceWeight || 45;
  useEffect(() => {
    if (deviceWeight === 0) {
      voltraStore.getState().setWeight(45);
    }
  }, [deviceWeight, voltraStore]);
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
  const rpe = useStore(recordingStore, (s) => s.rpe);
  const rir = useStore(recordingStore, (s) => s.rir);
  const liveMessage = useStore(recordingStore, (s) => s.liveMessage);
  const currentPhase = useStore(recordingStore, (s) => s.currentPhase);
  const phaseElapsedMs = useStore(recordingStore, (s) => s.phaseElapsedMs);
  const repPhaseDurations = useStore(recordingStore, (s) => s.repPhaseDurations);
  const liveSamples = useStore(recordingStore, (s) => s.liveSamples);

  const sessionStore = useMemo(() => createExerciseSessionStore(), []);
  const uiState = useStore(sessionStore, (s) => s.uiState);
  const setLog = useStore(sessionStore, (s) => s.setLog);
  const restElapsedMs = useStore(sessionStore, (s) => s.restElapsedMs);
  const currentSetIndex = useStore(sessionStore, (s) => s.currentSetIndex);
  const currentPlannedSet = useStore(sessionStore, (s) => s.currentPlannedSet);
  const session = useStore(sessionStore, (s) => s.session);

  // Quick config state
  const [effortEnabled, setEffortEnabled] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>('reps');
  const [targetReps, setTargetReps] = useState(0);
  const [rirTarget, setRirTarget] = useState(0);
  const [tempoEnabled, setTempoEnabled] = useState(false);
  const [targetTempo, setTargetTempo] = useState<TempoTarget>({
    concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerProgress = useSharedValue(0);

  const modeName = TrainingModeNames[mode] ?? 'Unknown';
  const isRecording = uiState === 'recording';
  const isActive = isRecording || uiState === 'preparing' || uiState === 'countdown';

  const isReps = targetMode === 'reps';
  const mainValue = isReps ? targetReps : rirTarget;
  const mainMax = isReps ? 30 : 5;

  const plannedSetCount = session?.plan.sets.length ?? 0;

  const targetRepsForDisplay = currentPlannedSet?.targetReps ?? null;

  // Expected set duration for chart x-axis pre-stub
  const expectedSetDurationMs = useMemo(() => {
    const tempo = currentPlannedSet?.targetTempo ?? (tempoEnabled ? targetTempo : null);
    const reps = targetRepsForDisplay ?? (effortEnabled && isReps ? targetReps : 10);
    if (tempo && (tempo.concentric > 0 || tempo.eccentric > 0)) {
      const repMs = ((tempo.concentric || 2) + (tempo.pauseTop || 0.5) + (tempo.eccentric || 3) + (tempo.pauseBottom || 1)) * 1000;
      return reps * repMs;
    }
    return 30_000;
  }, [currentPlannedSet, targetRepsForDisplay, tempoEnabled, targetTempo, effortEnabled, isReps, targetReps]);

  // Effort cycling: Off → Reps → RIR → Off
  const cycleEffort = useCallback(() => {
    if (!effortEnabled) {
      setEffortEnabled(true);
      setTargetMode('reps');
    } else if (targetMode === 'reps') {
      setTargetMode('rir');
    } else {
      setEffortEnabled(false);
    }
  }, [effortEnabled, targetMode]);

  const handleTargetChange = useCallback((v: number) => {
    if (isReps) setTargetReps(v);
    else setRirTarget(v);
  }, [isReps]);

  const handleAddSet = useCallback(() => {
    // Ensure session exists
    if (!sessionStore.getState().session) {
      const exercise = createExercise({ id: 'simple-exercise', name: modeName });
      const plan = createEmptyPlan('simple-exercise');
      sessionStore.getState().startSession(exercise, plan);
      sessionStore.getState().bindRecordingStore(recordingStore);
      sessionStore.getState().bindVoltraStore(voltraStore);
    }

    // Read fresh state after potential session creation
    const currentSets = sessionStore.getState().session?.plan.sets.length ?? 0;
    const planned: PlannedSet = {
      setNumber: currentSets + 1,
      weight,
      targetReps: effortEnabled && isReps ? targetReps : 0,
      rirTarget: effortEnabled && !isReps ? rirTarget : 0,
      isWarmup: false,
      targetTempo: tempoEnabled ? targetTempo : undefined,
      restSeconds: 90,
    };

    sessionStore.getState().addPlannedSet(planned);
  }, [sessionStore, recordingStore, voltraStore, weight, effortEnabled, isReps, targetReps, rirTarget, tempoEnabled, targetTempo, modeName]);

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

  const handleStart = useCallback(async () => {
    try {
      const store = sessionStore.getState();

      // If no session or no planned sets, create one with a single set
      if (!store.session || store.session.plan.sets.length === 0) {
        const exercise = createExercise({ id: 'simple-exercise', name: modeName });
        const plan = createEmptyPlan('simple-exercise');
        store.startSession(exercise, plan);
        store.bindRecordingStore(recordingStore);
        store.bindVoltraStore(voltraStore);

        const planned: PlannedSet = {
          setNumber: 1,
          weight,
          targetReps: effortEnabled && isReps ? targetReps : 0,
          rirTarget: effortEnabled && !isReps ? rirTarget : 0,
          isWarmup: false,
          targetTempo: tempoEnabled ? targetTempo : undefined,
          restSeconds: 90,
        };
        sessionStore.getState().addPlannedSet(planned);
      }

      await sessionStore.getState().prepareFirstSet();
      sessionStore.getState().startFirstSet();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', `Failed to start: ${message}`);
    }
  }, [sessionStore, recordingStore, voltraStore, weight, effortEnabled, isReps, targetReps, rirTarget, tempoEnabled, targetTempo, modeName]);

  const handleStop = useCallback(async () => {
    await sessionStore.getState().stopSession();
  }, [sessionStore]);

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

  const handleTempoChange = useCallback((key: keyof TempoTarget, v: number) => {
    setTargetTempo((prev) => ({ ...prev, [key]: v }));
  }, []);

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
          {/* Quick config: Reps/RIR | Weight | Add Set */}
          <Surface elevation={1} className="mt-1 rounded-xl py-3 px-2">
            <QuickConfig
              effortEnabled={effortEnabled}
              targetMode={targetMode}
              targetValue={mainValue}
              maxValue={mainMax}
              onCycleEffort={cycleEffort}
              onTargetChange={handleTargetChange}
              weightSlot={
                <VerticalWeightJog
                  weight={weight}
                  onWeightChange={(w) => { voltraStore.getState().setWeight(w); }}
                  disabled={isActive}
                />
              }
              onAddSet={handleAddSet}
              setCount={plannedSetCount}
              addSetDisabled={isActive}
              disabled={isActive}
            />
            {/* Advanced settings (eccentric, chains, tempo) */}
            {(showEccentric || showChains) && (
              <View
                className="px-1 mt-2 pt-2"
                style={{
                  opacity: isActive ? 0.4 : 1,
                  borderTopWidth: 1,
                  borderTopColor: alpha('#fff', 0.06),
                  marginHorizontal: 4,
                }}
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
                  tempoEnabled={tempoEnabled}
                  targetTempo={targetTempo}
                  onToggleTempo={() => setTempoEnabled((v) => !v)}
                  onTempoChange={handleTempoChange}
                />
              </View>
            )}
          </Surface>

          {/* Unified Set Log — each set renders its own Surface card */}
          {(setLog.length > 0 || isRecording || uiState === 'resting' || plannedSetCount > 0) && (
            <SetLog
              setLog={setLog}
              activeSet={isRecording ? {
                setIndex: currentSetIndex,
                repCount,
                weight: currentPlannedSet?.weight ?? weight,
                targetReps: currentPlannedSet?.targetReps ?? null,
              } : null}
              activeChart={isRecording ? {
                samples: liveSamples,
                expectedDurationMs: expectedSetDurationMs,
              } : null}
              activeTelemetry={isRecording ? {
                rpe,
                rir,
                currentPhase,
                phaseElapsedMs,
                repPhaseDurations,
                targetTempo: currentPlannedSet?.targetTempo,
                liveMessage: liveMessage || undefined,
              } : null}
              plannedSets={isRecording
                ? (session?.plan.sets.slice(currentSetIndex + 1) ?? [])
                : (session?.plan.sets.slice(session.completedSets.length) ?? [])
              }
              totalSets={session?.plan.sets.length ?? null}
              isResting={uiState === 'resting'}
              restElapsedMs={restElapsedMs}
              defaultRestSeconds={session?.plan.defaultRestSeconds}
            />
          )}
        </View>
      </ScrollView>

      {/* Pinned start/stop */}
      <View
        className="px-4 pb-4 pt-3"
        style={{
          borderTopWidth: 1,
          borderTopColor: alpha('#fff', 0.04),
          ...Platform.select({
            web: {
              boxShadow: `0 -4px 12px ${alpha('#000', 0.3)}`,
            } as any,
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 8,
            },
          }),
        }}
      >
        <WorkoutControls
          isActive={uiState === 'recording' || uiState === 'countdown'}
          onStart={handleStart}
          onStop={handleStop}
        />
      </View>
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
      <View
        style={{
          zIndex: 11,
          backgroundColor: '#1a1a1a',
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
