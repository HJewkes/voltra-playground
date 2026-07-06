/**
 * Exercise Session Store — rest-timer cue wiring (VLT-06.10)
 *
 * Integration tests for the wiring that fires haptic/audio cues during the
 * rest countdown: settings load on set completion, warning cues fire at their
 * thresholds when enabled, the complete cue fires when rest ends, and nothing
 * fires when the user has disabled cues. Drives the real store; mocks only the
 * preference reads and the leaf haptic/audio effects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createExerciseSessionStore,
  type ExerciseSessionStoreApi,
} from '../exercise-session-store';
import { createRecordingStore, type RecordingStoreApi } from '../recording-store';
import type { VoltraStoreApi } from '../voltra-store';
import type { ExerciseSessionRepository } from '@/data/exercise-session';
import { planBuilder, createTestExercise, mockCompletedSet } from '@/__fixtures__/generators';
import { isHapticCuesEnabled, isAudioCuesEnabled } from '@/data/preferences';
import { triggerHaptic, triggerNotificationHaptic } from '@/domain/notifications/haptic-service';
import { playAudioCue } from '@/domain/notifications/audio-cue-service';

// Mutable preference state the mocked reads return (toggled per test).
const prefs = vi.hoisted(() => ({ haptic: true, audio: true }));

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
  getRecordingRepository: vi.fn(() => ({ save: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock('@/data/exercise-session', async () => {
  const actual = await vi.importActual('@/data/exercise-session');
  return { ...actual, fromStoredExerciseSession: vi.fn() };
});

vi.mock('@/data/preferences', () => ({
  isHapticCuesEnabled: vi.fn(async () => prefs.haptic),
  isAudioCuesEnabled: vi.fn(async () => prefs.audio),
  isVelocityAutoStopEnabled: vi.fn(async () => false),
  getVelocityAutoStopThreshold: vi.fn(async () => 0.2),
}));

vi.mock('@/domain/notifications/haptic-service', () => ({
  triggerHaptic: vi.fn().mockResolvedValue(undefined),
  triggerNotificationHaptic: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/domain/notifications/audio-cue-service', () => ({
  playAudioCue: vi.fn().mockResolvedValue(undefined),
}));

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

describe('rest-timer cue wiring', () => {
  let store: ExerciseSessionStoreApi;
  let recordingStore: RecordingStoreApi;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    prefs.haptic = true;
    prefs.audio = true;

    store = createExerciseSessionStore();
    recordingStore = createRecordingStore();
    store.getState().bindRecordingStore(recordingStore);
    store.getState().bindVoltraStore(createMockVoltraStore());
    store.getState().bindRepository(createMockRepository());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Complete a set so the store enters 'resting' and loads cue prefs, then clear cue spies. */
  async function enterRestWithLoadedCues(): Promise<void> {
    store
      .getState()
      .startSession(createTestExercise('bench'), planBuilder().workingSets(3).build());
    await store.getState().onSetCompleted(mockCompletedSet({ weight: 135, repCount: 8 }));
    vi.mocked(triggerHaptic).mockClear();
    vi.mocked(triggerNotificationHaptic).mockClear();
    vi.mocked(playAudioCue).mockClear();
  }

  it('loads cue settings through the store on set completion', async () => {
    await enterRestWithLoadedCues();
    expect(isHapticCuesEnabled).toHaveBeenCalled();
    expect(isAudioCuesEnabled).toHaveBeenCalled();
    expect(store.getState().uiState).toBe('resting');
  });

  it('fires warning cues at the 30s threshold when enabled', async () => {
    await enterRestWithLoadedCues();
    store.setState({ uiState: 'resting', restCountdown: 31 });

    store.getState().tickRestTimer(); // -> 30 remaining

    expect(triggerHaptic).toHaveBeenCalledWith('light');
    expect(playAudioCue).toHaveBeenCalledWith('warning');
  });

  it('fires no cues on a non-threshold tick', async () => {
    await enterRestWithLoadedCues();
    store.setState({ uiState: 'resting', restCountdown: 50 });

    store.getState().tickRestTimer(); // -> 49 remaining

    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(playAudioCue).not.toHaveBeenCalled();
  });

  it('fires the complete cue when the rest countdown ends', async () => {
    await enterRestWithLoadedCues();
    store.setState({ uiState: 'resting', restCountdown: 4 });

    store.getState().tickRestTimer(); // -> 3, hands off to countdown = rest ended

    expect(store.getState().uiState).toBe('countdown');
    expect(triggerNotificationHaptic).toHaveBeenCalledWith('success');
    expect(playAudioCue).toHaveBeenCalledWith('complete');
  });

  it('fires no cues when the user has disabled them', async () => {
    prefs.haptic = false;
    prefs.audio = false;
    await enterRestWithLoadedCues();
    store.setState({ uiState: 'resting', restCountdown: 31 });

    store.getState().tickRestTimer(); // -> 30 remaining

    expect(triggerHaptic).not.toHaveBeenCalled();
    expect(triggerNotificationHaptic).not.toHaveBeenCalled();
    expect(playAudioCue).not.toHaveBeenCalled();
  });
});
