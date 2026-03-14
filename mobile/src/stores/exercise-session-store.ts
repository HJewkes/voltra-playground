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
} from '@/domain/workout';

// Library analytics for computing velocity from sets
import { getSetMeanVelocity } from '@voltras/workout-analytics';

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
import { getRecordingRepository, getVelocityProfileRepository, isDebugTelemetryEnabled } from '@/data/provider';
import type { StoredVelocityProfile } from '@/data/velocity-profile';
import type { SampleRecording } from '@/data/recordings';

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

  // Actions - Lifecycle
  startSession: (exercise: Exercise, plan: ExercisePlan) => void;
  loadCurrentSession: () => Promise<void>;
  stopSession: () => Promise<void>;

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

  // Internal
  _recordingStore: RecordingStoreApi | null;
  _voltraStore: VoltraStoreApi | null;
  _repository: ExerciseSessionRepository | null;
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
  let idleTimerId: ReturnType<typeof setTimeout> | null = null;
  let idleUnsubscribe: (() => void) | null = null;

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
        idleSinceMs: null,
        restElapsedMs: 0,
        restStartTime: null,
        currentClusterStart: 0,
        pendingClusters: [],
        setLog: [],
        sessionNotes: [],
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
        _idleUnsubscribe: null,

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
            idleSinceMs: null,
            restElapsedMs: 0,
            restStartTime: null,
            currentClusterStart: 0,
            pendingClusters: [],
            setLog: [],
            sessionNotes: [],
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

          // Clear timers and idle subscription
          clearTimers();
          clearIdleSubscription();

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
        // Notes
        // =====================================================================

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

        // =====================================================================
        // Dynamic Plan Building
        // =====================================================================

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

        onSetCompleted: async (completedSet: CompletedSet) => {
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

          // Build set log entry with cluster info and chart samples
          const entry: SetLogEntry = {
            set: completedSet,
            clusters: [...get().pendingClusters],
            samples: recordingStore ? [...recordingStore.getState().liveSamples] : undefined,
          };

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
              setLog: [...get().setLog, entry],
              pendingClusters: [],
              currentClusterStart: 0,
              ...computeDerivedState(updatedSession),
            });

            // Clean up idle subscription
            clearIdleSubscription();

            // Compute discovery results if applicable
            if (isDiscoverySession(updatedSession)) {
              computeDiscoveryResults(get, set);
            }

            // Persist as completed
            await persistSession(get, 'completed', termResult.reason);
          } else {
            // Continue to rest (motor disengaged, device still in workout mode)
            // Per-set rest takes priority, then plan default, then global default
            const completedSetIndex = updatedSession.completedSets.length - 1;
            const plannedSet = session.plan.sets[completedSetIndex];
            const restSeconds = plannedSet?.restSeconds ?? session.plan.defaultRestSeconds ?? DEFAULT_REST_SECONDS;
            const sessionWithRest = startRest(updatedSession, restSeconds);

            set({
              session: sessionWithRest,
              uiState: 'resting',
              restCountdown: restSeconds,
              restElapsedMs: 0,
              restStartTime: Date.now(),
              setLog: [...get().setLog, entry],
              pendingClusters: [],
              currentClusterStart: 0,
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
          const { restCountdown, restElapsedMs, session } = get();
          const newCountdown = restCountdown - 1;
          const newElapsed = restElapsedMs + 1000;

          if (newCountdown <= 0) {
            // Rest complete — stop timer, wait for user to start next set
            clearTimers();
            const clearedSession = session ? clearRest(session) : session;
            set({
              session: clearedSession,
              uiState: 'idle',
              restCountdown: 0,
              restElapsedMs: newElapsed,
            });
          } else {
            set({ restCountdown: newCountdown, restElapsedMs: newElapsed });
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
        // Idle Detection & Cluster Tracking (internal)
        // =====================================================================

        _onPhaseChange: (phase: MovementPhase, _repCount: number) => {
          const state = get();
          const isIdlePhase = phase === MovementPhase.IDLE || phase === MovementPhase.HOLD;
          const isActivePhase = phase === MovementPhase.CONCENTRIC || phase === MovementPhase.ECCENTRIC;

          if (state.uiState === 'recording') {
            if (isIdlePhase && state.idleSinceMs === null) {
              // Idle started — arm a timer to auto-transition to rest
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
              // Active phase resumed before threshold — cancel the idle timer
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
          if (!recordingStore) return;
          const state = get();
          const weight = state.currentPlannedSet?.weight ?? 0;
          const completedSet = recordingStore.getState().stopRecording(weight);
          if (completedSet) {
            get().onSetCompleted(completedSet);
          }
        },

        _onLiftingResumedFromRest: () => {
          const { restStartTime } = get();
          if (!restStartTime || !recordingStore) return;
          const elapsed = Date.now() - restStartTime;

          if (elapsed < SESSION_DEFAULTS.pauseSetThreshold) {
            // Intra-set pause — continue same recording, add cluster boundary
            const repCount = recordingStore.getState().repCount;
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
            // Real rest — finalize, start new set via countdown
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
    if (idleTimerId) {
      clearTimeout(idleTimerId);
      idleTimerId = null;
    }
  }

  function clearIdleSubscription() {
    if (idleUnsubscribe) {
      idleUnsubscribe();
      idleUnsubscribe = null;
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

    set({ uiState: 'recording', idleSinceMs: null });

    // Subscribe to recording-store phase changes for idle detection
    clearIdleSubscription();
    if (recordingStore) {
      idleUnsubscribe = recordingStore.subscribe((state, prev) => {
        if (state.currentPhase !== prev.currentPhase) {
          store.getState()._onPhaseChange(state.currentPhase, state.repCount);
        }
      });
    }

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
      velocity: getSetMeanVelocity(s.data),
      timestamp: s.timestamp.start,
    }));

    // Build profile
    const profile = buildLoadVelocityProfile(session.exercise.id, dataPoints);

    // Generate recommendation if we have a goal
    const goal = session.plan.goal;
    const recommendation = goal ? generateWorkingWeightRecommendation(profile, goal) : null;

    set({ velocityProfile: profile, recommendation });

    // Persist the velocity profile for cross-session survival
    persistVelocityProfile(session.exercise.id, profile, dataPoints);
  }

  async function persistVelocityProfile(
    exerciseId: string,
    profile: LoadVelocityProfile,
    dataPoints: LoadVelocityDataPoint[]
  ) {
    try {
      const repo = getVelocityProfileRepository();
      const existing = await repo.get(exerciseId);
      const sessionCount = (existing?.sessionCount ?? 0) + 1;

      const stored: StoredVelocityProfile = {
        exerciseId,
        profile,
        dataPoints: dataPoints.map((dp) => ({
          weight: dp.weight,
          velocity: dp.velocity,
          date: dp.timestamp ?? Date.now(),
        })),
        baseline: null,
        lastUpdated: Date.now(),
        sessionCount,
      };

      await repo.save(exerciseId, stored);
    } catch (err) {
      console.warn('[ExerciseSessionStore] Failed to persist velocity profile:', err);
    }
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
