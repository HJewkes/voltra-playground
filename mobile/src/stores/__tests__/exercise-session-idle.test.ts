/**
 * Exercise Session Store - Idle Detection, Cluster Tracking, and Count-Up Rest Tests
 *
 * Tests the new session store extensions:
 * - Auto-idle detection (IDLE/HOLD phase triggers rest after threshold)
 * - Pause-set clustering (short rest resumes same set with cluster boundary)
 * - Count-up rest timer (restElapsedMs)
 * - SetLogEntry accumulation with cluster boundaries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MovementPhase } from '@voltras/workout-analytics';
import {
  createExerciseSessionStore,
  SESSION_DEFAULTS,
} from '../exercise-session-store';
import type { RecordingStoreApi } from '../recording-store';
import { createTestExercise, planBuilder } from '@/__fixtures__/generators';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';

// =============================================================================
// Helpers
// =============================================================================

interface MockRecordingStore extends RecordingStoreApi {
  _simulatePhaseChange: (newPhase: MovementPhase, newRepCount?: number) => void;
  _setStopRecordingResult: (result: ReturnType<typeof mockCompletedSet> | null) => void;
}

/**
 * Create a minimal mock recording store for testing idle detection.
 */
function createMockRecordingStore(overrides: {
  currentPhase?: MovementPhase;
  repCount?: number;
  stopRecordingResult?: ReturnType<typeof mockCompletedSet> | null;
} = {}): MockRecordingStore {
  const {
    currentPhase = MovementPhase.IDLE,
    repCount = 0,
    stopRecordingResult = null,
  } = overrides;

  let phase = currentPhase;
  let reps = repCount;
  const listeners: Set<(state: unknown, prev: unknown) => void> = new Set();

  const mockState = {
    currentPhase: phase,
    repCount: reps,
    isRecording: true,
    startRecording: vi.fn(),
    stopRecording: vi.fn().mockReturnValue(stopRecordingResult),
  };

  const store = {
    getState: () => ({ ...mockState, currentPhase: phase, repCount: reps }),
    setState: vi.fn(),
    subscribe: (listener: (state: unknown, prev: unknown) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getInitialState: () => mockState,
    // Simulate phase change for testing
    _simulatePhaseChange: (newPhase: MovementPhase, newRepCount?: number) => {
      const prev = { ...mockState, currentPhase: phase, repCount: reps };
      phase = newPhase;
      if (newRepCount !== undefined) reps = newRepCount;
      const next = { ...mockState, currentPhase: phase, repCount: reps };
      for (const listener of listeners) {
        listener(next, prev);
      }
    },
    _setStopRecordingResult: (result: ReturnType<typeof mockCompletedSet> | null) => {
      mockState.stopRecording.mockReturnValue(result);
    },
  };

  return store as unknown as MockRecordingStore;
}

function setupSessionInRecordingState() {
  const sessionStore = createExerciseSessionStore();
  const mockRecording = createMockRecordingStore();

  const exercise = createTestExercise('bench_press');
  const plan = planBuilder().workingSets(3).workingWeight(100).targetReps(8).build();

  sessionStore.getState().bindRecordingStore(mockRecording);
  sessionStore.getState().startSession(exercise, plan);

  return { sessionStore, mockRecording, exercise, plan };
}

// =============================================================================
// Idle Detection Tests
// =============================================================================

describe('Idle Detection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records idleSinceMs when phase transitions to IDLE during recording', () => {
    const { sessionStore } = setupSessionInRecordingState();

    // Manually set uiState to recording
    sessionStore.setState({ uiState: 'recording' });
    vi.setSystemTime(new Date(10000));

    sessionStore.getState()._onPhaseChange(MovementPhase.IDLE, 3);

    expect(sessionStore.getState().idleSinceMs).toBe(10000);
  });

  it('records idleSinceMs when phase transitions to HOLD during recording', () => {
    const { sessionStore } = setupSessionInRecordingState();

    sessionStore.setState({ uiState: 'recording' });
    vi.setSystemTime(new Date(10000));

    sessionStore.getState()._onPhaseChange(MovementPhase.HOLD, 3);

    expect(sessionStore.getState().idleSinceMs).toBe(10000);
  });

  it('triggers auto-rest when idle exceeds idleThreshold', () => {
    const { sessionStore, mockRecording } = setupSessionInRecordingState();
    const completedSet = mockCompletedSet({ weight: 100, repCount: 5 });
    mockRecording._setStopRecordingResult(completedSet);

    sessionStore.setState({ uiState: 'recording' });
    vi.setSystemTime(new Date(10000));

    // Go idle
    sessionStore.getState()._onPhaseChange(MovementPhase.IDLE, 5);
    expect(sessionStore.getState().idleSinceMs).toBe(10000);

    // Advance time past threshold
    vi.setSystemTime(new Date(10000 + SESSION_DEFAULTS.idleThreshold + 100));

    // Resume active phase - should trigger auto-rest
    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 5);

    expect(sessionStore.getState().idleSinceMs).toBeNull();
    // stopRecording should have been called
    expect(mockRecording.getState().stopRecording).toHaveBeenCalled();
  });

  it('does not trigger auto-rest when idle is below idleThreshold', () => {
    const { sessionStore, mockRecording } = setupSessionInRecordingState();

    sessionStore.setState({ uiState: 'recording' });
    vi.setSystemTime(new Date(10000));

    // Go idle
    sessionStore.getState()._onPhaseChange(MovementPhase.IDLE, 5);

    // Advance time but stay below threshold
    vi.setSystemTime(new Date(10000 + SESSION_DEFAULTS.idleThreshold - 1000));

    // Resume - should NOT trigger auto-rest
    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 5);

    expect(sessionStore.getState().idleSinceMs).toBeNull();
    expect(mockRecording.getState().stopRecording).not.toHaveBeenCalled();
  });

  it('does not double-set idleSinceMs if already idle', () => {
    const { sessionStore } = setupSessionInRecordingState();

    sessionStore.setState({ uiState: 'recording' });
    vi.setSystemTime(new Date(10000));

    sessionStore.getState()._onPhaseChange(MovementPhase.IDLE, 3);
    expect(sessionStore.getState().idleSinceMs).toBe(10000);

    vi.setSystemTime(new Date(12000));
    // Another IDLE phase change while already idle - idleSinceMs should not change
    sessionStore.getState()._onPhaseChange(MovementPhase.HOLD, 3);
    // idleSinceMs is already set, so it stays at 10000
    expect(sessionStore.getState().idleSinceMs).toBe(10000);
  });

  it('ignores phase changes when not in recording state', () => {
    const { sessionStore } = setupSessionInRecordingState();

    sessionStore.setState({ uiState: 'idle' });
    vi.setSystemTime(new Date(10000));

    sessionStore.getState()._onPhaseChange(MovementPhase.IDLE, 0);

    expect(sessionStore.getState().idleSinceMs).toBeNull();
  });
});

// =============================================================================
// Pause-Set Cluster Tracking Tests
// =============================================================================

describe('Pause-Set Cluster Tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('continues same set with cluster boundary when rest is short', () => {
    const { sessionStore, mockRecording } = setupSessionInRecordingState();
    const restStart = 50000;

    sessionStore.setState({
      uiState: 'resting',
      restStartTime: restStart,
      restCountdown: 90,
      currentClusterStart: 0,
      pendingClusters: [],
    });

    // Simulate the recording store having 5 reps completed
    mockRecording._simulatePhaseChange(MovementPhase.IDLE, 5);

    // Advance less than pauseSetThreshold
    vi.setSystemTime(new Date(restStart + SESSION_DEFAULTS.pauseSetThreshold - 5000));

    // Trigger resume via _onPhaseChange with active phase while resting
    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 5);

    const state = sessionStore.getState();
    expect(state.uiState).toBe('recording');
    expect(state.pendingClusters).toHaveLength(1);
    expect(state.pendingClusters[0]).toEqual({
      repStart: 0,
      repEnd: 5,
      pauseAfterMs: expect.any(Number),
    });
    expect(state.pendingClusters[0].pauseAfterMs).toBeLessThan(SESSION_DEFAULTS.pauseSetThreshold);
    expect(state.currentClusterStart).toBe(5);
    expect(state.restElapsedMs).toBe(0);
    expect(state.restStartTime).toBeNull();
  });

  it('finalizes set and starts countdown when rest exceeds threshold', () => {
    const { sessionStore } = setupSessionInRecordingState();
    const restStart = 50000;

    sessionStore.setState({
      uiState: 'resting',
      restStartTime: restStart,
      restCountdown: 90,
    });

    // Advance past pauseSetThreshold
    vi.setSystemTime(new Date(restStart + SESSION_DEFAULTS.pauseSetThreshold + 1000));

    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 5);

    const state = sessionStore.getState();
    expect(state.uiState).toBe('countdown');
    expect(state.restStartTime).toBeNull();
  });

  it('accumulates multiple cluster boundaries across pauses', () => {
    const { sessionStore, mockRecording } = setupSessionInRecordingState();

    // Start with one existing cluster
    sessionStore.setState({
      uiState: 'resting',
      restStartTime: 50000,
      restCountdown: 90,
      currentClusterStart: 0,
      pendingClusters: [],
    });

    // Short rest resume (first pause)
    vi.setSystemTime(new Date(50000 + 5000));
    mockRecording._simulatePhaseChange(MovementPhase.IDLE, 3);
    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 3);

    expect(sessionStore.getState().pendingClusters).toHaveLength(1);
    expect(sessionStore.getState().currentClusterStart).toBe(3);

    // Second short rest
    sessionStore.setState({
      uiState: 'resting',
      restStartTime: 60000,
      restCountdown: 90,
    });

    vi.setSystemTime(new Date(60000 + 8000));
    mockRecording._simulatePhaseChange(MovementPhase.IDLE, 6);
    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 6);

    const state = sessionStore.getState();
    expect(state.pendingClusters).toHaveLength(2);
    expect(state.pendingClusters[1]).toEqual({
      repStart: 3,
      repEnd: 6,
      pauseAfterMs: expect.any(Number),
    });
    expect(state.currentClusterStart).toBe(6);
  });
});

// =============================================================================
// Count-Up Rest Timer Tests
// =============================================================================

describe('Count-Up Rest Timer', () => {
  it('increments restElapsedMs on each tick during rest', () => {
    const { sessionStore } = setupSessionInRecordingState();

    sessionStore.setState({
      uiState: 'resting',
      restCountdown: 90,
      restElapsedMs: 0,
      restStartTime: Date.now(),
      session: sessionStore.getState().session,
    });

    // Tick once
    sessionStore.getState().tickRestTimer();
    expect(sessionStore.getState().restElapsedMs).toBe(1000);

    // Tick again
    sessionStore.getState().tickRestTimer();
    expect(sessionStore.getState().restElapsedMs).toBe(2000);

    // Tick a third time
    sessionStore.getState().tickRestTimer();
    expect(sessionStore.getState().restElapsedMs).toBe(3000);
  });

  it('continues counting up when transitioning to countdown', () => {
    const { sessionStore } = setupSessionInRecordingState();

    // Set restCountdown to just above countdown threshold (3 + 1 = 4)
    sessionStore.setState({
      uiState: 'resting',
      restCountdown: 4,
      restElapsedMs: 86000,
      restStartTime: Date.now(),
      session: sessionStore.getState().session,
    });

    // Tick - this should transition to countdown (3 seconds remaining)
    sessionStore.getState().tickRestTimer();

    expect(sessionStore.getState().uiState).toBe('countdown');
    expect(sessionStore.getState().restElapsedMs).toBe(87000);
  });

  it('resets restElapsedMs when entering rest after set completion', async () => {
    const { sessionStore } = setupSessionInRecordingState();

    // Set some prior rest elapsed
    sessionStore.setState({ restElapsedMs: 5000 });

    const completedSet = mockCompletedSet({ weight: 100, repCount: 5 });
    await sessionStore.getState().onSetCompleted(completedSet);

    expect(sessionStore.getState().restElapsedMs).toBe(0);
    expect(sessionStore.getState().restStartTime).not.toBeNull();
  });
});

// =============================================================================
// SetLogEntry Tests
// =============================================================================

describe('SetLogEntry Accumulation', () => {
  it('adds entry to setLog on set completion', async () => {
    const { sessionStore } = setupSessionInRecordingState();

    const completedSet = mockCompletedSet({ weight: 100, repCount: 5 });
    await sessionStore.getState().onSetCompleted(completedSet);

    const state = sessionStore.getState();
    expect(state.setLog).toHaveLength(1);
    expect(state.setLog[0].set).toBe(completedSet);
    expect(state.setLog[0].clusters).toEqual([]);
  });

  it('includes cluster boundaries in set log entry', async () => {
    const { sessionStore } = setupSessionInRecordingState();

    const clusters = [
      { repStart: 0, repEnd: 3, pauseAfterMs: 5000 },
      { repStart: 3, repEnd: 6, pauseAfterMs: 8000 },
    ];

    sessionStore.setState({ pendingClusters: clusters });

    const completedSet = mockCompletedSet({ weight: 100, repCount: 8 });
    await sessionStore.getState().onSetCompleted(completedSet);

    const state = sessionStore.getState();
    expect(state.setLog).toHaveLength(1);
    expect(state.setLog[0].clusters).toEqual(clusters);
    // pendingClusters should be reset
    expect(state.pendingClusters).toEqual([]);
    expect(state.currentClusterStart).toBe(0);
  });

  it('accumulates multiple set log entries across sets', async () => {
    const { sessionStore } = setupSessionInRecordingState();

    const set1 = mockCompletedSet({ weight: 100, repCount: 5 });
    await sessionStore.getState().onSetCompleted(set1);

    const set2 = mockCompletedSet({ weight: 100, repCount: 4 });
    await sessionStore.getState().onSetCompleted(set2);

    const state = sessionStore.getState();
    expect(state.setLog).toHaveLength(2);
    expect(state.setLog[0].set).toBe(set1);
    expect(state.setLog[1].set).toBe(set2);
  });

  it('resets setLog when starting new session', () => {
    const { sessionStore } = setupSessionInRecordingState();

    // Simulate having a log from a previous session
    sessionStore.setState({
      setLog: [{ set: mockCompletedSet(), clusters: [] }],
    });

    const exercise = createTestExercise('squat');
    const plan = planBuilder().workingSets(3).build();
    sessionStore.getState().startSession(exercise, plan);

    expect(sessionStore.getState().setLog).toEqual([]);
  });
});

// =============================================================================
// Cluster Boundary Rep Range Tests
// =============================================================================

describe('Cluster Boundary Rep Ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks correct rep ranges in cluster boundaries', () => {
    const { sessionStore, mockRecording } = setupSessionInRecordingState();

    // First cluster: reps 0-4
    sessionStore.setState({
      uiState: 'resting',
      restStartTime: 50000,
      restCountdown: 90,
      currentClusterStart: 0,
      pendingClusters: [],
    });

    vi.setSystemTime(new Date(55000)); // 5s rest (< threshold)
    mockRecording._simulatePhaseChange(MovementPhase.IDLE, 4);
    sessionStore.getState()._onPhaseChange(MovementPhase.CONCENTRIC, 4);

    const cluster = sessionStore.getState().pendingClusters[0];
    expect(cluster.repStart).toBe(0);
    expect(cluster.repEnd).toBe(4);
    expect(cluster.pauseAfterMs).toBe(5000);
  });
});
