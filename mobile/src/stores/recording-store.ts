/**
 * Recording Store
 *
 * Manages state and analytics for a single recording session (set).
 * Processes WorkoutSamples through @voltras/workout-analytics pipeline.
 */
import { createStore, useStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type Set as AnalyticsSet, type WorkoutSample, type MovementPhase, MovementPhase as MovementPhaseEnum, createSet, addSampleToSet, completeSet, getSetVelocityLossPct, getSetRepVelocities, getSetMeanVelocity, estimateSetRIR, getRepPeakVelocity } from '@voltras/workout-analytics';
import { type CompletedSet, createCompletedSet } from '@/domain/workout';
import { getLiveEffortMessage } from '@/domain/workout';
import { type VelocityAutoStopConfig, type VelocityAutoStopTracker, type VelocityAutoStopResult, DEFAULT_AUTO_STOP_CONFIG, createAutoStopTracker, evaluateAutoStop } from '@/domain/workout/velocity-auto-stop';
import { TelemetryRingBuffer } from '@/domain/workout/telemetry-ring-buffer';
import { isDebugTelemetryEnabled } from '@/data/provider';

export type RecordingUIState = 'idle' | 'countdown' | 'recording' | 'resting';

export interface RecordingState {
  uiState: RecordingUIState; isRecording: boolean; exerciseId: string | null; exerciseName: string; weight: number; startTime: number | null; repCount: number; lastRepPeakVelocity: number | null; meanVelocity: number; velocityLoss: number; rpe: number; rir: number; velocityTrend: number[];
  currentPhase: MovementPhase; phaseStartTime: number; phaseElapsedMs: number; repPhaseDurations: { phase: MovementPhase; durationMs: number }[];
  liveMessage: string; liveSamples: WorkoutSample[]; allSamples: WorkoutSample[]; lastSet: CompletedSet | null;
  setUIState: (state: RecordingUIState) => void; startRecording: (exerciseId?: string, exerciseName?: string) => void; stopRecording: (weight: number) => CompletedSet | null; processSample: (sample: WorkoutSample) => void; reset: () => void; _analyticsSet: AnalyticsSet;
}

function createInitialState(): Pick<RecordingState, 'uiState' | 'isRecording' | 'exerciseId' | 'exerciseName' | 'weight' | 'startTime' | 'repCount' | 'lastRepPeakVelocity' | 'meanVelocity' | 'velocityLoss' | 'rpe' | 'rir' | 'velocityTrend' | 'currentPhase' | 'phaseStartTime' | 'phaseElapsedMs' | 'repPhaseDurations' | 'liveMessage' | 'liveSamples' | 'allSamples' | 'lastSet'> {
  return { uiState: 'idle', isRecording: false, exerciseId: null, exerciseName: 'Workout', weight: 0, startTime: null, repCount: 0, lastRepPeakVelocity: null, meanVelocity: 0, velocityLoss: 0, rpe: 5, rir: 6, velocityTrend: [], currentPhase: MovementPhaseEnum.IDLE, phaseStartTime: 0, phaseElapsedMs: 0, repPhaseDurations: [], liveMessage: '', liveSamples: [], allSamples: [], lastSet: null };
}

const THROTTLE_INTERVAL_MS = 250;

interface ThrottleState {
  analyticsSet: AnalyticsSet; telemetryBuffer: TelemetryRingBuffer; lastPhase: MovementPhase | null; lastFlushTime: number; dirty: boolean; debugSamples: WorkoutSample[]; liveSamples: WorkoutSample[]; setCallCount: number; sampleCount: number;
  autoStopTracker: VelocityAutoStopTracker; autoStopConfig: VelocityAutoStopConfig; isWarmupSet: boolean; onAutoStop: ((result: VelocityAutoStopResult) => void) | null;
}

function createThrottleState(): ThrottleState {
  return { analyticsSet: createSet(), telemetryBuffer: new TelemetryRingBuffer(), lastPhase: null, lastFlushTime: 0, dirty: false, debugSamples: [], liveSamples: [], setCallCount: 0, sampleCount: 0, autoStopTracker: createAutoStopTracker(), autoStopConfig: { ...DEFAULT_AUTO_STOP_CONFIG }, isWarmupSet: false, onAutoStop: null };
}

export type RecordingStoreApi = StoreApi<RecordingState> & {
  getTelemetryBuffer: () => TelemetryRingBuffer;
  _getThrottleStats: () => { setCallCount: number; sampleCount: number };
  setAutoStopConfig: (config: VelocityAutoStopConfig) => void;
  setIsWarmupSet: (isWarmup: boolean) => void;
  setOnAutoStop: (cb: ((result: VelocityAutoStopResult) => void) | null) => void;
};

export function createRecordingStore(): RecordingStoreApi {
  const ts = createThrottleState();
  const store = createStore<RecordingState>()(devtools((set, get) => ({
    ...createInitialState(), _analyticsSet: createSet(),
    setUIState: (uiState: RecordingUIState) => { set({ uiState }); },
    startRecording: (exerciseId?: string, exerciseName?: string) => { resetThrottleState(ts); set({ ...createInitialState(), uiState: 'recording', isRecording: true, exerciseId: exerciseId ?? null, exerciseName: exerciseName ?? 'Workout', startTime: Date.now(), _analyticsSet: ts.analyticsSet }); },
    stopRecording: (weight: number) => { return stopRecordingAction(get, set, ts, weight); },
    processSample: (sample: WorkoutSample) => { processSampleAction(get, set, ts, sample); },
    reset: () => { resetThrottleState(ts); set({ ...createInitialState(), _analyticsSet: ts.analyticsSet }); },
  }), { name: 'recording-store' }));

  const storeApi = store as unknown as RecordingStoreApi;
  storeApi.getTelemetryBuffer = () => ts.telemetryBuffer;
  storeApi._getThrottleStats = () => ({ setCallCount: ts.setCallCount, sampleCount: ts.sampleCount });
  storeApi.setAutoStopConfig = (config: VelocityAutoStopConfig) => { ts.autoStopConfig = config; };
  storeApi.setIsWarmupSet = (isWarmup: boolean) => { ts.isWarmupSet = isWarmup; };
  storeApi.setOnAutoStop = (cb) => { ts.onAutoStop = cb; };
  return storeApi;
}

function resetThrottleState(ts: ThrottleState): void { ts.analyticsSet = createSet(); ts.telemetryBuffer.clear(); ts.lastPhase = null; ts.lastFlushTime = 0; ts.dirty = false; ts.debugSamples = []; ts.liveSamples = []; ts.setCallCount = 0; ts.sampleCount = 0; ts.autoStopTracker = createAutoStopTracker(); }

function stopRecordingAction(get: () => RecordingState, set: (state: Partial<RecordingState>) => void, ts: ThrottleState, weight: number): CompletedSet | null {
  const state = get();
  if (!state.isRecording || ts.analyticsSet.reps.length === 0) { set({ uiState: 'idle', isRecording: false }); return null; }
  if (ts.dirty) { flushThrottled(get, set, ts, Date.now()); }
  const finalSet = completeSet(ts.analyticsSet); const endTime = Date.now(); const startTime = state.startTime ?? endTime;
  const completedSet = createCompletedSet(finalSet, { exerciseId: state.exerciseId ?? 'unknown', exerciseName: state.exerciseName, weight, startTime, endTime });
  set({ uiState: 'idle', isRecording: false, lastSet: completedSet }); return completedSet;
}

function processSampleAction(get: () => RecordingState, set: (state: Partial<RecordingState>) => void, ts: ThrottleState, sample: WorkoutSample): void {
  if (!get().isRecording) return;
  ts.sampleCount++; ts.telemetryBuffer.push(sample); ts.liveSamples.push(sample);
  if (isDebugTelemetryEnabled()) { ts.debugSamples.push(sample); ts.dirty = true; }
  const prevRepCount = ts.analyticsSet.reps.length; ts.analyticsSet = addSampleToSet(ts.analyticsSet, sample); const newRepCount = ts.analyticsSet.reps.length;
  const phaseChanged = ts.lastPhase !== null && sample.phase !== ts.lastPhase; ts.lastPhase = sample.phase;
  if (newRepCount > prevRepCount) { flushRepMetrics(get, set, ts, newRepCount, sample.timestamp); return; }
  if (phaseChanged) { flushPhaseChange(get, set, ts, sample); return; }
  if (sample.timestamp - ts.lastFlushTime >= THROTTLE_INTERVAL_MS) { flushThrottled(get, set, ts, sample.timestamp); }
}

function flushRepMetrics(get: () => RecordingState, set: (state: Partial<RecordingState>) => void, ts: ThrottleState, newRepCount: number, timestamp: number): void {
  const state = get(); const lastRep = ts.analyticsSet.reps.at(-1)!;
  const velocityLoss = getSetVelocityLossPct(ts.analyticsSet); const rirEstimate = estimateSetRIR(ts.analyticsSet); const velocityTrend = [...getSetRepVelocities(ts.analyticsSet)];
  const update: Partial<RecordingState> = { repCount: newRepCount, lastRepPeakVelocity: getRepPeakVelocity(lastRep), meanVelocity: getSetMeanVelocity(ts.analyticsSet), velocityLoss: Math.abs(velocityLoss), rpe: rirEstimate.rpe, rir: rirEstimate.rir, velocityTrend, liveMessage: getLiveEffortMessage(rirEstimate.rpe, newRepCount), liveSamples: [...ts.liveSamples], _analyticsSet: ts.analyticsSet, currentPhase: ts.lastPhase ?? state.currentPhase, phaseElapsedMs: 0, phaseStartTime: timestamp, repPhaseDurations: [] };
  if (state.currentPhase !== MovementPhaseEnum.IDLE && state.phaseStartTime > 0) { const prevDuration = timestamp - state.phaseStartTime; if (prevDuration > 0) { update.repPhaseDurations = []; } }
  if (ts.debugSamples.length > 0) { update.allSamples = [...state.allSamples, ...ts.debugSamples]; ts.debugSamples = []; }
  ts.lastFlushTime = timestamp; ts.dirty = false; ts.setCallCount++; set(update);
  if (ts.onAutoStop && ts.autoStopConfig.enabled) { const result = evaluateAutoStop(ts.analyticsSet, ts.autoStopTracker, ts.autoStopConfig, ts.isWarmupSet); if (result.shouldStop) { ts.onAutoStop(result); } }
}

function flushThrottled(get: () => RecordingState, set: (state: Partial<RecordingState>) => void, ts: ThrottleState, timestamp: number): void {
  const state = get(); const update: Partial<RecordingState> = { liveSamples: [...ts.liveSamples] };
  if (state.phaseStartTime > 0) { update.phaseElapsedMs = timestamp - state.phaseStartTime; }
  if (ts.debugSamples.length > 0) { update.allSamples = [...state.allSamples, ...ts.debugSamples]; ts.debugSamples = []; }
  ts.lastFlushTime = timestamp; ts.dirty = false; ts.setCallCount++; set(update);
}

function flushPhaseChange(get: () => RecordingState, set: (state: Partial<RecordingState>) => void, ts: ThrottleState, sample: WorkoutSample): void {
  const state = get(); const now = sample.timestamp;
  const update: Partial<RecordingState> = { currentPhase: sample.phase, phaseElapsedMs: 0, phaseStartTime: now, liveSamples: [...ts.liveSamples] };
  if (state.currentPhase !== MovementPhaseEnum.IDLE && state.phaseStartTime > 0) { const prevDuration = now - state.phaseStartTime; if (prevDuration > 0) { update.repPhaseDurations = [...state.repPhaseDurations, { phase: state.currentPhase, durationMs: prevDuration }]; } }
  if (sample.phase === MovementPhaseEnum.CONCENTRIC && state.currentPhase !== MovementPhaseEnum.HOLD) { update.repPhaseDurations = []; }
  if (ts.debugSamples.length > 0) { update.allSamples = [...state.allSamples, ...ts.debugSamples]; ts.debugSamples = []; }
  ts.lastFlushTime = sample.timestamp; ts.dirty = false; ts.setCallCount++; set(update);
}

export const recordingStore: RecordingStoreApi = createRecordingStore();

export function useRecordingStore<T>(selector: (state: RecordingState) => T): T { return useStore(recordingStore, selector); }
