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
  isInEccentricPhase,
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
  meanVelocity: number;
  velocityLoss: number;
  rpe: number;
  rir: number;
  velocityTrend: number[];

  // Tempo tracking — live phase timing for current rep
  currentPhase: MovementPhase;
  phaseStartTime: number;
  phaseElapsedMs: number;
  /** Completed phase durations (ms) for the current rep, in order */
  repPhaseDurations: { phase: MovementPhase; durationMs: number }[];

  // UI feedback
  liveMessage: string;

  // Live samples for chart visualization (rolling window, always populated during recording)
  liveSamples: WorkoutSample[];

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
// Smoothing
// =============================================================================

/** EMA smoothing factor — lower = smoother, higher = more responsive */
const EMA_ALPHA = 0.35;

function ema(prev: number, next: number, alpha = EMA_ALPHA): number {
  return prev + alpha * (next - prev);
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
  | 'meanVelocity'
  | 'velocityTrend'
  | 'currentPhase'
  | 'phaseStartTime'
  | 'phaseElapsedMs'
  | 'repPhaseDurations'
  | 'liveMessage'
  | 'liveSamples'
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
    meanVelocity: 0,
    velocityLoss: 0,
    rpe: 0,
    rir: 0,
    velocityTrend: [],
    currentPhase: MovementPhase.IDLE,
    phaseStartTime: 0,
    phaseElapsedMs: 0,
    repPhaseDurations: [],
    liveMessage: '',
    liveSamples: [],
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
  let lastEagerRepCount = 0;

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
          lastEagerRepCount = 0;
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

          // Accumulate live samples for full-set chart visualization
          set({ liveSamples: [...get().liveSamples, sample] });

          // Accumulate samples if debug telemetry is enabled
          if (isDebugTelemetryEnabled()) {
            const currentSamples = get().allSamples;
            set({ allSamples: [...currentSamples, sample] });
          }

          // --- Tempo tracking: phase transitions and timing ---
          const state = get();
          const now = sample.timestamp;
          const tempoUpdate: Partial<RecordingState> = {
            currentPhase: sample.phase,
            phaseElapsedMs: state.phaseStartTime > 0 ? now - state.phaseStartTime : 0,
          };

          if (sample.phase !== state.currentPhase) {
            // Phase changed — record duration of the previous phase
            const prevDuration = state.phaseStartTime > 0 ? now - state.phaseStartTime : 0;
            tempoUpdate.phaseStartTime = now;
            tempoUpdate.phaseElapsedMs = 0;

            if (state.currentPhase !== MovementPhase.IDLE && prevDuration > 0) {
              tempoUpdate.repPhaseDurations = [
                ...state.repPhaseDurations,
                { phase: state.currentPhase, durationMs: prevDuration },
              ];
            }

            // New rep starting (transition into concentric from idle/eccentric)
            if (sample.phase === MovementPhase.CONCENTRIC && state.currentPhase !== MovementPhase.HOLD) {
              tempoUpdate.repPhaseDurations = [];
            }
          }

          // Feed sample through library pipeline
          const prevRepCount = analyticsSet.reps.length;
          analyticsSet = addSampleToSet(analyticsSet, sample);
          const newRepCount = analyticsSet.reps.length;

          // Determine how many reps to report as complete.
          // The library only creates a new rep on eccentric→concentric transition,
          // so during idle after the last eccentric the count lags by 1.
          // We eagerly count the last rep as complete when it has an eccentric
          // phase and we're now in idle — avoiding the N-1 display lag.
          let completedCount: number;
          let metricsReps: readonly Rep[];

          if (newRepCount > prevRepCount && newRepCount >= 2) {
            // Library boundary: new rep just started, previous rep is definitively complete.
            // Use all reps except the new partial one for metrics.
            completedCount = newRepCount - 1;
            metricsReps = analyticsSet.reps.slice(0, -1);
            // Reset eager flag — the new partial rep hasn't been counted yet
            lastEagerRepCount = completedCount;
          } else if (
            newRepCount >= 1 &&
            sample.phase === MovementPhase.IDLE &&
            isInEccentricPhase(analyticsSet.reps.at(-1)!) &&
            newRepCount > lastEagerRepCount
          ) {
            // Eager boundary: last rep has eccentric data and we just entered idle.
            // Count it as complete for display purposes.
            completedCount = newRepCount;
            metricsReps = analyticsSet.reps;
            lastEagerRepCount = completedCount;
          } else {
            completedCount = 0; // No update this sample
            metricsReps = [];
          }

          if (completedCount > 0 && completedCount > state.repCount) {
            const lastCompletedRep = metricsReps.at(-1)!;
            const metricsSet = { reps: metricsReps };
            const rawVelLoss = Math.abs(getSetVelocityLossPct(metricsSet));
            const rawMeanVel = getSetMeanVelocity(metricsSet);
            const rirEstimate = estimateSetRIR(metricsSet);
            const velocityTrend = [...getSetRepVelocities(metricsSet)];

            const isFirst = completedCount === 1;
            const smoothRpe = isFirst ? rirEstimate.rpe : ema(state.rpe, rirEstimate.rpe);
            const smoothRir = isFirst ? rirEstimate.rir : ema(state.rir, rirEstimate.rir);
            const smoothVelLoss = isFirst ? rawVelLoss : ema(state.velocityLoss, rawVelLoss);
            const smoothMeanVel = isFirst ? rawMeanVel : ema(state.meanVelocity, rawMeanVel);

            Object.assign(tempoUpdate, {
              repCount: completedCount,
              lastRepPeakVelocity: getRepPeakVelocity(lastCompletedRep),
              meanVelocity: smoothMeanVel,
              velocityLoss: smoothVelLoss,
              rpe: smoothRpe,
              rir: smoothRir,
              velocityTrend,
              liveMessage: getLiveEffortMessage(smoothRpe, completedCount),
              _analyticsSet: analyticsSet,
            });
          }

          set(tempoUpdate as Partial<RecordingState>);
        },

        reset: () => {
          analyticsSet = createSet();
          lastEagerRepCount = 0;
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
