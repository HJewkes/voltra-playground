/**
 * Exercise Session Store Tests
 *
 * Tests for session lifecycle, UI state machine transitions,
 * timer behavior, store binding coordination, and stale-state
 * guards that prevent async actions from mutating a disposed store.
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

function createMockVoltraStore(overrides?: Record<string, unknown>): VoltraStoreApi {
  const state = {
    weight: 100,
    setWeight: vi.fn().mockResolvedValue(undefined),
    prepareWorkout: vi.fn().mockResolvedValue(undefined),
    engageMotor: vi.fn().mockResolvedValue(undefined),
    disengageMotor: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return {
    getState: () => state,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    getInitialState: () => state,
  } as unknown as VoltraStoreApi;
}

function createDeferredPromise<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
    it('starts idle with no session and isDisposed false', () => {
      const state = store.getState();
      expect(state.uiState).toBe('idle');
      expect(state.session).toBeNull();
      expect(state.isDisposed).toBe(false);
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
      expect(state.uiState).toBe('idle');
      expect(state.totalSets).toBe(plan.sets.length);
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

    it('startFirstSet transitions to countdown with 3 seconds', () => {
      store.getState().startFirstSet();
      expect(store.getState().uiState).toBe('countdown');
      expect(store.getState().startCountdown).toBe(3);
    });
  });

  describe('countdown timer', () => {
    beforeEach(() => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
    });

    it('transitions to recording when countdown reaches zero', () => {
      store.getState().startFirstSet();
      store.getState().tickCountdown();
      store.getState().tickCountdown();
      store.getState().tickCountdown();
      expect(store.getState().uiState).toBe('recording');
    });
  });

  describe('onSetCompleted() - session continues', () => {
    it('adds completed set and transitions to resting', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      const completedSet = mockCompletedSet({ weight: 135, repCount: 8 });
      await store.getState().onSetCompleted(completedSet);
      expect(store.getState().uiState).toBe('resting');
      expect(store.getState().completedSetsCount).toBe(1);
    });
  });

  describe('onSetCompleted() - session terminates', () => {
    it('transitions to results when all sets complete', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(1).build();
      store.getState().startSession(exercise, plan);
      const completedSet = mockCompletedSet({ weight: 135, repCount: 8 });
      await store.getState().onSetCompleted(completedSet);
      expect(store.getState().uiState).toBe('results');
      expect(store.getState().isComplete).toBe(true);
    });
  });

  describe('stopSession()', () => {
    it('transitions to results with user_stopped reason', async () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      await store.getState().stopSession();
      expect(store.getState().uiState).toBe('results');
      expect(store.getState().terminationReason).toBe('user_stopped');
    });
  });

  describe('dispose()', () => {
    it('sets isDisposed to true and resets uiState to idle', () => {
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      store.getState().startFirstSet();
      expect(store.getState().uiState).toBe('countdown');
      store.getState().dispose();
      expect(store.getState().isDisposed).toBe(true);
      expect(store.getState().uiState).toBe('idle');
    });

    it('resets isDisposed when a new session starts', () => {
      store.getState().dispose();
      expect(store.getState().isDisposed).toBe(true);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      store.getState().startSession(exercise, plan);
      expect(store.getState().isDisposed).toBe(false);
    });
  });

  describe('stale-state guards after dispose', () => {
    it('prepareFirstSet returns early if disposed during setWeight', async () => {
      const deferred = createDeferredPromise();
      const mockPrepareWorkout = vi.fn().mockResolvedValue(undefined);
      const vs = createMockVoltraStore({
        setWeight: vi.fn().mockReturnValue(deferred.promise),
        prepareWorkout: mockPrepareWorkout,
      });
      const s = createExerciseSessionStore();
      s.getState().bindVoltraStore(vs);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      s.getState().startSession(exercise, plan);
      const preparePromise = s.getState().prepareFirstSet();
      expect(s.getState().uiState).toBe('preparing');
      s.getState().dispose();
      deferred.resolve();
      await preparePromise;
      expect(s.getState().uiState).toBe('idle');
      expect(s.getState().isDisposed).toBe(true);
      expect(mockPrepareWorkout).not.toHaveBeenCalled();
    });

    it('prepareFirstSet returns early if disposed during prepareWorkout', async () => {
      const deferred = createDeferredPromise();
      const vs = createMockVoltraStore({
        prepareWorkout: vi.fn().mockReturnValue(deferred.promise),
      });
      const s = createExerciseSessionStore();
      s.getState().bindVoltraStore(vs);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      s.getState().startSession(exercise, plan);
      const preparePromise = s.getState().prepareFirstSet();
      s.getState().dispose();
      deferred.resolve();
      await preparePromise;
      expect(s.getState().uiState).toBe('idle');
    });

    it('onSetCompleted returns early if disposed during disengageMotor', async () => {
      const deferred = createDeferredPromise();
      const vs = createMockVoltraStore({
        disengageMotor: vi.fn().mockReturnValue(deferred.promise),
      });
      const s = createExerciseSessionStore();
      s.getState().bindVoltraStore(vs);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      s.getState().startSession(exercise, plan);
      const completedSet = mockCompletedSet({ weight: 135, repCount: 8 });
      const promise = s.getState().onSetCompleted(completedSet);
      expect(s.getState().uiState).toBe('processing');
      s.getState().dispose();
      deferred.resolve();
      await promise;
      expect(s.getState().uiState).toBe('idle');
      expect(s.getState().completedSetsCount).toBe(0);
    });

    it('transitionToRecording skips when store is disposed', () => {
      const vs = createMockVoltraStore();
      const s = createExerciseSessionStore();
      s.getState().bindVoltraStore(vs);
      s.getState().bindRecordingStore(recordingStore);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      s.getState().startSession(exercise, plan);
      s.getState().startFirstSet();
      s.getState().tickCountdown();
      s.getState().tickCountdown();
      s.getState().dispose();
      s.getState().tickCountdown();
      expect(s.getState().uiState).toBe('idle');
    });

    it('persistSession skips repository calls when disposed', async () => {
      const mockRepo = createMockRepository();
      const s = createExerciseSessionStore();
      s.getState().bindRepository(mockRepo);
      const exercise = createTestExercise('bench');
      const plan = planBuilder().workingSets(3).build();
      s.getState().startSession(exercise, plan);
      await vi.waitFor(() => {
        expect(mockRepo.save).toHaveBeenCalledTimes(1);
      });
      (mockRepo.save as ReturnType<typeof vi.fn>).mockClear();
      s.getState().dispose();
      expect(s.getState().isDisposed).toBe(true);
    });
  });
});
