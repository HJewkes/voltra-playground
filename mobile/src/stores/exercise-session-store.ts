/**
 * Exercise Session Store
 *
 * Unified engine for discovery and standard exercise sessions.
 * Orchestrates multi-set recording, rest timers, and termination.
 *
 * Responsibilities:
 * - Session lifecycle (start, stop, resume)
 * - UI state machine (preparing, ready, countdown, recording, processing, resting, results)
 * - Timer management (rest timer, countdown)
 * - Coordinate with recording-store for intra-set rep detection
 * - Apply termination rules after each set
 * - Persist to ExerciseSessionRepository
 *
 * Two-layer UI state:
 * - ExerciseSessionUIState (this store): session-level state
 * - RecordingUIState (recording-store): intra-set state
 */

import { createStore, useStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

// Domain imports
import type { Exercise } from '@/domain/exercise';
import {
  type CompletedSet,
  type ExercisePlan,
  type ExerciseSession,
  type PlannedSet,
  type TerminationReason,
  createExerciseSession,
  getSessionCurrentSetIndex,
  getCurrentPlannedSet,
  isSessionComplete,
  isDiscoverySession,
  addCompletedSet,
  startRest,
  clearRest,
  checkTermination,
  createUserStoppedTermination,
} from '@/domain/workout';

// Library analytics for computing velocity from sets
import { type WorkoutSample, getSetMeanVelocity } from '@voltras/workout-analytics';

// VBT domain for profile building
import {
  buildLoadVelocityProfile,
  generateWorkingWeightRecommendation,
  type LoadVelocityProfile,
  type WorkingWeightRecommendation,
  type LoadVelocityDataPoint,
} from '@/domain/vbt/profile';

// Data layer
import type { ExerciseSessionRepository } from '@/data/exercise-session';
import { toStoredExerciseSession } from '@/data/exercise-session';
import { getRecordingRepository, isDebugTelemetryEnabled } from '@/data/provider';
import type { SampleRecording } from '@/data/recordings';

import { isHapticCuesEnabled, isAudioCuesEnabled } from '@/data/preferences';
import { fireRestTimerCues, type RestTimerCueSettings } from '@/domain/notifications/rest-timer-cues';

// Recording store for intra-set recording
import type { RecordingStoreApi } from './recording-store';

// Voltra store for device control
import type { VoltraStoreApi } from './voltra-store';

// =============================================================================
// Types
// =============================================================================

/**
 * UI state machine for exercise sessions.
 *
 * First set: idle → preparing → ready → countdown → recording
 * Subsequent sets: resting → countdown → recording (automatic)
 */
export type ExerciseSessionUIState =
  | 'idle' // No active session
  | 'preparing' // Setting device weight for first set
  | 'ready' // First set only: weight set, waiting for START
  | 'countdown' // 3-2-1 before recording
  | 'recording' // Actively recording reps
  | 'processing' // Building Set after recording stops
  | 'resting' // Rest timer - weight adjustable, flows into countdown
  | 'results'; // Session complete, showing summary/recommendation

/**
 * Exercise session store state.
 */
export interface ExerciseSessionState {
  // Core session data
  session: ExerciseSession | null;

  // UI state machine
  uiState: ExerciseSessionUIState;

  // Timers (in seconds)
  restCountdown: number;
  startCountdown: number;

  // Results (computed on completion)
  terminationReason: TerminationReason | null;
  terminationMessage: string | null;

  // For discovery sessions - computed on demand
  velocityProfile: LoadVelocityProfile | null;
  recommendation: WorkingWeightRecommendation | null;

  // Error state
  error: string | null;

  // Derived state
  currentSetIndex: number;
  currentPlannedSet: PlannedSet | null;
  isComplete: boolean;
  isDiscovery: boolean;
  totalSets: number;
  completedSetsCount: number;

  // Actions - Lifecycle
  startSession: (exercise: Exercise, plan: ExercisePlan) => void;
  loadCurrentSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  dispose: () => void;

  // Actions - First set flow
  prepareFirstSet: () => Promise<void>;
  startFirstSet: () => void;

  // Actions - Recording
  onSetCompleted: (completedSet: CompletedSet) => Promise<void>;
  manualStopRecording: () => void;

  // Actions - Rest period
  skipRest: () => void;
  adjustWeight: (weight: number) => Promise<void>;

  // Actions - Timers (for external interval drivers)
  tickRestTimer: () => void;
  tickCountdown: () => void;

  // Actions - Store bindings
  bindRecordingStore: (store: RecordingStoreApi) => void;
  bindVoltraStore: (store: VoltraStoreApi) => void;
  bindRepository: (repo: ExerciseSessionRepository) => void;

  // Internal
  _recordingStore: RecordingStoreApi | null;
  _voltraStore: VoltraStoreApi | null;
  _repository: ExerciseSessionRepository | null;
  _restTimerId: ReturnType<typeof setInterval> | null;
  _countdownTimerId: ReturnType<typeof setInterval> | null;
}

// =============================================================================
// Constants
// =============================================================================

const COUNTDOWN_SECONDS = 3;
const DEFAULT_REST_SECONDS = 90;

// =============================================================================
// Module-level State
// =============================================================================

let recordingStoreRef: RecordingStoreApi | null = null;
let voltraStoreRef: VoltraStoreApi | null = null;
let repositoryRef: ExerciseSessionRepository | null = null;
let restTimerId: ReturnType<typeof setInterval> | null = null;
let countdownTimerId: ReturnType<typeof setInterval> | null = null;
let cachedCueSettings: RestTimerCueSettings | null = null;

async function loadCueSettings(): Promise<RestTimerCueSettings> {
  if (cachedCueSettings) return cachedCueSettings;
  const [hapticEnabled, audioEnabled] = await Promise.all([isHapticCuesEnabled(), isAudioCuesEnabled()]);
  cachedCueSettings = { hapticEnabled, audioEnabled };
  return cachedCueSettings;
}

// =============================================================================
// Singleton Store
// =============================================================================

export const exerciseSessionStore: ExerciseSessionStoreApi = createStore<ExerciseSessionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      session: null,
      uiState: 'idle',
      restCountdown: 0,
      startCountdown: 0,
      terminationReason: null,
      terminationMessage: null,
      velocityProfile: null,
      recommendation: null,
      error: null,

      // Derived state
      currentSetIndex: 0,
      currentPlannedSet: null,
      isComplete: false,
      isDiscovery: false,
      totalSets: 0,
      completedSetsCount: 0,

      // Internal refs
      _recordingStore: null,
      _voltraStore: null,
      _repository: null,
      _restTimerId: null,
      _countdownTimerId: null,

      // =======================================================================
      // Lifecycle Actions
      // =======================================================================

      startSession: (exercise: Exercise, plan: ExercisePlan) => {
        const session = createExerciseSession(exercise, plan);
        set({
          session,
          uiState: 'idle',
          restCountdown: 0,
          startCountdown: 0,
          terminationReason: null,
          terminationMessage: null,
          velocityProfile: null,
          recommendation: null,
          error: null,
          ...computeDerivedState(session),
        });
        persistSession(get, 'in_progress');
      },

      loadCurrentSession: async () => {
        await loadCurrentSessionAction(get, set);
      },

      stopSession: async () => {
        await stopSessionAction(get, set);
      },

      // =======================================================================
      // First Set Flow
      // =======================================================================

      prepareFirstSet: async () => {
        await prepareFirstSetAction(get, set);
      },

      startFirstSet: () => {
        set({ uiState: 'countdown', startCountdown: COUNTDOWN_SECONDS });
        startCountdownTimer(get, set);
      },

      // =======================================================================
      // Recording
      // =======================================================================

      onSetCompleted: async (completedSet: CompletedSet) => {
        await onSetCompletedAction(get, set, completedSet);
      },

      manualStopRecording: () => {
        manualStopRecordingAction(get, set);
      },

      // =======================================================================
      // Rest Period
      // =======================================================================

      skipRest: () => {
        const { session } = get();
        if (!session) return;

        clearTimers();
        const clearedSession = clearRest(session);
        set({
          session: clearedSession,
          uiState: 'countdown',
          startCountdown: COUNTDOWN_SECONDS,
          restCountdown: 0,
        });
        startCountdownTimer(get, set);
      },

      dispose: () => {
        const { uiState } = get();
        const isActive =
          uiState === 'recording' ||
          uiState === 'countdown' ||
          uiState === 'preparing' ||
          uiState === 'resting';

        clearTimers();

        if (isActive && voltraStoreRef) {
          voltraStoreRef
            .getState()
            .stopRecording()
            .catch((err: unknown) => {
              console.warn('[ExerciseSessionStore] dispose: failed to stop device:', err);
            });
        }

        if (recordingStoreRef) {
          recordingStoreRef.getState().reset();
        }

        set({
          session: null,
          uiState: 'idle',
          restCountdown: 0,
          startCountdown: 0,
          terminationReason: null,
          terminationMessage: null,
          velocityProfile: null,
          recommendation: null,
          error: null,
          ...computeDerivedState(null),
        });
      },

      adjustWeight: async (weight: number) => {
        if (!voltraStoreRef) return;
        try {
          await voltraStoreRef.getState().setWeight(weight);
        } catch (err) {
          set({ error: `Failed to adjust weight: ${err}` });
        }
      },

      // =======================================================================
      // Timer Ticks
      // =======================================================================

      tickRestTimer: () => {
        tickRestTimerAction(get, set);
      },

      tickCountdown: () => {
        const { startCountdown } = get();
        const newCountdown = startCountdown - 1;

        if (newCountdown <= 0) {
          clearTimers();
          transitionToRecording(get, set);
        } else {
          set({ startCountdown: newCountdown });
        }
      },

      // =======================================================================
      // Store Bindings
      // =======================================================================

      bindRecordingStore: (store: RecordingStoreApi) => {
        recordingStoreRef = store;
        set({ _recordingStore: store });
      },

      bindVoltraStore: (store: VoltraStoreApi) => {
        voltraStoreRef = store;
        set({ _voltraStore: store });
      },

      bindRepository: (repo: ExerciseSessionRepository) => {
        repositoryRef = repo;
        set({ _repository: repo });
      },
    }),
    { name: 'exercise-session-store' }
  )
);

// =============================================================================
// Extracted Actions
// =============================================================================

async function loadCurrentSessionAction(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): Promise<void> {
  if (!repositoryRef) {
    set({ error: 'Repository not bound' });
    return;
  }

  try {
    const stored = await repositoryRef.getCurrent();
    if (stored) {
      const { fromStoredExerciseSession } = await import('@/data/exercise-session');
      const session = fromStoredExerciseSession(stored);
      set({
        session,
        uiState: stored.status === 'in_progress' ? 'ready' : 'results',
        ...computeDerivedState(session),
      });
    }
  } catch (err) {
    set({ error: `Failed to load session: ${err}` });
  }
}

async function stopSessionAction(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): Promise<void> {
  const { session } = get();
  if (!session) return;

  clearTimers();

  if (voltraStoreRef) {
    try {
      console.log('[ExerciseSessionStore] Stopping session, stopping device');
      await voltraStoreRef.getState().stopRecording();
    } catch (err) {
      console.warn('[ExerciseSessionStore] Failed to stop device:', err);
    }
  }

  const termination = createUserStoppedTermination();
  set({
    uiState: 'results',
    terminationReason: termination.reason,
    terminationMessage: termination.message,
  });

  if (isDiscoverySession(session)) {
    computeDiscoveryResults(get, set);
  }

  await persistSession(get, 'completed', termination.reason);
}

async function prepareFirstSetAction(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): Promise<void> {
  const { session } = get();
  if (!session) {
    console.error('[ExerciseSessionStore] prepareFirstSet: No session');
    set({ error: 'No session' });
    return;
  }
  if (!voltraStoreRef) {
    console.error('[ExerciseSessionStore] prepareFirstSet: No voltraStore bound');
    set({ error: 'Device not connected' });
    return;
  }

  set({ uiState: 'preparing' });

  try {
    const plannedSet = getCurrentPlannedSet(session);
    if (plannedSet) {
      console.log('[ExerciseSessionStore] Setting weight to', plannedSet.weight, 'lbs');
      await voltraStoreRef.getState().setWeight(plannedSet.weight);
      console.log('[ExerciseSessionStore] Weight set successfully');
    } else {
      console.warn('[ExerciseSessionStore] No planned set found');
    }

    console.log('[ExerciseSessionStore] Preparing workout mode');
    await voltraStoreRef.getState().prepareWorkout();
    console.log('[ExerciseSessionStore] Device ready (motor not engaged)');

    set({ uiState: 'ready' });
  } catch (err) {
    console.error('[ExerciseSessionStore] Failed to prepare:', err);
    set({ error: `Failed to prepare: ${err}`, uiState: 'ready' });
  }
}

async function onSetCompletedAction(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void,
  completedSet: CompletedSet
): Promise<void> {
  const { session } = get();
  if (!session) return;

  set({ uiState: 'processing' });

  if (voltraStoreRef) {
    try {
      console.log('[ExerciseSessionStore] Disengaging motor (end of set)');
      await voltraStoreRef.getState().disengageMotor();
    } catch (err) {
      console.warn('[ExerciseSessionStore] Failed to disengage motor:', err);
    }
  }

  const updatedSession = addCompletedSet(session, completedSet);
  const termResult = checkTermination(updatedSession, completedSet);

  if (termResult.shouldTerminate) {
    await handleSessionTermination(get, set, updatedSession, termResult);
  } else {
    handleContinueToRest(get, set, session, updatedSession);
  }
}

async function handleSessionTermination(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void,
  updatedSession: ExerciseSession,
  termResult: { reason?: TerminationReason; message?: string }
): Promise<void> {
  if (voltraStoreRef) {
    try {
      console.log('[ExerciseSessionStore] Session complete, stopping device');
      await voltraStoreRef.getState().stopRecording();
    } catch (err) {
      console.warn('[ExerciseSessionStore] Failed to stop device:', err);
    }
  }

  set({
    session: updatedSession,
    uiState: 'results',
    terminationReason: termResult.reason ?? null,
    terminationMessage: termResult.message ?? null,
    ...computeDerivedState(updatedSession),
  });

  if (isDiscoverySession(updatedSession)) {
    computeDiscoveryResults(get, set);
  }

  await persistSession(get, 'completed', termResult.reason);
}

function handleContinueToRest(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void,
  originalSession: ExerciseSession,
  updatedSession: ExerciseSession
): void {
  const restSeconds = originalSession.plan.defaultRestSeconds || DEFAULT_REST_SECONDS;
  const sessionWithRest = startRest(updatedSession, restSeconds);

  // Reload cue settings for each rest period
  cachedCueSettings = null;

  set({
    session: sessionWithRest,
    uiState: 'resting',
    restCountdown: restSeconds,
    ...computeDerivedState(sessionWithRest),
  });

  startRestTimer(get, set);
  persistSession(get, 'in_progress');
}

function manualStopRecordingAction(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): void {
  console.log('[ExerciseSessionStore] manualStopRecording called');
  if (!recordingStoreRef) {
    console.log('[ExerciseSessionStore] No recordingStore bound!');
    return;
  }

  const state = get();
  const weight = state.currentPlannedSet?.weight ?? 0;
  console.log('[ExerciseSessionStore] Stopping recording with weight:', weight);
  const completedSet = recordingStoreRef.getState().stopRecording(weight);
  console.log('[ExerciseSessionStore] Completed set:', completedSet ? 'yes' : 'no');

  if (completedSet) {
    get().onSetCompleted(completedSet);
  } else {
    handleNoRepsCompleted(get, set);
  }
}

function handleNoRepsCompleted(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): void {
  console.log('[ExerciseSessionStore] No reps, skipping to next set');
  const { session } = get();
  if (!session) return;

  const nextSetIndex = session.completedSets.length;
  const hasMoreSets = nextSetIndex < session.plan.sets.length;
  set({ uiState: hasMoreSets ? 'ready' : 'results' });
}

function tickRestTimerAction(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): void {
  const { restCountdown, session } = get();
  const newCountdown = restCountdown - 1;

  // Fire haptic/audio cues at configured thresholds (fire-and-forget)
  loadCueSettings()
    .then((settings) => fireRestTimerCues(newCountdown, settings))
    .catch(() => {});

  if (newCountdown <= COUNTDOWN_SECONDS && newCountdown > 0) {
    clearTimers();
    const clearedSession = session ? clearRest(session) : session;
    set({
      session: clearedSession,
      uiState: 'countdown',
      startCountdown: newCountdown,
      restCountdown: 0,
    });
    startCountdownTimer(get, set);
  } else if (newCountdown <= 0) {
    clearTimers();
    transitionToRecording(get, set);
  } else {
    set({ restCountdown: newCountdown });
  }
}

// =============================================================================
// Timer Helpers
// =============================================================================

function clearTimers(): void {
  if (restTimerId) {
    clearInterval(restTimerId);
    restTimerId = null;
  }
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
}

function startRestTimer(
  get: () => ExerciseSessionState,
  _set: (state: Partial<ExerciseSessionState>) => void
): void {
  clearTimers();
  restTimerId = setInterval(() => {
    get().tickRestTimer();
  }, 1000);
}

function startCountdownTimer(
  get: () => ExerciseSessionState,
  _set: (state: Partial<ExerciseSessionState>) => void
): void {
  clearTimers();
  countdownTimerId = setInterval(() => {
    get().tickCountdown();
  }, 1000);
}

async function transitionToRecording(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): Promise<void> {
  const { session, currentPlannedSet } = get();
  if (!session || !recordingStoreRef) return;

  set({ uiState: 'recording' });

  if (voltraStoreRef) {
    try {
      if (currentPlannedSet) {
        const currentWeight = voltraStoreRef.getState().weight;
        if (currentWeight !== currentPlannedSet.weight) {
          console.log(
            '[ExerciseSessionStore] Updating weight to',
            currentPlannedSet.weight,
            'lbs'
          );
          await voltraStoreRef.getState().setWeight(currentPlannedSet.weight);
        }
      }
      console.log('[ExerciseSessionStore] Engaging motor');
      await voltraStoreRef.getState().engageMotor();
    } catch (err) {
      console.error('[ExerciseSessionStore] Failed to engage motor:', err);
      set({ error: `Failed to engage motor: ${err}` });
    }
  }

  recordingStoreRef.getState().startRecording(session.exercise.id, session.exercise.name);
}

// =============================================================================
// Persistence
// =============================================================================

async function persistSession(
  get: () => ExerciseSessionState,
  status: 'in_progress' | 'completed' | 'abandoned',
  terminationReason?: TerminationReason
): Promise<void> {
  const { session, currentPlannedSet } = get();
  if (!session || !repositoryRef) return;

  try {
    const rawSamples = recordingStoreRef?.getState().allSamples;

    const stored = toStoredExerciseSession(
      session,
      status,
      terminationReason,
      rawSamples && rawSamples.length > 0 ? rawSamples : undefined
    );
    await repositoryRef.save(stored);

    if (status === 'in_progress') {
      await repositoryRef.setCurrent(session.id);
    } else {
      await repositoryRef.setCurrent(null);
    }

    if (isDebugTelemetryEnabled() && rawSamples && rawSamples.length > 0) {
      await saveDebugRecording(session, currentPlannedSet, rawSamples);
    }
  } catch (err) {
    console.error('Failed to persist session:', err);
  }
}

async function saveDebugRecording(
  session: ExerciseSession,
  currentPlannedSet: PlannedSet | null,
  rawSamples: WorkoutSample[]
): Promise<void> {
  try {
    const recordingRepo = getRecordingRepository();
    const weight = currentPlannedSet?.weight ?? session.plan.sets[0]?.weight ?? 0;
    const firstTimestamp = rawSamples[0].timestamp;
    const lastTimestamp = rawSamples[rawSamples.length - 1].timestamp;

    const recording: SampleRecording = {
      id: `rec-${session.id}-${Date.now()}`,
      sessionId: session.id,
      exerciseId: session.exercise.id,
      exerciseName: session.exercise.name,
      weight,
      recordedAt: Date.now(),
      durationMs: lastTimestamp - firstTimestamp,
      sampleCount: rawSamples.length,
      samples: rawSamples,
      metadata: {},
    };

    await recordingRepo.save(recording);
    console.log('[ExerciseSessionStore] Saved recording:', recording.id);
  } catch (recErr) {
    console.warn('[ExerciseSessionStore] Failed to save recording:', recErr);
  }
}

// =============================================================================
// Discovery Results
// =============================================================================

function computeDiscoveryResults(
  get: () => ExerciseSessionState,
  set: (state: Partial<ExerciseSessionState>) => void
): void {
  const { session } = get();
  if (!session) return;

  const dataPoints: LoadVelocityDataPoint[] = session.completedSets.map((s) => ({
    weight: s.weight,
    velocity: getSetMeanVelocity(s.data),
    timestamp: s.timestamp.start,
  }));

  const profile = buildLoadVelocityProfile(session.exercise.id, dataPoints);
  const goal = session.plan.goal;
  const recommendation = goal ? generateWorkingWeightRecommendation(profile, goal) : null;

  set({ velocityProfile: profile, recommendation });
}

// =============================================================================
// Helpers
// =============================================================================

function computeDerivedState(session: ExerciseSession | null): {
  currentSetIndex: number;
  currentPlannedSet: PlannedSet | null;
  isComplete: boolean;
  isDiscovery: boolean;
  totalSets: number;
  completedSetsCount: number;
} {
  if (!session) {
    return {
      currentSetIndex: 0,
      currentPlannedSet: null,
      isComplete: false,
      isDiscovery: false,
      totalSets: 0,
      completedSetsCount: 0,
    };
  }

  return {
    currentSetIndex: getSessionCurrentSetIndex(session),
    currentPlannedSet: getCurrentPlannedSet(session) ?? null,
    isComplete: isSessionComplete(session),
    isDiscovery: isDiscoverySession(session),
    totalSets: session.plan.sets.length,
    completedSetsCount: session.completedSets.length,
  };
}

// =============================================================================
// Typed Hook
// =============================================================================

export function useExerciseSessionStore<T>(selector: (state: ExerciseSessionState) => T): T {
  return useStore(exerciseSessionStore, selector);
}

// =============================================================================
// Types
// =============================================================================

export type ExerciseSessionStoreApi = StoreApi<ExerciseSessionState>;
