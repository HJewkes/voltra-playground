/**
 * Recording Store
 *
 * Manages state and analytics for a single recording session (set).
 * Processes WorkoutSamples through @voltras/workout-analytics pipeline.
 *
 * Responsibilities:
 * - Receive hardware-agnostic WorkoutSamples
 * - Feed samples to library's addSampleToSet (handles rep detection + aggregation)
 * - Compute live metrics via library functions
 * - Build CompletedSet when recording stops
 */

import { createStore, useStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

// Library imports
import {
  type Set as AnalyticsSet,
  type WorkoutSample,
  createSet,
  addSampleToSet,
  completeSet,
  getSetVelocityLossPct,
  getSetRepVelocities,
  estimateSetRIR,
  getRepPeakVelocity,
} from '@voltras/workout-analytics';

// App imports
import { type CompletedSet, createCompletedSet } from '@/domain/workout';
import { getLiveEffortMessage } from '@/domain/workout';
import { isDebugTelemetryEnabled } from '@/data/provider';

// =============================================================================
// Types
// =============================================================================

/**
 * Generic UI state for recording components.
 */
export type RecordingUIState =
  | 'idle' // Not recording, ready to start
  | 'countdown' // About to start (3-2-1)
  | 'recording' // Actively recording reps
  | 'resting'; // Rest period between sets

export interface RecordingState {
  // UI state for display components
  uiState: RecordingUIState;

  // Recording context
  isRecording: boolean;
  exerciseId: string | null;
  exerciseName: string;
  weight: number;
  startTime: number | null;

  // Rep data (from library's Set)
  repCount: number;
  lastRepPeakVelocity: number | null;

  // Live metrics (computed from library functions)
  velocityLoss: number;
  rpe: number;
  rir: number;
  velocityTrend: number[];

  // UI feedback
  liveMessage: string;

  // Debug telemetry - all samples for replay (only populated when debug enabled)
  allSamples: WorkoutSample[];

  // Post-recording - CompletedSet for UI to display summary
  lastSet: CompletedSet | null;

  // Actions
  setUIState: (state: RecordingUIState) => void;
  startRecording: (exerciseId?: string, exerciseName?: string) => void;
  stopRecording: (weight: number) => CompletedSet | null;
  processSample: (sample: WorkoutSample) => void;
  reset: () => void;

  // Internal - library set (not for UI consumption)
  _analyticsSet: AnalyticsSet;
}

// =============================================================================
// Initial State
// =============================================================================

function createInitialState(): Pick<
  RecordingState,
  | 'uiState'
  | 'isRecording'
  | 'exerciseId'
  | 'exerciseName'
  | 'weight'
  | 'startTime'
  | 'repCount'
  | 'lastRepPeakVelocity'
  | 'velocityLoss'
  | 'rpe'
  | 'rir'
  | 'velocityTrend'
  | 'liveMessage'
  | 'allSamples'
  | 'lastSet'
> {
  return {
    uiState: 'idle',
    isRecording: false,
    exerciseId: null,
    exerciseName: 'Workout',
    weight: 0,
    startTime: null,
    repCount: 0,
    lastRepPeakVelocity: null,
    velocityLoss: 0,
    rpe: 5,
    rir: 6,
    velocityTrend: [],
    liveMessage: '',
    allSamples: [],
    lastSet: null,
  };
}

// =============================================================================
// Singleton Store
// =============================================================================

let analyticsSet = createSet();

export const recordingStore: RecordingStoreApi = createStore<RecordingState>()(
  devtools(
    (set, get) => ({
      ...createInitialState(),
      _analyticsSet: createSet(),

      setUIState: (uiState: RecordingUIState) => {
        set({ uiState });
      },

      startRecording: (exerciseId?: string, exerciseName?: string) => {
        analyticsSet = createSet();
        set({
          ...createInitialState(),
          uiState: 'recording',
          isRecording: true,
          exerciseId: exerciseId ?? null,
          exerciseName: exerciseName ?? 'Workout',
          startTime: Date.now(),
          _analyticsSet: analyticsSet,
        });
      },

      stopRecording: (weight: number) => {
        return stopRecordingAction(get, set, weight);
      },

      processSample: (sample: WorkoutSample) => {
        processSampleAction(get, set, sample);
      },

      reset: () => {
        analyticsSet = createSet();
        set({ ...createInitialState(), _analyticsSet: analyticsSet });
      },
    }),
    { name: 'recording-store' }
  )
);

// =============================================================================
// Actions (extracted to stay under ~30 lines each)
// =============================================================================

function stopRecordingAction(
  get: () => RecordingState,
  set: (state: Partial<RecordingState>) => void,
  weight: number
): CompletedSet | null {
  const state = get();
  if (!state.isRecording || analyticsSet.reps.length === 0) {
    set({ uiState: 'idle', isRecording: false });
    return null;
  }

  const finalSet = completeSet(analyticsSet);
  const endTime = Date.now();
  const startTime = state.startTime ?? endTime;

  const completedSet = createCompletedSet(finalSet, {
    exerciseId: state.exerciseId ?? 'unknown',
    exerciseName: state.exerciseName,
    weight,
    startTime,
    endTime,
  });

  set({ uiState: 'idle', isRecording: false, lastSet: completedSet });
  return completedSet;
}

function processSampleAction(
  get: () => RecordingState,
  set: (state: Partial<RecordingState>) => void,
  sample: WorkoutSample
): void {
  if (!get().isRecording) return;

  if (isDebugTelemetryEnabled()) {
    set({ allSamples: [...get().allSamples, sample] });
  }

  const prevRepCount = analyticsSet.reps.length;
  analyticsSet = addSampleToSet(analyticsSet, sample);
  const newRepCount = analyticsSet.reps.length;

  if (newRepCount > prevRepCount) {
    updateMetricsAfterNewRep(set, newRepCount);
  }
}

function updateMetricsAfterNewRep(
  set: (state: Partial<RecordingState>) => void,
  newRepCount: number
): void {
  const lastRep = analyticsSet.reps.at(-1)!;
  const velocityLoss = getSetVelocityLossPct(analyticsSet);
  const rirEstimate = estimateSetRIR(analyticsSet);
  const velocityTrend = [...getSetRepVelocities(analyticsSet)];

  set({
    repCount: newRepCount,
    lastRepPeakVelocity: getRepPeakVelocity(lastRep),
    velocityLoss: Math.abs(velocityLoss),
    rpe: rirEstimate.rpe,
    rir: rirEstimate.rir,
    velocityTrend,
    liveMessage: getLiveEffortMessage(rirEstimate.rpe, newRepCount),
    _analyticsSet: analyticsSet,
  });
}

// =============================================================================
// Typed Hook
// =============================================================================

export function useRecordingStore<T>(selector: (state: RecordingState) => T): T {
  return useStore(recordingStore, selector);
}

// =============================================================================
// Types
// =============================================================================

export type RecordingStoreApi = StoreApi<RecordingState>;
