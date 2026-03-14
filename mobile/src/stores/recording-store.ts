/**
 * Recording Store
 *
 * Manages state and analytics for a single recording session (set).
 * Processes WorkoutSamples through @voltras/workout-analytics pipeline.
 *
 * Performance: processSample splits into hot path (ring buffer + analytics, no
 * re-render) and cold path (Zustand set(), throttled to ~4Hz max). set() only
 * fires on: phase changes, rep completions, or a 250ms throttle for metrics.
 */

import { createStore, useStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  type Set as AnalyticsSet,
  type WorkoutSample,
  type MovementPhase,
  createSet,
  addSampleToSet,
  completeSet,
  getSetVelocityLossPct,
  getSetRepVelocities,
  estimateSetRIR,
  getRepPeakVelocity,
} from '@voltras/workout-analytics';

import { type CompletedSet, createCompletedSet } from '@/domain/workout';
import { getLiveEffortMessage } from '@/domain/workout';
import { TelemetryRingBuffer } from '@/domain/workout/telemetry-ring-buffer';
import { isDebugTelemetryEnabled } from '@/data/provider';

// =============================================================================
// Types
// =============================================================================

export type RecordingUIState =
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'resting';

export interface RecordingState {
  uiState: RecordingUIState;
  isRecording: boolean;
  exerciseId: string | null;
  exerciseName: string;
  weight: number;
  startTime: number | null;
  repCount: number;
  lastRepPeakVelocity: number | null;
  velocityLoss: number;
  rpe: number;
  rir: number;
  velocityTrend: number[];
  liveMessage: string;
  allSamples: WorkoutSample[];
  lastSet: CompletedSet | null;
  setUIState: (state: RecordingUIState) => void;
  startRecording: (exerciseId?: string, exerciseName?: string) => void;
  stopRecording: (weight: number) => CompletedSet | null;
  processSample: (sample: WorkoutSample) => void;
  reset: () => void;
  _analyticsSet: AnalyticsSet;
}

// =============================================================================
// Initial State
// =============================================================================

function createInitialState(): Pick<
  RecordingState,
  | 'uiState' | 'isRecording' | 'exerciseId' | 'exerciseName' | 'weight'
  | 'startTime' | 'repCount' | 'lastRepPeakVelocity' | 'velocityLoss'
  | 'rpe' | 'rir' | 'velocityTrend' | 'liveMessage' | 'allSamples' | 'lastSet'
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
// Throttle State
// =============================================================================

const THROTTLE_INTERVAL_MS = 250;

interface ThrottleState {
  analyticsSet: AnalyticsSet;
  telemetryBuffer: TelemetryRingBuffer;
  lastPhase: MovementPhase | null;
  lastFlushTime: number;
  dirty: boolean;
  debugSamples: WorkoutSample[];
  setCallCount: number;
  sampleCount: number;
}

function createThrottleState(): ThrottleState {
  return {
    analyticsSet: createSet(),
    telemetryBuffer: new TelemetryRingBuffer(),
    lastPhase: null,
    lastFlushTime: 0,
    dirty: false,
    debugSamples: [],
    setCallCount: 0,
    sampleCount: 0,
  };
}

// =============================================================================
// Store API Type
// =============================================================================

export type RecordingStoreApi = StoreApi<RecordingState> & {
  getTelemetryBuffer: () => TelemetryRingBuffer;
  _getThrottleStats: () => { setCallCount: number; sampleCount: number };
};

// =============================================================================
// Factory
// =============================================================================

export function createRecordingStore(): RecordingStoreApi {
  const ts = createThrottleState();

  const store = createStore<RecordingState>()(
    devtools(
      (set, get) => ({
        ...createInitialState(),
        _analyticsSet: createSet(),

        setUIState: (uiState: RecordingUIState) => {
          set({ uiState });
        },

        startRecording: (exerciseId?: string, exerciseName?: string) => {
          resetThrottleState(ts);
          set({
            ...createInitialState(),
            uiState: 'recording',
            isRecording: true,
            exerciseId: exerciseId ?? null,
            exerciseName: exerciseName ?? 'Workout',
            startTime: Date.now(),
            _analyticsSet: ts.analyticsSet,
          });
        },

        stopRecording: (weight: number) => {
          return stopRecordingAction(get, set, ts, weight);
        },

        processSample: (sample: WorkoutSample) => {
          processSampleAction(get, set, ts, sample);
        },

        reset: () => {
          resetThrottleState(ts);
          set({ ...createInitialState(), _analyticsSet: ts.analyticsSet });
        },
      }),
      { name: 'recording-store' },
    ),
  );

  const storeApi = store as RecordingStoreApi;
  storeApi.getTelemetryBuffer = () => ts.telemetryBuffer;
  storeApi._getThrottleStats = () => ({
    setCallCount: ts.setCallCount,
    sampleCount: ts.sampleCount,
  });

  return storeApi;
}

// =============================================================================
// Throttle Helpers
// =============================================================================

function resetThrottleState(ts: ThrottleState): void {
  ts.analyticsSet = createSet();
  ts.telemetryBuffer.clear();
  ts.lastPhase = null;
  ts.lastFlushTime = 0;
  ts.dirty = false;
  ts.debugSamples = [];
  ts.setCallCount = 0;
  ts.sampleCount = 0;
}

// =============================================================================
// Actions
// =============================================================================

function stopRecordingAction(
  get: () => RecordingState,
  set: (state: Partial<RecordingState>) => void,
  ts: ThrottleState,
  weight: number,
): CompletedSet | null {
  const state = get();
  if (!state.isRecording || ts.analyticsSet.reps.length === 0) {
    set({ uiState: 'idle', isRecording: false });
    return null;
  }

  if (ts.dirty) {
    flushThrottled(get, set, ts, Date.now());
  }

  const finalSet = completeSet(ts.analyticsSet);
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
  ts: ThrottleState,
  sample: WorkoutSample,
): void {
  if (!get().isRecording) return;

  ts.sampleCount++;

  // --- Hot path: no Zustand set(), no re-renders ---
  ts.telemetryBuffer.push(sample);

  if (isDebugTelemetryEnabled()) {
    ts.debugSamples.push(sample);
    ts.dirty = true;
  }

  const prevRepCount = ts.analyticsSet.reps.length;
  ts.analyticsSet = addSampleToSet(ts.analyticsSet, sample);
  const newRepCount = ts.analyticsSet.reps.length;

  // --- Cold path: Zustand set() only on meaningful changes ---
  const phaseChanged = ts.lastPhase !== null && sample.phase !== ts.lastPhase;
  ts.lastPhase = sample.phase;

  if (newRepCount > prevRepCount) {
    flushRepMetrics(get, set, ts, newRepCount, sample.timestamp);
    return;
  }

  if (phaseChanged) {
    flushThrottled(get, set, ts, sample.timestamp);
    return;
  }

  if (sample.timestamp - ts.lastFlushTime >= THROTTLE_INTERVAL_MS) {
    flushThrottled(get, set, ts, sample.timestamp);
  }
}

function flushRepMetrics(
  get: () => RecordingState,
  set: (state: Partial<RecordingState>) => void,
  ts: ThrottleState,
  newRepCount: number,
  timestamp: number,
): void {
  const lastRep = ts.analyticsSet.reps.at(-1)!;
  const velocityLoss = getSetVelocityLossPct(ts.analyticsSet);
  const rirEstimate = estimateSetRIR(ts.analyticsSet);
  const velocityTrend = [...getSetRepVelocities(ts.analyticsSet)];

  const update: Partial<RecordingState> = {
    repCount: newRepCount,
    lastRepPeakVelocity: getRepPeakVelocity(lastRep),
    velocityLoss: Math.abs(velocityLoss),
    rpe: rirEstimate.rpe,
    rir: rirEstimate.rir,
    velocityTrend,
    liveMessage: getLiveEffortMessage(rirEstimate.rpe, newRepCount),
    _analyticsSet: ts.analyticsSet,
  };

  if (ts.debugSamples.length > 0) {
    update.allSamples = [...get().allSamples, ...ts.debugSamples];
    ts.debugSamples = [];
  }

  ts.lastFlushTime = timestamp;
  ts.dirty = false;
  ts.setCallCount++;
  set(update);
}

function flushThrottled(
  get: () => RecordingState,
  set: (state: Partial<RecordingState>) => void,
  ts: ThrottleState,
  timestamp: number,
): void {
  const update: Partial<RecordingState> = {};

  if (ts.debugSamples.length > 0) {
    update.allSamples = [...get().allSamples, ...ts.debugSamples];
    ts.debugSamples = [];
  }

  ts.lastFlushTime = timestamp;
  ts.dirty = false;
  ts.setCallCount++;
  set(update);
}

// =============================================================================
// Singleton Store
// =============================================================================

export const recordingStore: RecordingStoreApi = createRecordingStore();

// =============================================================================
// Typed Hook
// =============================================================================

export function useRecordingStore<T>(selector: (state: RecordingState) => T): T {
  return useStore(recordingStore, selector);
}
