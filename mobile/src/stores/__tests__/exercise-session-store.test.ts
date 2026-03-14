/**
 * Exercise Session Store Tests
 *
 * Tests for session lifecycle, UI state machine transitions,
 * timer behavior, and store binding coordination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExerciseSessionStore, type ExerciseSessionStoreApi } from '../exercise-session-store';
import { createRecordingStore, type RecordingStoreApi } from '../recording-store';
import type { VoltraStoreApi } from '../voltra-store';
import {
  planBuilder,
  createTestExercise,
  mockCompletedSet,
} from '@/__fixtures__/generators';
import type { ExerciseSessionRepository } from '@/data/exercise-session';

// Mock @/domain/device to avoid react-native-ble-plx parse errors
vi.mock('@/domain/device', () => ({
  TrainingMode: { Idle: 0, WeightTraining: 1 },
  TrainingModeNames: {},
  toWorkoutSample: vi.fn((frame: unknown) => frame),
  toWorkoutSamples: vi.fn((frames: unknown[]) => frames),
  detectBLEEnvironment: vi.fn(() => ({
    environment: 'node',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
    requiresUserGesture: false,
    forceMock: false,
  })),
  VoltraManager: { forMock: vi.fn(), forNative: vi.fn(), forWeb: vi.fn(), forNode: vi.fn() },
}));

vi.mock('@/data/provider', () => ({
  isDebugTelemetryEnabled: vi.fn(() => false),
  getRecordingRepository: vi.fn(() => ({
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/data/exercise-session', async () => {
  const actual = await vi.importActual('@/data/exercise-session');
  return {
    ...actual,
    fromStoredExerciseSession: vi.fn(),
  };
});

// =============================================================================
// Helpers
// =============================================================================

function createMockRepository(): ExerciseSessionRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    getCurrent: vi.fn().mockResolvedValue(null),
    setCurrent: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    getByExercise: vi.fn().mockResolvedValue([]),
    deleteById: vi.fn().mockResolvedValue(undefined),
    deleteAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as ExerciseSessionRepository;
}

function createMockVoltraStore(): VoltraStoreApi {
  const state = {
    weight: 100,
    setWeight: vi.fn().mockResolvedValue(undefined),
    prepareWorkout: vi.fn().mockResolvedValue(undefined),
    engageMotor: vi.fn().mockResolvedValue(undefined),
    disengageMotor: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(undefined),
  };

  return {
    getState: () => state,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    getInitialState: () => state,
  } as unknown as VoltraStoreApi;
}

// =============================================================================
// Tests
// =============================================================================

describe('ExerciseSessionStore', () => {
  let store: ExerciseSessionStoreApi;
  let recordingStore: RecordingStoreApi;
  let voltraStore: VoltraStoreApi;
  let repository: ExerciseSessionRepository;

  beforeEach(() => {
    vi.useFakeTimers();

    store = createExerciseSessionStore();
    recordingStore = createRecordingStore();
    voltraStore = createMockVoltraStore();
    repository = createMockRepository();

    store.getState().bindRecordingStore(recordingStore);
    store.getState().bindVoltraStore(voltraStore);
    store.getState().bindRepository(repository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts idle with no session', () => {
      const state = store.getState();

      expect(state.uiState).toBe('idle');
      expect(state.session).toBeNull();
      expect(state.currentSetIndex).toBe(0);
      expect(state.isComplete).toBe(false);
      expect(state.isDiscovery).toBe(false);
      expect(state.totalSets).toBe(0);
      expect(state.completedSetsCount).toBe(0);
      expect(state.terminationReason).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('startSession()', () => {
    it('creates session with exercise and plan', () => {
      const exercise = createTestExercise('bench_press');
      const plan = planBuilder().workingSets(3).build();

      store.getState().startSession(exercise, plan);
      const state = store.getState();

      expect(state.session).not.toBeNull();
      expect(state.session!.exercise).toBe(exercise);
      expect(state.session!.plan).toBe(plan);
      expect(state.uiState).toBe('idle');
      expect(state.totalSets).toBe(plan.sets.length);
      expect(state.completedSetsCount).toBe(0);
    });

    it('resets previous session state', () => {
      const exercise = createTestExercise('squat');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);

      const exercise2 = createTestExercise('deadlift');
      const plan2 = planBuilder().workingSets(5).build();
      store.getState().startSession(exercise2, plan2);

      const state = store.getState();
      expect(state.session!.exercise.id).toBe('deadlift');
      expect(state.terminationReason).toBeNull();
      expect(state.velocityProfile).toBeNull();
      expect(state.recommendation).toBeNull();
      expect(state.error).toBeNull();
    });

    it('persists session as in_progress', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();

      store.getState().startSession(exercise, plan);

      await vi.waitFor(() => {
        expect(repository.save).toHaveBeenCalled();
      });
    });
  });

  describe('first set flow', () => {
    beforeEach(() => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
    });

    it('sets error when no session exists', async () => {
      const freshStore = createExerciseSessionStore();
      await freshStore.getState().prepareFirstSet();
      expect(freshStore.getState().error).toBe('No session');
    });

    it('sets error when voltra store not bound', async () => {
      const freshStore = createExerciseSessionStore();
      freshStore.getState().bindRecordingStore(recordingStore);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      freshStore.getState().startSession(exercise, plan);
      await freshStore.getState().prepareFirstSet();
      expect(freshStore.getState().error).toBe('Device not connected');
    });

    it('startFirstSet transitions to countdown with 3 seconds', () => {
      store.getState().startFirstSet();

      const state = store.getState();
      expect(state.uiState).toBe('countdown');
      expect(state.startCountdown).toBe(3);
    });
  });

  describe('countdown timer', () => {
    beforeEach(() => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
    });

    it('decrements countdown on each tick', () => {
      store.getState().startFirstSet();
      expect(store.getState().startCountdown).toBe(3);

      store.getState().tickCountdown();
      expect(store.getState().startCountdown).toBe(2);

      store.getState().tickCountdown();
      expect(store.getState().startCountdown).toBe(1);
    });

    it('transitions to recording when countdown reaches zero', () => {
      store.getState().startFirstSet();

      store.getState().tickCountdown(); // 2
      store.getState().tickCountdown(); // 1
      store.getState().tickCountdown(); // 0 -> recording

      expect(store.getState().uiState).toBe('recording');
    });
  });

  describe('rest timer', () => {
    it('tickRestTimer decrements rest countdown', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      store.setState({ uiState: 'resting', restCountdown: 10 });

      store.getState().tickRestTimer();
      expect(store.getState().restCountdown).toBe(9);
    });

    it('transitions to countdown when rest reaches countdown threshold', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      store.setState({ uiState: 'resting', restCountdown: 4 });

      store.getState().tickRestTimer();
      expect(store.getState().uiState).toBe('countdown');
      expect(store.getState().startCountdown).toBe(3);
      expect(store.getState().restCountdown).toBe(0);
    });
  });

  describe('skipRest()', () => {
    it('skips rest and transitions to countdown', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      store.setState({ uiState: 'resting', restCountdown: 60 });

      store.getState().skipRest();

      expect(store.getState().uiState).toBe('countdown');
      expect(store.getState().startCountdown).toBe(3);
      expect(store.getState().restCountdown).toBe(0);
    });
  });

  describe('onSetCompleted() - session continues', () => {
    it('adds completed set and transitions to resting', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);

      const completedSet = mockCompletedSet({ weight: 135, repCount: 8 });
      await store.getState().onSetCompleted(completedSet);

      const state = store.getState();
      expect(state.uiState).toBe('resting');
      expect(state.completedSetsCount).toBe(1);
      expect(state.restCountdown).toBeGreaterThan(0);
    });
  });

  describe('onSetCompleted() - session terminates', () => {
    it('transitions to results when all sets complete', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(1).build();
      store.getState().startSession(exercise, plan);

      const completedSet = mockCompletedSet({ weight: 135, repCount: 8 });
      await store.getState().onSetCompleted(completedSet);

      const state = store.getState();
      expect(state.uiState).toBe('results');
      expect(state.isComplete).toBe(true);
      expect(state.terminationReason).toBeDefined();
    });
  });

  describe('stopSession()', () => {
    it('transitions to results with user_stopped reason', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);

      await store.getState().stopSession();

      const state = store.getState();
      expect(state.uiState).toBe('results');
      expect(state.terminationReason).toBe('user_stopped');
    });

    it('is a no-op when no session exists', async () => {
      await store.getState().stopSession();
      expect(store.getState().uiState).toBe('idle');
    });
  });

  describe('store bindings', () => {
    it('bindRecordingStore sets internal reference', () => {
      const freshStore = createExerciseSessionStore();
      const rs = createRecordingStore();
      freshStore.getState().bindRecordingStore(rs);
      expect(freshStore.getState()._recordingStore).toBe(rs);
    });

    it('bindVoltraStore sets internal reference', () => {
      const freshStore = createExerciseSessionStore();
      const vs = createMockVoltraStore();
      freshStore.getState().bindVoltraStore(vs);
      expect(freshStore.getState()._voltraStore).toBe(vs);
    });

    it('bindRepository sets internal reference', () => {
      const freshStore = createExerciseSessionStore();
      const repo = createMockRepository();
      freshStore.getState().bindRepository(repo);
      expect(freshStore.getState()._repository).toBe(repo);
    });
  });

  describe('derived state', () => {
    it('computes currentSetIndex from completed sets', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);

      expect(store.getState().currentSetIndex).toBe(0);

      const set1 = mockCompletedSet({ weight: 135, repCount: 8 });
      await store.getState().onSetCompleted(set1);

      expect(store.getState().currentSetIndex).toBe(1);
    });

    it('computes totalSets from plan', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(5).build();
      store.getState().startSession(exercise, plan);

      expect(store.getState().totalSets).toBe(plan.sets.length);
    });

    it('detects discovery session from plan source', () => {
      const exercise = createTestExercise('bench');
      const standardPlan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, standardPlan);
      expect(store.getState().isDiscovery).toBe(false);
    });
  });

  describe('loadCurrentSession()', () => {
    it('sets error when repository not bound', async () => {
      const freshStore = createExerciseSessionStore();
      await freshStore.getState().loadCurrentSession();
      expect(freshStore.getState().error).toBe('Repository not bound');
    });

    it('does nothing when no stored session exists', async () => {
      await store.getState().loadCurrentSession();
      expect(store.getState().session).toBeNull();
    });
  });

  describe('manualStopRecording()', () => {
    it('is a no-op when recording store not bound', () => {
      const freshStore = createExerciseSessionStore();
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      freshStore.getState().startSession(exercise, plan);

      freshStore.getState().manualStopRecording();
      expect(freshStore.getState().uiState).toBe('idle');
    });
  });

  describe('adjustWeight()', () => {
    it('is a no-op when voltra store not bound', async () => {
      const freshStore = createExerciseSessionStore();
      await freshStore.getState().adjustWeight(200);
    });
  });

  describe('dispose()', () => {
    it('sets isDisposed to true', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      expect(store.getState().isDisposed).toBe(false);

      store.getState().dispose();
      expect(store.getState().isDisposed).toBe(true);
      expect(store.getState().session).toBeNull();
      expect(store.getState().uiState).toBe('idle');
    });

    it('clears timers on dispose', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      store.getState().startFirstSet();
      expect(store.getState().uiState).toBe('countdown');

      store.getState().dispose();
      expect(store.getState().uiState).toBe('idle');
    });

    it('startSession resets isDisposed', () => {
      store.getState().dispose();
      expect(store.getState().isDisposed).toBe(true);

      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      expect(store.getState().isDisposed).toBe(false);
    });
  });

  describe('stale state guards', () => {
    it('loadCurrentSession is a no-op after dispose', async () => {
      store.getState().dispose();
      await store.getState().loadCurrentSession();
      expect(store.getState().uiState).toBe('idle');
    });

    it('stopSession is a no-op after dispose', async () => {
      store.getState().dispose();
      await store.getState().stopSession();
      expect(store.getState().uiState).toBe('idle');
    });

    it('prepareFirstSet is a no-op after dispose', async () => {
      store.getState().dispose();
      await store.getState().prepareFirstSet();
      expect(store.getState().uiState).toBe('idle');
    });

    it('onSetCompleted is a no-op after dispose', async () => {
      store.getState().dispose();
      await store.getState().onSetCompleted(mockCompletedSet());
      expect(store.getState().uiState).toBe('idle');
    });
  });

});
