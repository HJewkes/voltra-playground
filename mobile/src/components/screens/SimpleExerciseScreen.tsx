/**
 * SimpleExerciseScreen
 *
 * Thin orchestrator wiring sub-components and hooks for the training view.
 * Session orchestration is delegated to exercise-session-store.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors, alpha } from '@titan-design/react-ui';
import { webStyle } from '@/utils/web-style';

import { TrainingMode, TrainingModeNames } from '@/domain/device';
import { useConnectionStore, selectIsConnected } from '@/stores';
import { WorkoutControls, ReadinessIndicator } from '@/components/recording';
import { ExercisePickerModal, ProgressionCard, LastSessionBanner, SuggestionCard } from '@/components/exercise';
import type { VoltraStoreApi } from '@/stores/voltra-store';
import { generateMockRepPlan } from './mock-rep-plan';
import { registerCoachConsole } from '@/utils/coach-console';
import { useExerciseProgression } from '@/hooks/use-exercise-progression';
import { getSessionRepository } from '@/data/provider';
import { assessReadiness } from '@/domain/workout';
import type { ReadinessAssessment } from '@/domain/workout';

import { buildRepeatLastSessionPlan } from '@/domain/history/services/progression-service';
import { suggestNextExercise } from '@/domain/history/services/workout-suggestion-service';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { EXERCISE_CATALOG, createExercise } from '@/domain/exercise';

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
    if (!isConnected) router.replace('/' as never);
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

  // Progression + last session banner for the current exercise
  const exerciseId = sess.session?.exercise.id ?? '';
  const sessionRepo = useMemo(() => getSessionRepository(), []);
  const { progression, lastSession } = useExerciseProgression(exerciseId, sessionRepo);

  // Readiness assessment: computed after the first set completes, before working sets
  const [readiness, setReadiness] = useState<ReadinessAssessment | null>(null);

  useEffect(() => {
    // Only assess on first rest after first set
    if (sess.uiState !== 'resting' || sess.setLog.length !== 1 || !exerciseId) return;

    const firstEntry = sess.setLog[0];
    if (!firstEntry || firstEntry.set.data.reps.length === 0) return;

    void sessionRepo.getByExercise(exerciseId).then((sessions) => {
      const dataPoints = sessions
        .filter((s) => s.status === 'completed')
        .flatMap((s) => s.completedSets.map((cs) => ({
          weight: cs.weight,
          velocity: cs.meanVelocity,
          timestamp: cs.startTime,
        })))
        .filter((dp) => dp.velocity > 0);

      if (dataPoints.length === 0) return;

      const baseline = { exerciseId, dataPoints, lastUpdated: Date.now() };
      const result = assessReadiness(firstEntry.set, baseline);
      setReadiness(result);
    });
  // setLog.length and uiState are the reactive signal; firstEntry is derived
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess.uiState, sess.setLog.length, exerciseId, sessionRepo]);

  // Clear readiness when a new exercise session begins
  useEffect(() => {
    if (sess.uiState === 'idle' || sess.uiState === 'preparing') {
      setReadiness(null);
    }
  }, [sess.uiState]);

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

  const handleRepeatLastSession = useCallback(() => {
    if (!lastSession) return;
    const exercise = EXERCISE_CATALOG[lastSession.exerciseId] ?? createExercise({ id: lastSession.exerciseId, name: lastSession.exerciseName });
    const plan = buildRepeatLastSessionPlan(lastSession);
    sessionStore.getState().startSession(exercise, plan);
    sessionStore.getState().bindRecordingStore(recordingStore);
    sessionStore.getState().bindVoltraStore(voltraStore);
    voltraStore.getState().setWeight(lastSession.weight);
    sessionStore.getState().prepareFirstSet();
  }, [lastSession, sessionStore, recordingStore, voltraStore]);

  // Workout suggestions: load recent sessions when idle, compute top suggestion
  const [recentSessions, setRecentSessions] = useState<StoredExerciseSession[]>([]);
  useEffect(() => {
    if (isActive) return;
    void sessionRepo.getRecent(200).then(setRecentSessions);
  }, [sessionRepo, isActive]);

  const topSuggestion = useMemo(() => {
    if (isActive || sess.setLog.length > 0) return null;
    const suggestions = suggestNextExercise(recentSessions, EXERCISE_CATALOG, 1);
    return suggestions[0] ?? null;
  }, [isActive, sess.setLog.length, recentSessions]);

  const handleStartSuggestion = useCallback((exerciseId: string) => {
    const exercise = EXERCISE_CATALOG[exerciseId] ?? createExercise({ id: exerciseId, name: exerciseId });
    handleNextExercise(exercise);
  }, [handleNextExercise]);

  const showLastSessionBanner = !isActive && sess.setLog.length === 0 && !!lastSession;
  const isResting = sess.uiState === 'resting';

  return (
    <SafeAreaView className="flex-1 bg-surface-400" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <View className="w-8" />
        <Pressable onPress={toggleDrawer} style={{ opacity: isRecording ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel={`${modeName} — tap to switch mode`}>
          <View className="flex-row items-center gap-2">
            <Ionicons name={MODE_META[mode]?.icon ?? 'barbell-outline'} size={18} color={t['brand-primary']} />
            <Text className="text-base font-bold text-text-primary">{modeName}</Text>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={16} color={t['text-tertiary']} />
            </Animated.View>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
          <Ionicons name="cog-outline" size={22} color={t['text-secondary']} />
        </Pressable>
      </View>

      {drawerOpen && <ModeDrawer currentMode={mode} onSelect={handleSelectMode} onClose={toggleDrawer} />}
      <ExerciseBreadcrumbs completedExercises={completedExercises} currentExerciseName={sess.session?.exercise.name ?? modeName} />
      <PlanLoader workoutPlan={workoutPlan} planExerciseIndex={planExerciseIndex} currentPlanExercise={currentPlanExercise} isActive={isActive} uiState={sess.uiState} onPlanLoaded={handlePlanLoaded} />

      <ScrollView className="flex-1" scrollEnabled={!isRecording}>
        <View className="px-4 pb-4">
          {topSuggestion && !showLastSessionBanner && (
            <SuggestionCard suggestion={topSuggestion} onStart={handleStartSuggestion} />
          )}
          {showLastSessionBanner && (
            <LastSessionBanner
              exerciseName={lastSession.exerciseName}
              date={lastSession.date}
              weight={lastSession.weight}
              velocity={lastSession.velocity}
              sets={lastSession.sets}
              reps={lastSession.reps}
              onRepeat={handleRepeatLastSession}
            />
          )}
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
            autoRegulation={sess.autoRegulation}
            completedSets={sess.session?.completedSets ?? []}
          />
          {isResting && readiness && (
            <View className="mt-3">
              <ReadinessIndicator assessment={readiness} />
            </View>
          )}
          {isResting && progression && (
            <View className="mt-3">
              <ProgressionCard progression={progression} />
            </View>
          )}
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
