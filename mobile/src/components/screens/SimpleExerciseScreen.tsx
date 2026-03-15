/**
 * SimpleExerciseScreen
 *
 * Thin orchestrator wiring sub-components and hooks for the training view.
 * Session orchestration is delegated to exercise-session-store.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';

import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { WorkoutControls } from '@/components/recording';
import { ExercisePickerModal } from '@/components/exercise';
import type { VoltraStoreApi } from '@/stores/voltra-store';
import { generateMockRepPlan } from './mock-rep-plan';
import { registerCoachConsole } from '@/utils/coach-console';

import {
  ModeDrawer, MODE_META, PlanLoader, ConfigSection,
  ExerciseBreadcrumbs, NextExerciseButton, WorkoutView,
  useExerciseStores, useExerciseLifecycle,
} from './exercise';

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
  const { recordingStore, sessionStore, device, recording, session: sess } = useExerciseStores(voltraStore);
  const { mode, setMode, weight: deviceWeight, eccentric, setEccentric, chains, inverseChains, setChains, setInverseChains } = device;

  const weight = deviceWeight || 45;
  useEffect(() => {
    if (deviceWeight === 0) voltraStore.getState().setWeight(45);
  }, [deviceWeight, voltraStore]);

  const modeName = TrainingModeNames[mode] ?? 'Unknown';
  const isRecording = sess.uiState === 'recording';
  const isActive = isRecording || sess.uiState === 'preparing' || sess.uiState === 'countdown';
  const plannedSetCount = sess.session?.plan.sets.length ?? 0;

  const lifecycle = useExerciseLifecycle(voltraStore, recordingStore, sessionStore, modeName, mode, setMode, weight);
  const { configRef, completedExercises, pickerVisible, setPickerVisible, workoutPlan, planExerciseIndex, currentPlanExercise, hasMorePlanExercises, handlePlanLoaded, handleNextExercise, handlePlanNextExercise, handleAddSet, handleStart, handleStop } = lifecycle;

  useEffect(() => { registerCoachConsole(recordingStore, sessionStore); }, [recordingStore, sessionStore]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerProgress = useSharedValue(0);

  const toggleDrawer = useCallback(() => {
    if (isRecording) return;
    setDrawerOpen((prev) => {
      drawerProgress.value = withSpring(!prev ? 1 : 0, { damping: 20, stiffness: 200 });
      return !prev;
    });
  }, [isRecording, drawerProgress]);

  const handleSelectMode = useCallback((m: TrainingMode) => {
    setMode(m);
    setDrawerOpen(false);
    drawerProgress.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, [setMode, drawerProgress]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drawerProgress.value * 180}deg` }],
  }));

  useEffect(() => {
    if (!isRecording) return;
    return voltraStore.subscribe((state, prevState) => {
      if (state.currentSample && state.currentSample !== prevState.currentSample)
        recordingStore.getState().processSample(state.currentSample);
    });
  }, [voltraStore, recordingStore, isRecording]);

  useEffect(() => {
    if (sess.uiState !== 'recording') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window === 'undefined' || !(window as any).__mockBLE) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mock = (window as any).__mockBLE as { setRepPlan?: (r: ReturnType<typeof generateMockRepPlan>) => void };
    const plan = sessionStore.getState().session?.plan;
    if (plan && mock.setRepPlan) mock.setRepPlan(generateMockRepPlan(plan));
  }, [sess.uiState, sessionStore]);

  const nextExerciseName = hasMorePlanExercises ? workoutPlan!.exercises[planExerciseIndex + 1].exerciseName : null;

  return (
    <SafeAreaView className="flex-1 bg-surface-400" edges={['top']}>
      <Pressable onPress={toggleDrawer} style={{ opacity: isRecording ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel={`${modeName} — tap to switch mode`}>
        <View className="flex-row items-center justify-center px-4 pt-2 pb-1 gap-2">
          <Ionicons name={MODE_META[mode]?.icon ?? 'barbell-outline'} size={18} color={t['brand-primary']} />
          <Text className="text-base font-bold text-text-primary">{modeName}</Text>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color={t['text-tertiary']} />
          </Animated.View>
        </View>
      </Pressable>

      {drawerOpen && <ModeDrawer currentMode={mode} onSelect={handleSelectMode} onClose={toggleDrawer} />}
      <ExerciseBreadcrumbs completedExercises={completedExercises} currentExerciseName={sess.session?.exercise.name ?? modeName} />
      <PlanLoader workoutPlan={workoutPlan} planExerciseIndex={planExerciseIndex} currentPlanExercise={currentPlanExercise} isActive={isActive} uiState={sess.uiState} onPlanLoaded={handlePlanLoaded} />

      <ScrollView className="flex-1" scrollEnabled={!isRecording}>
        <View className="px-4 pb-4">
          <ConfigSection ref={configRef} voltraStore={voltraStore} weight={weight} eccentric={eccentric} setEccentric={setEccentric} chains={chains} inverseChains={inverseChains} setChains={setChains} setInverseChains={setInverseChains} showEccentric={mode === TrainingMode.WeightTraining || mode === TrainingMode.ResistanceBand} showChains={mode === TrainingMode.WeightTraining} isActive={isActive} onAddSet={handleAddSet} plannedSetCount={plannedSetCount} />
          <WorkoutView
            configRef={configRef} setLog={sess.setLog} isActive={isActive} isRecording={isRecording}
            uiState={sess.uiState} plannedSetCount={plannedSetCount} currentSetIndex={sess.currentSetIndex}
            repCount={recording.repCount} weight={weight} currentPlannedSet={sess.currentPlannedSet}
            liveSamples={recording.liveSamples} rpe={recording.rpe} rir={recording.rir}
            currentPhase={recording.currentPhase} phaseElapsedMs={recording.phaseElapsedMs}
            repPhaseDurations={recording.repPhaseDurations} liveMessage={recording.liveMessage}
            meanVelocity={recording.meanVelocity} velocityLoss={recording.velocityLoss}
            plannedSets={isActive ? (sess.session?.plan.sets.slice(sess.currentSetIndex + 1) ?? []) : (sess.session?.plan.sets.slice(sess.session?.completedSets.length ?? 0) ?? [])}
            totalSets={sess.session?.plan.sets.length ?? null}
            exerciseSetupNotes={sess.session?.exercise.equipmentSetup?.notes}
            restElapsedMs={sess.restElapsedMs} defaultRestSeconds={sess.session?.plan.defaultRestSeconds}
            onPlannedRestChange={(setIdx, secs) => sessionStore.getState().updatePlannedSetRest(setIdx, secs)}
          />
        </View>
      </ScrollView>

      <View className="px-4 pb-4 pt-3" style={{ borderTopWidth: 1, borderTopColor: alpha('#fff', 0.04), ...Platform.select({ web: webStyle({ boxShadow: `0 -4px 12px ${alpha('#000', 0.3)}` }), default: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 } }) }}>
        {sess.uiState === 'results' ? (
          <NextExerciseButton nextExerciseName={nextExerciseName} onPress={workoutPlan ? handlePlanNextExercise : () => setPickerVisible(true)} />
        ) : (
          <WorkoutControls isActive={sess.uiState === 'recording' || sess.uiState === 'countdown'} onStart={handleStart} onStop={handleStop} />
        )}
      </View>

      <ExercisePickerModal visible={pickerVisible} onSelect={handleNextExercise} onClose={() => setPickerVisible(false)} />
    </SafeAreaView>
  );
}
