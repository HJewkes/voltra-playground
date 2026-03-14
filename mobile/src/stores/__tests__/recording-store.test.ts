/**
 * Recording Store Tests
 *
 * Tests for single-set recording lifecycle, sample processing,
 * metric updates, reset behavior, and throttled set() calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';
import { createRecordingStore, type RecordingStoreApi } from '../recording-store';
import { isDebugTelemetryEnabled } from '@/data/provider';

// Mock debug telemetry as disabled by default
vi.mock('@/data/provider', () => ({
  isDebugTelemetryEnabled: vi.fn(() => false),
}));

const mockIsDebugEnabled = vi.mocked(isDebugTelemetryEnabled);

// =============================================================================
// Helpers
// =============================================================================

let sampleSeq = 0;
let sampleTime = 1000;

function createSample(
  phase: MovementPhase,
  overrides?: Partial<WorkoutSample>,
): WorkoutSample {
  return {
    sequence: sampleSeq++,
    timestamp: (sampleTime += 50),
    phase,
    position:
      phase === MovementPhase.CONCENTRIC
        ? 0.5
        : phase === MovementPhase.ECCENTRIC
          ? 0.3
          : 0,
    velocity:
      phase === MovementPhase.CONCENTRIC
        ? 0.5
        : phase === MovementPhase.ECCENTRIC
          ? 0.3
          : 0,
    force:
      phase === MovementPhase.CONCENTRIC
        ? 100
        : phase === MovementPhase.ECCENTRIC
          ? 80
          : 0,
    ...overrides,
  };
}

/** Feed a sequence of phases through processSample. */
function feedPhases(
  process: (s: WorkoutSample) => void,
  phases: MovementPhase[],
  samplesPerPhase = 3,
): void {
  for (const phase of phases) {
    for (let i = 0; i < samplesPerPhase; i++) {
      process(createSample(phase));
    }
  }
}

/** Produce one full rep cycle: CON -> HOLD -> ECC -> IDLE */
function fullRepPhases(): MovementPhase[] {
  return [
    MovementPhase.CONCENTRIC,
    MovementPhase.HOLD,
    MovementPhase.ECCENTRIC,
    MovementPhase.IDLE,
  ];
}

// =============================================================================
// Tests
// =============================================================================

describe('RecordingStore', () => {
  let store: RecordingStoreApi;

  beforeEach(() => {
    store = createRecordingStore();
    mockIsDebugEnabled.mockReturnValue(false);
    sampleSeq = 0;
    sampleTime = 1000;
  });

  describe('initial state', () => {
    it('starts in idle with no active recording', () => {
      const state = store.getState();

      expect(state.uiState).toBe('idle');
      expect(state.isRecording).toBe(false);
      expect(state.exerciseId).toBeNull();
      expect(state.repCount).toBe(0);
      expect(state.lastRepPeakVelocity).toBeNull();
      expect(state.lastSet).toBeNull();
    });
  });

  describe('startRecording()', () => {
    it('transitions to recording state with exercise context', () => {
      store.getState().startRecording('bench_press', 'Bench Press');
      const state = store.getState();

      expect(state.uiState).toBe('recording');
      expect(state.isRecording).toBe(true);
      expect(state.exerciseId).toBe('bench_press');
      expect(state.exerciseName).toBe('Bench Press');
      expect(state.startTime).toBeTypeOf('number');
    });

    it('resets metrics from previous recording', () => {
      store.getState().startRecording('ex1', 'Exercise 1');
      store.getState().startRecording('ex2', 'Exercise 2');
      const state = store.getState();

      expect(state.repCount).toBe(0);
      expect(state.lastRepPeakVelocity).toBeNull();
      expect(state.velocityLoss).toBe(0);
      expect(state.velocityTrend).toEqual([]);
      expect(state.allSamples).toEqual([]);
    });

    it('defaults exerciseName when not provided', () => {
      store.getState().startRecording();
      expect(store.getState().exerciseName).toBe('Workout');
    });
  });

  describe('stopRecording()', () => {
    it('returns null when no reps were recorded', () => {
      store.getState().startRecording('bench', 'Bench');
      const result = store.getState().stopRecording(135);

      expect(result).toBeNull();
      expect(store.getState().uiState).toBe('idle');
      expect(store.getState().isRecording).toBe(false);
    });

    it('returns null when not recording', () => {
      const result = store.getState().stopRecording(100);
      expect(result).toBeNull();
    });
  });

  describe('processSample()', () => {
    it('ignores samples when not recording', () => {
      const sample = createSample(MovementPhase.CONCENTRIC);
      store.getState().processSample(sample);
      expect(store.getState().repCount).toBe(0);
    });

    it('accumulates samples in allSamples when debug telemetry enabled', () => {
      mockIsDebugEnabled.mockReturnValue(true);

      store.getState().startRecording('bench', 'Bench');
      const sample = createSample(MovementPhase.CONCENTRIC);
      store.getState().processSample(sample);

      expect(store.getState().allSamples).toHaveLength(1);
      expect(store.getState().allSamples[0]).toEqual(sample);
    });

    it('does not accumulate samples when debug telemetry disabled', () => {
      mockIsDebugEnabled.mockReturnValue(false);

      store.getState().startRecording('bench', 'Bench');
      store.getState().processSample(createSample(MovementPhase.CONCENTRIC));

      expect(store.getState().allSamples).toHaveLength(0);
    });

    it('increments repCount after a full rep cycle', () => {
      store.getState().startRecording('bench', 'Bench');
      feedPhases(store.getState().processSample.bind(null), fullRepPhases());

      expect(store.getState().repCount).toBe(1);
    });

    it('updates velocity metrics after rep completion', () => {
      store.getState().startRecording('bench', 'Bench');
      feedPhases(store.getState().processSample.bind(null), fullRepPhases());

      const state = store.getState();
      expect(state.velocityTrend).toHaveLength(1);
      expect(state.rpe).toBeGreaterThan(0);
    });

    it('counts two reps after two full cycles', () => {
      store.getState().startRecording('bench', 'Bench');
      feedPhases(store.getState().processSample.bind(null), [
        ...fullRepPhases(),
        ...fullRepPhases(),
      ]);

      expect(store.getState().repCount).toBe(2);
      expect(store.getState().velocityTrend).toHaveLength(2);
    });
  });

  describe('setUIState()', () => {
    it('updates UI state independently', () => {
      store.getState().setUIState('countdown');
      expect(store.getState().uiState).toBe('countdown');

      store.getState().setUIState('resting');
      expect(store.getState().uiState).toBe('resting');
    });
  });

  describe('reset()', () => {
    it('restores all state to initial values', () => {
      store.getState().startRecording('bench', 'Bench Press');
      store.getState().reset();
      const state = store.getState();

      expect(state.uiState).toBe('idle');
      expect(state.isRecording).toBe(false);
      expect(state.exerciseId).toBeNull();
      expect(state.exerciseName).toBe('Workout');
      expect(state.repCount).toBe(0);
      expect(state.lastRepPeakVelocity).toBeNull();
      expect(state.velocityLoss).toBe(0);
      expect(state.velocityTrend).toEqual([]);
      expect(state.allSamples).toEqual([]);
      expect(state.lastSet).toBeNull();
    });

    it('creates fresh analytics set after reset', () => {
      store.getState().startRecording('ex1', 'Ex 1');
      store.getState().reset();
      store.getState().startRecording('ex2', 'Ex 2');

      expect(store.getState().repCount).toBe(0);
      expect(store.getState().isRecording).toBe(true);
    });
  });

  describe('throttled set() calls', () => {
    it('fires fewer set() calls than processSample() calls', () => {
      store.getState().startRecording('bench', 'Bench');

      for (let i = 0; i < 20; i++) {
        store.getState().processSample(createSample(MovementPhase.IDLE));
      }

      const stats = store._getThrottleStats();
      expect(stats.sampleCount).toBe(20);
      expect(stats.setCallCount).toBeLessThan(stats.sampleCount);
      expect(stats.setCallCount).toBeGreaterThan(0);
    });

    it('fires set() on phase transitions', () => {
      store.getState().startRecording('bench', 'Bench');

      store.getState().processSample(createSample(MovementPhase.IDLE));
      const countBefore = store._getThrottleStats().setCallCount;

      store.getState().processSample(
        createSample(MovementPhase.CONCENTRIC, { timestamp: sampleTime + 1 }),
      );

      expect(store._getThrottleStats().setCallCount).toBeGreaterThan(countBefore);
    });

    it('fires set() on rep completion', () => {
      store.getState().startRecording('bench', 'Bench');

      const countBefore = store._getThrottleStats().setCallCount;
      feedPhases(store.getState().processSample.bind(null), fullRepPhases());

      expect(store._getThrottleStats().setCallCount).toBeGreaterThan(countBefore);
      expect(store.getState().repCount).toBe(1);
    });

    it('reduces set() calls by >50% for sustained same-phase samples', () => {
      store.getState().startRecording('bench', 'Bench');

      for (let i = 0; i < 100; i++) {
        store.getState().processSample(createSample(MovementPhase.IDLE));
      }

      const stats = store._getThrottleStats();
      expect(stats.sampleCount).toBe(100);
      // 100 samples * 50ms = 5000ms total. 5000/250 = 20 max throttle flushes.
      expect(stats.setCallCount).toBeLessThanOrEqual(25);
      expect(stats.setCallCount).toBeGreaterThan(0);
    });

    it('ring buffer receives every sample regardless of throttling', () => {
      store.getState().startRecording('bench', 'Bench');

      const sampleCount = 50;
      for (let i = 0; i < sampleCount; i++) {
        store.getState().processSample(createSample(MovementPhase.IDLE));
      }

      expect(store.getTelemetryBuffer().length).toBe(sampleCount);
    });

    it('flushes pending debug samples on phase change', () => {
      mockIsDebugEnabled.mockReturnValue(true);
      store.getState().startRecording('bench', 'Bench');

      for (let i = 0; i < 10; i++) {
        store.getState().processSample(createSample(MovementPhase.IDLE));
      }

      // Phase change flushes all pending debug samples
      store.getState().processSample(createSample(MovementPhase.CONCENTRIC));

      expect(store.getState().allSamples).toHaveLength(11);
    });

    it('resets throttle stats on startRecording', () => {
      store.getState().startRecording('bench', 'Bench');
      store.getState().processSample(createSample(MovementPhase.IDLE));
      expect(store._getThrottleStats().sampleCount).toBe(1);

      store.getState().startRecording('bench', 'Bench');
      expect(store._getThrottleStats().sampleCount).toBe(0);
      expect(store._getThrottleStats().setCallCount).toBe(0);
    });
  });
});
