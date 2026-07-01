/**
 * useExerciseLifecycle — plan loading, exercise navigation, and session
 * start/stop logic extracted from the main screen component.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { StoreApi } from 'zustand';

import { TrainingMode } from '@/domain/device';
import { createEmptyPlan } from '@/domain/workout';
import type { PlannedSet, SetLogEntry } from '@/domain/workout';
import type { WorkoutPlan, WorkoutExercise } from '@/domain/workout/models/workout-plan';
import { createExercise, EXERCISE_CATALOG } from '@/domain/exercise';
import type { Exercise } from '@/domain/exercise';
import type { VoltraStoreApi } from '@/stores/voltra-store';
import { usePlanDeliveryStore } from '@/stores/plan-delivery-store';
import type { ConfigSectionRef, QuickConfigTargets } from './ConfigSection';

function workoutSetsToPlannedSets(exercise: WorkoutExercise): PlannedSet[] {
  return exercise.sets.map((s, i) => ({
    setNumber: i + 1,
    weight: s.weight ?? 0,
    targetReps: s.reps,
    rirTarget: s.rirTarget ?? 0,
    isWarmup: s.type === 'warmup',
    targetTempo: s.tempoTarget
      ? { concentric: s.tempoTarget.concentric, eccentric: s.tempoTarget.eccentric, pauseTop: s.tempoTarget.pauseTop, pauseBottom: s.tempoTarget.pauseBottom }
      : undefined,
    restSeconds: 90,
  }));
}

function resolveExercise(we: WorkoutExercise): Exercise {
  const catalogEntry = EXERCISE_CATALOG[we.exerciseId];
  return catalogEntry ?? createExercise({ id: we.exerciseId, name: we.exerciseName });
}

const DEFAULT_TARGETS: QuickConfigTargets = {
  effortEnabled: false, targetMode: 'reps',
  targetReps: 0, rirTarget: 0, tempoEnabled: false,
  targetTempo: { concentric: 0, eccentric: 0, pauseTop: 0, pauseBottom: 0 },
};

export function useExerciseLifecycle(
  voltraStore: VoltraStoreApi,
  recordingStore: StoreApi<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  sessionStore: StoreApi<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  modeName: string,
  mode: number,
  setMode: (m: number) => void,
  weight: number,
) {
  const configRef = useRef<ConfigSectionRef>(null);
  const [completedExercises, setCompletedExercises] = useState<{ name: string; setCount: number; setLog: SetLogEntry[] }[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [planExerciseIndex, setPlanExerciseIndex] = useState(0);

  const loadPlanExercise = useCallback((plan: WorkoutPlan, idx: number) => {
    const we = plan.exercises[idx];
    if (!we) return;
    const exercise = resolveExercise(we);
    const plannedSets = workoutSetsToPlannedSets(we);
    sessionStore.getState().startSession(exercise, { ...createEmptyPlan(exercise.id), sets: plannedSets });
    sessionStore.getState().bindRecordingStore(recordingStore);
    sessionStore.getState().bindVoltraStore(voltraStore);
    const firstWeight = plannedSets[0]?.weight;
    if (firstWeight && firstWeight > 0) voltraStore.getState().setWeight(firstWeight);
  }, [sessionStore, recordingStore, voltraStore]);

  const handlePlanLoaded = useCallback((plan: WorkoutPlan) => {
    setWorkoutPlan(plan);
    setPlanExerciseIndex(0);
    setCompletedExercises([]);
    loadPlanExercise(plan, 0);
  }, [loadPlanExercise]);

  // Consume a plan delivered from outside the screen (coaching channel, upload,
  // deep link) via receiveWorkoutPlan → planDeliveryStore.
  const pendingPlan = usePlanDeliveryStore((s) => s.pendingPlan);
  const consumePendingPlan = usePlanDeliveryStore((s) => s.consumePendingPlan);
  useEffect(() => {
    if (!pendingPlan) return;
    handlePlanLoaded(pendingPlan);
    consumePendingPlan();
  }, [pendingPlan, handlePlanLoaded, consumePendingPlan]);

  const archiveCurrentExercise = useCallback(() => {
    const cur = sessionStore.getState();
    const name = cur.session?.exercise.name ?? modeName;
    const count = cur.session?.completedSets.length ?? cur.setLog.length;
    setCompletedExercises((prev) => [...prev, { name, setCount: count, setLog: [...cur.setLog] }]);
  }, [sessionStore, modeName]);

  const handleNextExercise = useCallback((exercise: Exercise) => {
    archiveCurrentExercise();
    sessionStore.getState().startSession(exercise, createEmptyPlan(exercise.id));
    sessionStore.getState().bindRecordingStore(recordingStore);
    sessionStore.getState().bindVoltraStore(voltraStore);
    if (exercise.equipmentSetup?.cablePath) {
      const cableMode = exercise.movementPattern === 'pull' ? TrainingMode.WeightTraining : mode;
      if (cableMode !== mode) setMode(cableMode);
    }
    setPickerVisible(false);
  }, [archiveCurrentExercise, sessionStore, recordingStore, voltraStore, mode, setMode]);

  const handlePlanNextExercise = useCallback(() => {
    archiveCurrentExercise();
    if (workoutPlan && planExerciseIndex < workoutPlan.exercises.length - 1) {
      const nextIdx = planExerciseIndex + 1;
      setPlanExerciseIndex(nextIdx);
      loadPlanExercise(workoutPlan, nextIdx);
    } else {
      setPickerVisible(true);
    }
  }, [archiveCurrentExercise, workoutPlan, planExerciseIndex, loadPlanExercise]);

  const buildPlannedSet = useCallback((targets: QuickConfigTargets, setNumber: number): PlannedSet => {
    const isReps = targets.targetMode === 'reps';
    return {
      setNumber, weight,
      targetReps: targets.effortEnabled && isReps ? targets.targetReps : 0,
      rirTarget: targets.effortEnabled && !isReps ? targets.rirTarget : 0,
      isWarmup: false,
      targetTempo: targets.tempoEnabled ? targets.targetTempo : undefined,
      restSeconds: 90,
    };
  }, [weight]);

  const ensureSession = useCallback(() => {
    if (!sessionStore.getState().session) {
      sessionStore.getState().startSession(createExercise({ id: 'simple-exercise', name: modeName }), createEmptyPlan('simple-exercise'));
      sessionStore.getState().bindRecordingStore(recordingStore);
      sessionStore.getState().bindVoltraStore(voltraStore);
    }
  }, [sessionStore, recordingStore, voltraStore, modeName]);

  const handleAddSet = useCallback((targets: QuickConfigTargets) => {
    ensureSession();
    const currentSets = sessionStore.getState().session?.plan.sets.length ?? 0;
    sessionStore.getState().addPlannedSet(buildPlannedSet(targets, currentSets + 1));
  }, [ensureSession, sessionStore, buildPlannedSet]);

  const handleStart = useCallback(async () => {
    try {
      // Ensure device mode matches UI selection before starting
      const deviceMode = voltraStore.getState().mode;
      if (deviceMode !== mode) {
        await voltraStore.getState().setMode(mode);
      }

      const store = sessionStore.getState();
      if (!store.session || store.session.plan.sets.length === 0) {
        const targets = configRef.current?.getTargets() ?? DEFAULT_TARGETS;
        ensureSession();
        sessionStore.getState().addPlannedSet(buildPlannedSet(targets, 1));
      }
      await sessionStore.getState().prepareFirstSet();
      sessionStore.getState().startFirstSet();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', `Failed to start: ${message}`);
    }
  }, [voltraStore, mode, sessionStore, ensureSession, buildPlannedSet]);

  const handleStop = useCallback(async () => { await sessionStore.getState().stopSession(); }, [sessionStore]);

  return {
    configRef,
    completedExercises,
    pickerVisible, setPickerVisible,
    workoutPlan, planExerciseIndex,
    currentPlanExercise: workoutPlan?.exercises[planExerciseIndex] ?? null,
    hasMorePlanExercises: workoutPlan !== null && planExerciseIndex < workoutPlan.exercises.length - 1,
    handlePlanLoaded, handleNextExercise, handlePlanNextExercise,
    handleAddSet, handleStart, handleStop,
  };
}
