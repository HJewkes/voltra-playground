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
  type ClusterBoundary,
  type SetLogEntry,
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
  MovementPhase,
  type SupersetConfig,
  type SupersetState,
  createSupersetState,
  advanceSuperset,
  getCurrentSlot,
  isSupersetComplete,
  getUpcomingExercises,
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

// Notification cues for rest timer
import {
  type RestTimerCueSettings,
} from '@/domain/notifications/rest-timer-cues';

// Auto-regulation engine
import {
  computeAutoRegulation,
  type AutoRegulationState,
} from '@/domain/planning/auto-regulation';
import { TrainingGoal } from '@/domain/planning/types';

// Coaching feedback loop
import { executeCoachingLoop } from '@/domain/coaching/coaching-loop';
import type { CoachingStoreApi } from '@/domain/coaching/coaching-store';
import type { ClaudeApiConfig } from '@/domain/coaching/claude-api';

// Recording store for intra-set recording
import type { RecordingStoreApi } from './recording-store';

// Voltra store for device control
import type { VoltraStoreApi } from './voltra-store';

// =============================================================================
// Types
// =============================================================================

/**
 * A timestamped note captured during a session (e.g. between sets).
 */
export interface SessionNote {
  text: string;
  timestamp: number;
  setIndex: number;
  exerciseId?: string;
}

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

  // Auto-regulation state (computed after each set)
  autoRegulation: AutoRegulationState | null;

  // Idle detection
  idleSinceMs: number | null;

  // Count-up rest
  restElapsedMs: number;
  restStartTime: number | null;

  // Cluster tracking (for pause sets)
  currentClusterStart: number;
  pendingClusters: ClusterBoundary[];

  // Set log
  setLog: SetLogEntry[];

  // Session notes (athlete quick-notes between sets)
  sessionNotes: SessionNote[];

  // Error state
  error: string | null;

  // Derived state
  currentSetIndex: number;
  currentPlannedSet: PlannedSet | null;
  isComplete: boolean;
  isDiscovery: boolean;
  totalSets: number;
  completedSetsCount: number;

  // Stale state flag
  isDisposed: boolean;

  // Superset state
  supersetConfig: SupersetConfig | null;
  supersetState: SupersetState | null;
  currentExercise: Exercise | null;
  nextExerciseName: string | null;
  supersetRound: number;
  supersetSlotIndex: number;
  isSupersetActive: boolean;

  // Actions - Lifecycle
  startSession: (exercise: Exercise, plan: ExercisePlan) => void;
  startSupersetSession: (config: SupersetConfig) => void;
  loadCurrentSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  dispose: () => void;

  // Actions - Notes
  addNote: (text: string) => void;

  // Actions - Dynamic plan building
  addPlannedSet: (set: PlannedSet) => void;
  updatePlannedSetRest: (setIndex: number, restSeconds: number) => void;

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
  bindCoachingStore: (store: CoachingStoreApi, config: ClaudeApiConfig) => void;

  // Internal
  _recordingStore: RecordingStoreApi | null;
  _voltraStore: VoltraStoreApi | null;
  _repository: ExerciseSessionRepository | null;
  _coachingStore: CoachingStoreApi | null;
  _claudeApiConfig: ClaudeApiConfig | null;
  _restTimerId: ReturnType<typeof setInterval> | null;
  _countdownTimerId: ReturnType<typeof setInterval> | null;
  _idleUnsubscribe: (() => void) | null;
  _onPhaseChange: (phase: MovementPhase, repCount: number) => void;
  _autoTransitionToRest: () => void;
  _onLiftingResumedFromRest: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const COUNTDOWN_SECONDS = 3;
const DEFAULT_REST_SECONDS = 90;

/** Thresholds for idle detection and pause-set clustering */
export const SESSION_DEFAULTS = {
  /** ms idle before auto-rest triggers */
  idleThreshold: 7000,
  /** ms rest before new set (vs intra-set pause) */
  pauseSetThreshold: 20000,
  /** ms to debounce brief pauses at lockout */
  idleDebounce: 2000,
};

// =============================================================================
// Module-level State
// =============================================================================

let recordingStoreRef: RecordingStoreApi | null = null;
let voltraStoreRef: VoltraStoreApi | null = null;
let repositoryRef: ExerciseSessionRepository | null = null;
let coachingStoreRef: CoachingStoreApi | null = null;
let claudeApiConfigRef: ClaudeApiConfig | null = null;
let restTimerId: ReturnType<typeof setInterval> | null = null;
let countdownTimerId: ReturnType<typeof setInterval> | null = null;
let cachedCueSettings: RestTimerCueSettings | null = null;
let idleTimerId: ReturnType<typeof setTimeout> | null = null;

async function loadCueSettings(): Promise<RestTimerCueSettings> {
  if (cachedCueSettings) return cachedCueSettings;
  const [hapticEnabled, audioEnabled] = await Promise.all([
    isHapticCuesEnabled(),
    isAudioCuesEnabled(),
  ]);
  cachedCueSettings = { hapticEnabled, audioEnabled };
  return cachedCueSettings;
}

// =============================================================================
// Factory & Singleton
// =============================================================================

function createStoreInstance(): ExerciseSessionStoreApi {
  // Reset module-level refs for test isolation
  recordingStoreRef = null;
  voltraStoreRef = null;
  repositoryRef = null;
  coachingStoreRef = null;
  claudeApiConfigRef = null;
  restTimerId = null;
  countdownTimerId = null;
  cachedCueSettings = null;
  idleTimerId = null;

  return createStore<ExerciseSessionState>()(
    devtools(
      (set, get) => ({
      // Initial state
      session: null,
      uiState: 'idle',
      isDisposed: false,
      restCountdown: 0,
      startCountdown: 0,
      terminationReason: null,
      terminationMessage: null,
      velocityProfile: null,
      recommendation: null,
      autoRegulation: null,
      idleSinceMs: null,
      restElapsedMs: 0,
      restStartTime: null,
      currentClusterStart: 0,
      pendingClusters: [],
      setLog: [],
      sessionNotes: [],
      error: null,

      // Derived state
      currentSetIndex: 0,
      currentPlannedSet: null,
      isComplete: false,
      isDiscovery: false,
      totalSets: 0,
      completedSetsCount: 0,

      // Superset state
      supersetConfig: null,
      supersetState: null,
      currentExercise: null,
      nextExerciseName: null,
      supersetRound: 0,
      supersetSlotIndex: 0,
      isSupersetActive: false,

      // Internal refs
      _recordingStore: null,
      _voltraStore: null,
      _repository: null,
      _coachingStore: null,
      _claudeApiConfig: null,
      _restTimerId: null,
      _countdownTimerId: null,
      _idleUnsubscribe: null,

      // =======================================================================
      // Idle Detection & Cluster Tracking
      // =======================================================================

      _onPhaseChange: (phase: MovementPhase, _repCount: number) => {
        const state = get();
        const isIdlePhase = phase === MovementPhase.IDLE || phase === MovementPhase.HOLD;
        const isActivePhase = phase === MovementPhase.CONCENTRIC || phase === MovementPhase.ECCENTRIC;

        if (state.uiState === 'recording') {
          if (isIdlePhase && state.idleSinceMs === null) {
            set({ idleSinceMs: Date.now() });
            if (idleTimerId) clearTimeout(idleTimerId);
            idleTimerId = setTimeout(() => {
              idleTimerId = null;
              if (get().uiState === 'recording' && get().idleSinceMs !== null) {
                set({ idleSinceMs: null });
                get()._autoTransitionToRest();
              }
            }, SESSION_DEFAULTS.idleThreshold);
          } else if (isActivePhase && state.idleSinceMs !== null) {
            if (idleTimerId) {
              clearTimeout(idleTimerId);
              idleTimerId = null;
            }
            set({ idleSinceMs: null });
          }
        } else if (state.uiState === 'resting' && isActivePhase) {
          get()._onLiftingResumedFromRest();
        }
      },

      _autoTransitionToRest: () => {
        if (!recordingStoreRef) return;
        const state = get();
        const weight = state.currentPlannedSet?.weight ?? 0;
        const completedSet = recordingStoreRef.getState().stopRecording(weight);
        if (completedSet) {
          get().onSetCompleted(completedSet);
        }
      },

      _onLiftingResumedFromRest: () => {
        const { restStartTime } = get();
        if (!restStartTime || !recordingStoreRef) return;
        const elapsed = Date.now() - restStartTime;

        if (elapsed < SESSION_DEFAULTS.pauseSetThreshold) {
          const repCount = recordingStoreRef.getState().repCount;
          const clusters = get().pendingClusters;
          set({
            pendingClusters: [
              ...clusters,
              {
                repStart: get().currentClusterStart,
                repEnd: repCount,
                pauseAfterMs: elapsed,
              },
            ],
            currentClusterStart: repCount,
            uiState: 'recording',
            restElapsedMs: 0,
            restStartTime: null,
            restCountdown: 0,
          });
          clearTimers();
        } else {
          clearTimers();
          set({
            uiState: 'countdown',
            startCountdown: COUNTDOWN_SECONDS,
            restCountdown: 0,
            restStartTime: null,
          });
          startCountdownTimer(get, set);
        }
      },

      // =======================================================================
      // Lifecycle Actions
      // =======================================================================

      startSession: (exercise: Exercise, plan: ExercisePlan) => {
        const session = createExerciseSession(exercise, plan);
        set({
          session,
          uiState: 'idle',
          isDisposed: false,
          restCountdown: 0,
          startCountdown: 0,
          terminationReason: null,
          terminationMessage: null,
          velocityProfile: null,
          recommendation: null,
          autoRegulation: null,
          idleSinceMs: null,
          restElapsedMs: 0,
          restStartTime: null,
          currentClusterStart: 0,
          pendingClusters: [],
          setLog: [],
          sessionNotes: [],
          error: null,
          supersetConfig: null,
          supersetState: null,
          ...computeDerivedState(session),
          ...computeSupersetDerived(null, null),
        });
        persistSession(get, 'in_progress');
      },

      startSupersetSession: (config: SupersetConfig) => {
        const ssState = createSupersetState();
        const firstSlot = getCurrentSlot(config, ssState);
        const session = createExerciseSession(firstSlot.exercise, firstSlot.plan);

        set({
          session,
          uiState: 'idle',
          isDisposed: false,
          restCountdown: 0,
          startCountdown: 0,
          terminationReason: null,
          terminationMessage: null,
          velocityProfile: null,
          recommendation: null,
          autoRegulation: null,
          idleSinceMs: null,
          restElapsedMs: 0,
          restStartTime: null,
          currentClusterStart: 0,
          pendingClusters: [],
          setLog: [],
          sessionNotes: [],
          error: null,
          supersetConfig: config,
          supersetState: ssState,
          ...computeDerivedState(session),
          ...computeSupersetDerived(config, ssState),
        });
        persistSession(get, 'in_progress');
      },

      loadCurrentSession: async () => {
        if (get().isDisposed) return;
        await loadCurrentSessionAction(get, set);
      },

      stopSession: async () => {
        if (get().isDisposed) return;
        await stopSessionAction(get, set);
      },

      // =======================================================================
      // Notes
      // =======================================================================

      addNote: (text: string) => {
        const { session, sessionNotes } = get();
        if (!session) return;

        const note: SessionNote = {
          text,
          timestamp: Date.now(),
          setIndex: session.completedSets.length,
          exerciseId: session.exercise.id,
        };
        set({ sessionNotes: [...sessionNotes, note] });
      },

      // =======================================================================
      // Dynamic Plan Building
      // =======================================================================

      addPlannedSet: (plannedSet: PlannedSet) => {
        const { session } = get();
        if (!session) return;

        const updatedPlan = {
          ...session.plan,
          sets: [...session.plan.sets, plannedSet],
        };
        const updatedSession = { ...session, plan: updatedPlan };

        set({
          session: updatedSession,
          ...computeDerivedState(updatedSession),
        });
      },

      updatePlannedSetRest: (setIndex: number, restSeconds: number) => {
        const { session } = get();
        if (!session) return;

        const sets = session.plan.sets.map((s, i) =>
          i === setIndex ? { ...s, restSeconds } : s,
        );
        const updatedSession = { ...session, plan: { ...session.plan, sets } };
        set({ session: updatedSession });
      },

      // =======================================================================
      // First Set Flow
      // =======================================================================

      prepareFirstSet: async () => {
        if (get().isDisposed) return;
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
        if (get().isDisposed) return;
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
          isDisposed: true,
          restCountdown: 0,
          startCountdown: 0,
          terminationReason: null,
          terminationMessage: null,
          velocityProfile: null,
          recommendation: null,
          autoRegulation: null,
          idleSinceMs: null,
          restElapsedMs: 0,
          restStartTime: null,
          currentClusterStart: 0,
          pendingClusters: [],
          setLog: [],
          sessionNotes: [],
          error: null,
          supersetConfig: null,
          supersetState: null,
          ...computeDerivedState(null),
          ...computeSupersetDerived(null, null),
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

      bindCoachingStore: (store: CoachingStoreApi, config: ClaudeApiConfig) => {
        coachingStoreRef = store;
        claudeApiConfigRef = config;
        set({ _coachingStore: store, _claudeApiConfig: config });
      },
    }),
    { name: 'exercise-session-store' }
  )
  );
}

export function createExerciseSessionStore(): ExerciseSessionStoreApi {
  return createStoreInstance();
}

export const exerciseSessionStore: ExerciseSessionStoreApi = createStoreInstance();

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
  const { session, supersetConfig, supersetState } = get();
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

  // Superset path: rotate to next exercise
  if (supersetConfig && supersetState) {
    const result = advanceSuperset(supersetConfig, supersetState);

    if (result.isComplete) {
      if (voltraStoreRef) {
        try {
          await voltraStoreRef.getState().stopRecording();
        } catch (err) {
          console.warn('[ExerciseSessionStore] Failed to stop device:', err);
        }
      }

      set({
        session: updatedSession,
        uiState: 'results',
        terminationReason: 'all_sets_completed' as TerminationReason,
        terminationMessage: 'Superset complete',
        ...computeDerivedState(updatedSession),
        isSupersetActive: false,
      });

      await persistSession(get, 'completed', 'all_sets_completed' as TerminationReason);
    } else {
      const nextSlot = result.nextSlot!;
      const nextSession = createExerciseSession(nextSlot.exercise, nextSlot.plan);
      const restSeconds = result.restSeconds;
      const sessionWithRest = startRest(nextSession, restSeconds);

      set({
        session: sessionWithRest,
        uiState: 'resting',
        restCountdown: restSeconds,
        supersetState: result.state,
        ...computeDerivedState(sessionWithRest),
        ...computeSupersetDerived(supersetConfig, result.state),
      });

      startRestTimer(get, set);
      persistSession(get, 'in_progress');
    }
    return;
  }

  // Standard path: check termination
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
  // Compute auto-regulation signals for between-set UI
  const arGoal = updatedSession.plan.goal ?? TrainingGoal.HYPERTROPHY;
  const arType: 'compound' | 'isolation' =
    updatedSession.exercise.movementPattern === 'isolation' ? 'isolation' : 'compound';
  const arSets = updatedSession.plan.sets.filter((s) => !s.isWarmup).length;
  const autoReg = computeAutoRegulation(updatedSession, arGoal, arType, arSets);

  const restSeconds = autoReg.restSeconds > 0
    ? autoReg.restSeconds
    : (originalSession.plan.defaultRestSeconds || DEFAULT_REST_SECONDS);
  const sessionWithRest = startRest(updatedSession, restSeconds);

  set({
    session: sessionWithRest,
    uiState: 'resting',
    restCountdown: restSeconds,
    restElapsedMs: 0,
    restStartTime: Date.now(),
    autoRegulation: autoReg,
    ...computeDerivedState(sessionWithRest),
  });

  startRestTimer(get, set);
  persistSession(get, 'in_progress');

  // Fire coaching loop asynchronously (non-blocking)
  if (coachingStoreRef && claudeApiConfigRef) {
    executeCoachingLoop(updatedSession, autoReg, coachingStoreRef, claudeApiConfigRef).catch(
      (err: unknown) => {
        console.warn('[ExerciseSessionStore] Coaching loop failed:', err);
      }
    );
  }
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
  const { restCountdown, restElapsedMs, session } = get();
  const newCountdown = restCountdown - 1;
  const newElapsed = restElapsedMs + 1000;

  if (newCountdown <= COUNTDOWN_SECONDS && newCountdown > 0) {
    clearTimers();
    const clearedSession = session ? clearRest(session) : session;
    set({
      session: clearedSession,
      uiState: 'countdown',
      startCountdown: newCountdown,
      restCountdown: 0,
      restElapsedMs: newElapsed,
    });
    startCountdownTimer(get, set);
  } else if (newCountdown <= 0) {
    clearTimers();
    transitionToRecording(get, set);
  } else {
    set({ restCountdown: newCountdown, restElapsedMs: newElapsed });
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
  if (idleTimerId) {
    clearTimeout(idleTimerId);
    idleTimerId = null;
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
// Superset Derived State
// =============================================================================

function computeSupersetDerived(
  config: SupersetConfig | null,
  ssState: SupersetState | null
): {
  currentExercise: Exercise | null;
  nextExerciseName: string | null;
  supersetRound: number;
  supersetSlotIndex: number;
  isSupersetActive: boolean;
} {
  if (!config || !ssState) {
    return {
      currentExercise: null,
      nextExerciseName: null,
      supersetRound: 0,
      supersetSlotIndex: 0,
      isSupersetActive: false,
    };
  }

  const current = getCurrentSlot(config, ssState);
  const upcoming = getUpcomingExercises(config, ssState, 2);
  const nextName = upcoming.length > 1 ? upcoming[1].exercise.name : null;

  return {
    currentExercise: current.exercise,
    nextExerciseName: nextName,
    supersetRound: ssState.currentRound,
    supersetSlotIndex: ssState.currentSlotIndex,
    isSupersetActive: !isSupersetComplete(config, ssState),
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
