/**
 * Recording Store - liveSamples accumulation and eager rep counting tests.
 *
 * Tests:
 * - liveSamples accumulates all samples during recording and resets on restart
 * - Eager rep counting: rep count increments on eccentric→idle transition
 * - No double-counting when the next concentric arrives
 * - Two full reps produce repCount === 2 via eager counting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';
import { createRecordingStore } from '../recording-store';

// Mock debug telemetry to avoid side effects
vi.mock('@/data/provider', () => ({
  isDebugTelemetryEnabled: () => false,
}));

// Mock domain helper — not under test
vi.mock('@/domain/workout', () => ({
  createCompletedSet: vi.fn(),
  getLiveEffortMessage: (_rpe: number, _count: number) => '',
}));

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
) {
  for (const phase of phases) {
    for (let i = 0; i < samplesPerPhase; i++) {
      process(createSample(phase));
    }
  }
}

/** Produce one full rep cycle: CON → HOLD → ECC → IDLE */
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

describe('Recording Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    sampleSeq = 0;
    sampleTime = 1000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // liveSamples accumulation
  // ===========================================================================

  describe('liveSamples accumulation', () => {
    it('accumulates all samples during recording', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      const totalSamples = 10;
      for (let i = 0; i < totalSamples; i++) {
        store.getState().processSample(createSample(MovementPhase.CONCENTRIC));
      }

      expect(store.getState().liveSamples).toHaveLength(totalSamples);
    });

    it('resets liveSamples when recording restarts', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      for (let i = 0; i < 5; i++) {
        store.getState().processSample(createSample(MovementPhase.CONCENTRIC));
      }
      expect(store.getState().liveSamples).toHaveLength(5);

      // Restart recording
      store.getState().startRecording('ex1', 'Bench Press');

      expect(store.getState().liveSamples).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Eager rep counting on eccentric→idle transition
  // ===========================================================================

  describe('eager rep counting on eccentric→idle transition', () => {
    it('increments repCount when idle is reached after eccentric', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      feedPhases(store.getState().processSample.bind(null), fullRepPhases());

      expect(store.getState().repCount).toBe(1);
    });

    it('updates metrics at the idle transition', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      feedPhases(store.getState().processSample.bind(null), fullRepPhases());

      const state = store.getState();
      expect(state.repCount).toBe(1);
      expect(state.rpe).toBeGreaterThan(0);
      expect(state.velocityTrend).toHaveLength(1);
    });
  });

  // ===========================================================================
  // No double-counting when next concentric arrives
  // ===========================================================================

  describe('no double-counting on next concentric', () => {
    it('repCount stays the same when new concentric starts after eager count', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      // Complete one rep cycle
      feedPhases(store.getState().processSample.bind(null), fullRepPhases());
      expect(store.getState().repCount).toBe(1);

      // Start next concentric — library creates a new rep internally,
      // but display count should NOT increment yet
      for (let i = 0; i < 3; i++) {
        store.getState().processSample(createSample(MovementPhase.CONCENTRIC));
      }

      expect(store.getState().repCount).toBe(1);
    });
  });

  // ===========================================================================
  // Standard boundary counting for two full reps
  // ===========================================================================

  describe('two full reps produce correct count', () => {
    it('repCount is 2 after two complete rep cycles', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      // Two full reps: CON→HOLD→ECC→IDLE → CON→HOLD→ECC→IDLE
      feedPhases(store.getState().processSample.bind(null), [
        ...fullRepPhases(),
        ...fullRepPhases(),
      ]);

      expect(store.getState().repCount).toBe(2);
    });

    it('velocityTrend has two entries after two reps', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Bench Press');

      feedPhases(store.getState().processSample.bind(null), [
        ...fullRepPhases(),
        ...fullRepPhases(),
      ]);

      expect(store.getState().velocityTrend).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Regression: rep count accuracy (off-by-one prevention)
  // ===========================================================================

  describe('rep count accuracy', () => {
    it('N full rep cycles produce exactly N reps', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Curl');

      const n = 5;
      const phases = Array.from({ length: n }, () => fullRepPhases()).flat();
      feedPhases(store.getState().processSample.bind(null), phases);

      expect(store.getState().repCount).toBe(5);
    });

    it('ECC samples then IDLE break then 3 reps yields 3 reps (not 4)', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Curl');

      feedPhases(store.getState().processSample.bind(null), [
        MovementPhase.ECCENTRIC,
        MovementPhase.ECCENTRIC,
        MovementPhase.ECCENTRIC,
      ]);

      feedPhases(store.getState().processSample.bind(null), [
        MovementPhase.IDLE,
        MovementPhase.IDLE,
        MovementPhase.IDLE,
      ]);

      const repPhases = Array.from({ length: 3 }, () => fullRepPhases()).flat();
      feedPhases(store.getState().processSample.bind(null), repPhases);

      expect(store.getState().repCount).toBe(3);
    });

    it('initial IDLE burst then 3 reps yields 3 reps', () => {
      const store = createRecordingStore();
      store.getState().startRecording('ex1', 'Curl');

      feedPhases(store.getState().processSample.bind(null), [
        MovementPhase.IDLE,
        MovementPhase.IDLE,
        MovementPhase.IDLE,
        MovementPhase.IDLE,
        MovementPhase.IDLE,
      ]);

      const repPhases = Array.from({ length: 3 }, () => fullRepPhases()).flat();
      feedPhases(store.getState().processSample.bind(null), repPhases);

      expect(store.getState().repCount).toBe(3);
    });
  });
});
