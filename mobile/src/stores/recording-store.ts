/**
 * Recording Store
 *
 * Manages state and analytics for a single recording session (set).
 * Processes WorkoutSamples into Rep and SetMetrics.
 *
 * Responsibilities:
 * - Receive hardware-agnostic WorkoutSamples (converted from device frames by caller)
 * - Detect rep boundaries using workout domain's RepDetector
 * - Aggregate phases and reps using workout aggregators
 * - Compute and track SetMetrics with fatigue analysis
 * - Build domain Set when recording stops
 *
 * This store is hardware-agnostic - it only uses workout domain models.
 * The caller (e.g., WorkoutScreen) handles conversion from device-specific frames.
 */

import { createStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

// Domain imports - Workout
import {
  RepDetector,
  type RepBoundary,
  type Rep,
  type Set,
  type SetMetrics,
  type TempoTarget,
  type WorkoutSample,
  aggregatePhase,
  aggregateRep,
  aggregateSet,
  createEmptySetMetrics,
  MovementPhase,
} from '@/domain/workout';

// Training domain
import { getLiveEffortMessage } from '@/domain/workout';

// =============================================================================
// Types
// =============================================================================

/**
 * Generic UI state for recording components.
 * Used by recording UI components to show appropriate displays.
 */
export type RecordingUIState = 
  | 'idle'       // Not recording, ready to start
  | 'countdown'  // About to start (3-2-1)
  | 'recording'  // Actively recording reps
  | 'resting';   // Rest period between sets

export interface RecordingState {
  // UI state for display components
  uiState: RecordingUIState;
  
  // Recording context
  isRecording: boolean;
  exerciseId: string | null;
  exerciseName: string;
  weight: number;
  startTime: number | null;

  // Rep data (computed from frames via RepDetector + aggregators)
  reps: Rep[];
  lastRep: Rep | null;
  repCount: number;

  // Set metrics (computed from reps via set-aggregator)
  setMetrics: SetMetrics;

  // Derived analytics (for UI convenience)
  velocityLoss: number;
  rpe: number;
  rir: number;
  velocityTrend: number[];

  // UI feedback
  liveMessage: string;

  // Post-recording - domain Set for UI to display summary
  lastSet: Set | null;

  // Actions
  setUIState: (state: RecordingUIState) => void;
  startRecording: (exerciseId?: string, exerciseName?: string) => void;
  stopRecording: (weight: number) => Set | null;
  processSample: (sample: WorkoutSample) => void;
  setTargetTempo: (tempo: TempoTarget | null) => void;
  reset: () => void;

  // Internal
  _repDetector: RepDetector;
  _targetTempo: TempoTarget | null;
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
  | 'reps'
  | 'lastRep'
  | 'repCount'
  | 'setMetrics'
  | 'velocityLoss'
  | 'rpe'
  | 'rir'
  | 'velocityTrend'
  | 'liveMessage'
  | 'lastSet'
> {
  return {
    uiState: 'idle',
    isRecording: false,
    exerciseId: null,
    exerciseName: 'Workout',
    weight: 0,
    startTime: null,
    reps: [],
    lastRep: null,
    repCount: 0,
    setMetrics: createEmptySetMetrics(),
    velocityLoss: 0,
    rpe: 5,
    rir: 6,
    velocityTrend: [],
    liveMessage: '',
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
  const repDetector = new RepDetector();
  let targetTempo: TempoTarget | null = null;

  const store = createStore<RecordingState>()(
    devtools(
      (set, get) => ({
        ...createInitialState(),

        // Internal state
        _repDetector: repDetector,
        _targetTempo: null,

        // =======================================================================
        // Actions
        // =======================================================================

        setUIState: (uiState: RecordingUIState) => {
          set({ uiState });
        },

        startRecording: (exerciseId?: string, exerciseName?: string) => {
          repDetector.reset();
          set({
            ...createInitialState(),
            uiState: 'recording',
            isRecording: true,
            exerciseId: exerciseId ?? null,
            exerciseName: exerciseName ?? 'Workout',
            startTime: Date.now(),
          });
        },

        stopRecording: (weight: number) => {
          const state = get();
          if (!state.isRecording || state.reps.length === 0) {
            set({ uiState: 'idle', isRecording: false });
            return null;
          }

          const endTime = Date.now();
          const startTime = state.startTime ?? endTime;

          // Build domain Set
          const completedSet: Set = {
            id: `set-${Date.now()}`,
            exerciseId: state.exerciseId ?? 'unknown',
            exerciseName: state.exerciseName,
            weight,
            reps: state.reps,
            timestamp: {
              start: startTime,
              end: endTime,
            },
            metrics: state.setMetrics,
          };

          set({
            uiState: 'idle',
            isRecording: false,
            lastSet: completedSet,
          });

          return completedSet;
        },

        processSample: (sample: WorkoutSample) => {
          if (!get().isRecording) return;

          // Run through rep detector
          const boundary = repDetector.processSample(sample);

          if (boundary) {
            // Rep completed - aggregate and update state
            const rep = aggregateRepFromBoundary(boundary);
            const newReps = [...get().reps, rep];

            // Recompute set metrics
            const newSetMetrics = aggregateSet(newReps, targetTempo);

            // Update state
            set({
              reps: newReps,
              lastRep: rep,
              repCount: newReps.length,
              setMetrics: newSetMetrics,
              velocityLoss: Math.abs(newSetMetrics.velocity.concentricDelta),
              rpe: newSetMetrics.effort.rpe,
              rir: newSetMetrics.effort.rir,
              velocityTrend: newReps.map((r) => r.metrics.concentricMeanVelocity),
              liveMessage: getLiveEffortMessage(newSetMetrics.effort.rpe, newReps.length),
            });
          }
        },

        setTargetTempo: (tempo: TempoTarget | null) => {
          targetTempo = tempo;
          set({ _targetTempo: tempo });
        },

        reset: () => {
          repDetector.reset();
          set(createInitialState());
        },
      }),
      { name: 'recording-store' },
    ),
  );

  return store;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Aggregate a rep from a RepBoundary (detected by RepDetector).
 */
function aggregateRepFromBoundary(boundary: RepBoundary): Rep {
  const { phaseSamples, repNumber } = boundary;

  // Aggregate phases
  const concentricPhase = aggregatePhase(
    MovementPhase.CONCENTRIC,
    phaseSamples.concentric,
  );
  const eccentricPhase = aggregatePhase(
    MovementPhase.ECCENTRIC,
    phaseSamples.eccentric,
  );
  const holdAtTopPhase =
    phaseSamples.holdAtTop.length > 0
      ? aggregatePhase(MovementPhase.HOLD, phaseSamples.holdAtTop)
      : null;
  const holdAtBottomPhase =
    phaseSamples.holdAtBottom.length > 0
      ? aggregatePhase(MovementPhase.HOLD, phaseSamples.holdAtBottom)
      : null;

  // Aggregate rep from phases
  return aggregateRep(
    repNumber,
    concentricPhase,
    eccentricPhase,
    holdAtTopPhase,
    holdAtBottomPhase,
  );
}

// =============================================================================
// Types
// =============================================================================

export type RecordingStoreApi = StoreApi<RecordingState>;
