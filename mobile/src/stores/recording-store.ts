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

import { createStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

// Library imports
import {
  type Set as AnalyticsSet,
  type WorkoutSample,
  type Rep,
  createSet,
  addSampleToSet,
  completeSet,
  getSetVelocityLossPct,
  getSetRepVelocities,
  getSetMeanVelocity,
  estimateSetRIR,
  getRepPeakVelocity,
  MovementPhase,
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
// Store Factory
// =============================================================================

/**
 * Create a recording store for managing single-set analytics.
 */
export function createRecordingStore(): RecordingStoreApi {
  let analyticsSet = createSet();

  const store = createStore<RecordingState>()(
    devtools(
      (set, get) => ({
        ...createInitialState(),

        // Internal state
        _analyticsSet: createSet(),

        // =======================================================================
        // Actions
        // =======================================================================

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
          const state = get();
          if (!state.isRecording || analyticsSet.reps.length === 0) {
            set({ uiState: 'idle', isRecording: false });
            return null;
          }

          // Finalize the set (trim trailing idle samples)
          const finalSet = completeSet(analyticsSet);

          const endTime = Date.now();
          const startTime = state.startTime ?? endTime;

          // Build CompletedSet with app metadata
          const completedSet = createCompletedSet(finalSet, {
            exerciseId: state.exerciseId ?? 'unknown',
            exerciseName: state.exerciseName,
            weight,
            startTime,
            endTime,
          });

          set({
            uiState: 'idle',
            isRecording: false,
            lastSet: completedSet,
          });

          return completedSet;
        },

        processSample: (sample: WorkoutSample) => {
          if (!get().isRecording) return;

          // Accumulate samples if debug telemetry is enabled
          if (isDebugTelemetryEnabled()) {
            const currentSamples = get().allSamples;
            set({ allSamples: [...currentSamples, sample] });
          }

          // Feed sample through library pipeline
          const prevRepCount = analyticsSet.reps.length;
          analyticsSet = addSampleToSet(analyticsSet, sample);
          const newRepCount = analyticsSet.reps.length;

          // New rep completed - update metrics
          if (newRepCount > prevRepCount) {
            const lastRep = analyticsSet.reps.at(-1)!;

            // Compute live metrics from library
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
        },

        reset: () => {
          analyticsSet = createSet();
          set({ ...createInitialState(), _analyticsSet: analyticsSet });
        },
      }),
      { name: 'recording-store' }
    )
  );

  return store;
}

// =============================================================================
// Types
// =============================================================================

export type RecordingStoreApi = StoreApi<RecordingState>;
