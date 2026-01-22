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

import { createStore, type StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';

// Domain imports
import type { Exercise } from '@/domain/exercise';
import {
  type Set,
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

  // Actions - First set flow
  prepareFirstSet: () => Promise<void>;
  startFirstSet: () => void;

  // Actions - Recording
  onSetCompleted: (completedSet: Set) => Promise<void>;
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
// Store Factory
// =============================================================================

/**
 * Create an exercise session store.
 */
export function createExerciseSessionStore(): ExerciseSessionStoreApi {
  let recordingStore: RecordingStoreApi | null = null;
  let voltraStore: VoltraStoreApi | null = null;
  let repository: ExerciseSessionRepository | null = null;
  let restTimerId: ReturnType<typeof setInterval> | null = null;
  let countdownTimerId: ReturnType<typeof setInterval> | null = null;

  const store = createStore<ExerciseSessionState>()(
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

        // Derived state (will be computed)
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

        // =====================================================================
        // Lifecycle Actions
        // =====================================================================

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

          // Persist session as in_progress
          persistSession(get, 'in_progress');
        },

        loadCurrentSession: async () => {
          if (!repository) {
            set({ error: 'Repository not bound' });
            return;
          }

          try {
            const stored = await repository.getCurrent();
            if (stored) {
              // Import converter - avoid circular imports by importing inline
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
        },

        stopSession: async () => {
          const { session } = get();
          if (!session) return;

          // Clear timers
          clearTimers();

          // Stop device (exit workout mode)
          if (voltraStore) {
            try {
              console.log('[ExerciseSessionStore] Stopping session, stopping device');
              await voltraStore.getState().stopRecording();
            } catch (err) {
              console.warn('[ExerciseSessionStore] Failed to stop device:', err);
            }
          }

          // Mark session as completed with user_stopped reason
          const termination = createUserStoppedTermination();

          set({
            uiState: 'results',
            terminationReason: termination.reason,
            terminationMessage: termination.message,
          });

          // Compute results for discovery
          if (isDiscoverySession(session)) {
            computeDiscoveryResults(get, set);
          }

          // Persist final state
          await persistSession(get, 'completed', termination.reason);
        },

        // =====================================================================
        // First Set Flow
        // =====================================================================

        prepareFirstSet: async () => {
          const { session } = get();
          if (!session) {
            console.error('[ExerciseSessionStore] prepareFirstSet: No session');
            set({ error: 'No session' });
            return;
          }
          if (!voltraStore) {
            console.error('[ExerciseSessionStore] prepareFirstSet: No voltraStore bound');
            set({ error: 'Device not connected' });
            return;
          }

          set({ uiState: 'preparing' });

          try {
            const plannedSet = getCurrentPlannedSet(session);

            // 1. Set the weight first
            if (plannedSet) {
              console.log('[ExerciseSessionStore] Setting weight to', plannedSet.weight, 'lbs');
              await voltraStore.getState().setWeight(plannedSet.weight);
              console.log('[ExerciseSessionStore] Weight set successfully');
            } else {
              console.warn('[ExerciseSessionStore] No planned set found');
            }

            // 2. Put device in workout mode (PREPARE + SETUP, motor NOT engaged)
            console.log('[ExerciseSessionStore] Preparing workout mode');
            await voltraStore.getState().prepareWorkout();
            console.log('[ExerciseSessionStore] Device ready (motor not engaged)');

            set({ uiState: 'ready' });
          } catch (err) {
            console.error('[ExerciseSessionStore] Failed to prepare:', err);
            set({ error: `Failed to prepare: ${err}`, uiState: 'ready' });
          }
        },

        startFirstSet: () => {
          set({ uiState: 'countdown', startCountdown: COUNTDOWN_SECONDS });
          startCountdownTimer(get, set);
        },

        // =====================================================================
        // Recording
        // =====================================================================

        onSetCompleted: async (completedSet: Set) => {
          const { session } = get();
          if (!session) return;

          set({ uiState: 'processing' });

          // Disengage motor at end of set (stay in workout mode for next set)
          if (voltraStore) {
            try {
              console.log('[ExerciseSessionStore] Disengaging motor (end of set)');
              await voltraStore.getState().disengageMotor();
            } catch (err) {
              console.warn('[ExerciseSessionStore] Failed to disengage motor:', err);
            }
          }

          // Add set to session
          const updatedSession = addCompletedSet(session, completedSet);

          // Check termination
          const termResult = checkTermination(updatedSession, completedSet);

          if (termResult.shouldTerminate) {
            // Session complete - full stop (exit workout mode)
            if (voltraStore) {
              try {
                console.log('[ExerciseSessionStore] Session complete, stopping device');
                await voltraStore.getState().stopRecording();
              } catch (err) {
                console.warn('[ExerciseSessionStore] Failed to stop device:', err);
              }
            }

            set({
              session: updatedSession,
              uiState: 'results',
              terminationReason: termResult.reason,
              terminationMessage: termResult.message,
              ...computeDerivedState(updatedSession),
            });

            // Compute discovery results if applicable
            if (isDiscoverySession(updatedSession)) {
              computeDiscoveryResults(get, set);
            }

            // Persist as completed
            await persistSession(get, 'completed', termResult.reason);
          } else {
            // Continue to rest (motor disengaged, device still in workout mode)
            const restSeconds = session.plan.defaultRestSeconds || DEFAULT_REST_SECONDS;
            const sessionWithRest = startRest(updatedSession, restSeconds);

            set({
              session: sessionWithRest,
              uiState: 'resting',
              restCountdown: restSeconds,
              ...computeDerivedState(sessionWithRest),
            });

            // Start rest timer
            startRestTimer(get, set);

            // Persist progress
            await persistSession(get, 'in_progress');
          }
        },

        manualStopRecording: () => {
          console.log('[ExerciseSessionStore] manualStopRecording called');
          // Delegate to recording store
          if (recordingStore) {
            const state = get();
            const weight = state.currentPlannedSet?.weight ?? 0;
            console.log('[ExerciseSessionStore] Stopping recording with weight:', weight);
            const completedSet = recordingStore.getState().stopRecording(weight);
            console.log('[ExerciseSessionStore] Completed set:', completedSet ? 'yes' : 'no');
            if (completedSet) {
              get().onSetCompleted(completedSet);
            } else {
              // No reps completed - still allow ending the set for testing/skipping
              // Just transition to rest/ready state
              console.log('[ExerciseSessionStore] No reps, skipping to next set');
              const { session } = get();
              if (session) {
                const nextSetIndex = session.completedSets.length;
                const hasMoreSets = nextSetIndex < session.plan.sets.length;
                if (hasMoreSets) {
                  set({ uiState: 'ready' });
                } else {
                  set({ uiState: 'results' });
                }
              }
            }
          } else {
            console.log('[ExerciseSessionStore] No recordingStore bound!');
          }
        },

        // =====================================================================
        // Rest Period
        // =====================================================================

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

        adjustWeight: async (weight: number) => {
          if (!voltraStore) return;
          try {
            await voltraStore.getState().setWeight(weight);
          } catch (err) {
            set({ error: `Failed to adjust weight: ${err}` });
          }
        },

        // =====================================================================
        // Timer Ticks (called by interval)
        // =====================================================================

        tickRestTimer: () => {
          const { restCountdown, session } = get();
          const newCountdown = restCountdown - 1;

          if (newCountdown <= COUNTDOWN_SECONDS && newCountdown > 0) {
            // Transition to countdown phase (last 3 seconds of rest)
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
            // Rest complete - start recording
            clearTimers();
            transitionToRecording(get, set);
          } else {
            set({ restCountdown: newCountdown });
          }
        },

        tickCountdown: () => {
          const { startCountdown } = get();
          const newCountdown = startCountdown - 1;

          if (newCountdown <= 0) {
            // Countdown complete - start recording
            clearTimers();
            transitionToRecording(get, set);
          } else {
            set({ startCountdown: newCountdown });
          }
        },

        // =====================================================================
        // Store Bindings
        // =====================================================================

        bindRecordingStore: (store: RecordingStoreApi) => {
          recordingStore = store;
          set({ _recordingStore: store });
        },

        bindVoltraStore: (store: VoltraStoreApi) => {
          voltraStore = store;
          set({ _voltraStore: store });
        },

        bindRepository: (repo: ExerciseSessionRepository) => {
          repository = repo;
          set({ _repository: repo });
        },
      }),
      { name: 'exercise-session-store' }
    )
  );

  // Helper functions that need closure access

  function clearTimers() {
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
  ) {
    clearTimers();
    restTimerId = setInterval(() => {
      get().tickRestTimer();
    }, 1000);
  }

  function startCountdownTimer(
    get: () => ExerciseSessionState,
    _set: (state: Partial<ExerciseSessionState>) => void
  ) {
    clearTimers();
    countdownTimerId = setInterval(() => {
      get().tickCountdown();
    }, 1000);
  }

  async function transitionToRecording(
    get: () => ExerciseSessionState,
    set: (state: Partial<ExerciseSessionState>) => void
  ) {
    const { session, currentPlannedSet } = get();
    if (!session || !recordingStore) return;

    set({ uiState: 'recording' });

    // Engage motor at end of countdown (device already in workout mode from prepareFirstSet)
    if (voltraStore) {
      try {
        // Update weight if changed during rest (e.g., user adjusted)
        if (currentPlannedSet) {
          const currentWeight = voltraStore.getState().weight;
          if (currentWeight !== currentPlannedSet.weight) {
            console.log(
              '[ExerciseSessionStore] Updating weight to',
              currentPlannedSet.weight,
              'lbs'
            );
            await voltraStore.getState().setWeight(currentPlannedSet.weight);
          }
        }
        // Engage motor (sends GO command)
        console.log('[ExerciseSessionStore] Engaging motor');
        await voltraStore.getState().engageMotor();
      } catch (err) {
        console.error('[ExerciseSessionStore] Failed to engage motor:', err);
        set({ error: `Failed to engage motor: ${err}` });
      }
    }

    // Start recording in recording-store (analytics)
    recordingStore.getState().startRecording(session.exercise.id, session.exercise.name);
  }

  async function persistSession(
    get: () => ExerciseSessionState,
    status: 'in_progress' | 'completed' | 'abandoned',
    terminationReason?: TerminationReason
  ) {
    const { session, currentPlannedSet } = get();
    if (!session || !repository) return;

    try {
      // Get raw samples from recording store for the last set (if debug enabled)
      const rawSamples = recordingStore?.getState().allSamples;

      const stored = toStoredExerciseSession(
        session,
        status,
        terminationReason,
        rawSamples && rawSamples.length > 0 ? rawSamples : undefined
      );
      await repository.save(stored);

      if (status === 'in_progress') {
        await repository.setCurrent(session.id);
      } else {
        await repository.setCurrent(null);
      }

      // Save standalone SampleRecording when debug enabled and we have samples
      if (isDebugTelemetryEnabled() && rawSamples && rawSamples.length > 0) {
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
    } catch (err) {
      console.error('Failed to persist session:', err);
    }
  }

  function computeDiscoveryResults(
    get: () => ExerciseSessionState,
    set: (state: Partial<ExerciseSessionState>) => void
  ) {
    const { session } = get();
    if (!session) return;

    // Build data points from completed sets
    const dataPoints: LoadVelocityDataPoint[] = session.completedSets.map((s) => ({
      weight: s.weight,
      velocity: s.metrics.velocity.concentricBaseline,
      timestamp: s.timestamp.start,
    }));

    // Build profile
    const profile = buildLoadVelocityProfile(session.exercise.id, dataPoints);

    // Generate recommendation if we have a goal
    const goal = session.plan.goal;
    const recommendation = goal ? generateWorkingWeightRecommendation(profile, goal) : null;

    set({ velocityProfile: profile, recommendation });
  }

  return store;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Compute derived state from session.
 */
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
// Types
// =============================================================================

export type ExerciseSessionStoreApi = StoreApi<ExerciseSessionState>;
