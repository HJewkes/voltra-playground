/**
 * Velocity Auto-Stop Integration Tests
 *
 * Tests the recording store auto-stop pipeline: config, warmup guards,
 * rep count guards, and callback lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';
import { createRecordingStore, type RecordingStoreApi } from '../recording-store';

vi.mock('@/data/provider', () => ({
  isDebugTelemetryEnabled: vi.fn(() => false),
}));

let sampleSeq = 0;
let sampleTime = 1000;

function createSample(phase: MovementPhase, overrides?: Partial<WorkoutSample>): WorkoutSample {
  return {
    sequence: sampleSeq++,
    timestamp: (sampleTime += 50),
    phase,
    position: phase === MovementPhase.CONCENTRIC ? 0.5 : 0,
    velocity: phase === MovementPhase.CONCENTRIC ? 0.5 : 0,
    force: phase === MovementPhase.CONCENTRIC ? 100 : 0,
    ...overrides,
  };
}

function feedRepWithVelocity(
  store: RecordingStoreApi,
  velocity: number,
  samplesPerPhase = 3
): void {
  const process = store.getState().processSample;
  for (let i = 0; i < samplesPerPhase; i++) {
    process(
      createSample(MovementPhase.CONCENTRIC, {
        velocity,
        position: 0.3 + i * 0.2,
        force: velocity * 200,
      })
    );
  }
  for (let i = 0; i < samplesPerPhase; i++) {
    process(createSample(MovementPhase.HOLD, { velocity: 0, position: 1.0, force: 50 }));
  }
  for (let i = 0; i < samplesPerPhase; i++) {
    process(
      createSample(MovementPhase.ECCENTRIC, {
        velocity: velocity * 0.5,
        position: 1.0 - i * 0.3,
        force: velocity * 150,
      })
    );
  }
  for (let i = 0; i < samplesPerPhase; i++) {
    process(createSample(MovementPhase.IDLE, { velocity: 0, position: 0, force: 0 }));
  }
}

describe('Velocity Auto-Stop Integration', () => {
  let store: RecordingStoreApi;

  beforeEach(() => {
    store = createRecordingStore();
    sampleSeq = 0;
    sampleTime = 1000;
  });

  it('does not fire callback when auto-stop is disabled', () => {
    const onAutoStop = vi.fn();
    store.setAutoStopConfig({ enabled: false, thresholdPct: 20 });
    store.setIsWarmupSet(false);
    store.setOnAutoStop(onAutoStop);

    store.getState().startRecording('bench', 'Bench');
    feedRepWithVelocity(store, 0.8);
    feedRepWithVelocity(store, 0.7);
    feedRepWithVelocity(store, 0.5);
    feedRepWithVelocity(store, 0.4);
    feedRepWithVelocity(store, 0.3);

    expect(onAutoStop).not.toHaveBeenCalled();
  });

  it('does not fire callback on warmup sets', () => {
    const onAutoStop = vi.fn();
    store.setAutoStopConfig({ enabled: true, thresholdPct: 20 });
    store.setIsWarmupSet(true);
    store.setOnAutoStop(onAutoStop);

    store.getState().startRecording('bench', 'Bench');
    feedRepWithVelocity(store, 0.8);
    feedRepWithVelocity(store, 0.7);
    feedRepWithVelocity(store, 0.5);
    feedRepWithVelocity(store, 0.4);
    feedRepWithVelocity(store, 0.3);

    expect(onAutoStop).not.toHaveBeenCalled();
  });

  it('does not fire callback with fewer than 3 reps', () => {
    const onAutoStop = vi.fn();
    store.setAutoStopConfig({ enabled: true, thresholdPct: 20 });
    store.setIsWarmupSet(false);
    store.setOnAutoStop(onAutoStop);

    store.getState().startRecording('bench', 'Bench');
    feedRepWithVelocity(store, 0.8);
    feedRepWithVelocity(store, 0.3);

    expect(onAutoStop).not.toHaveBeenCalled();
  });

  it('resets auto-stop tracker on startRecording', () => {
    const onAutoStop = vi.fn();
    store.setAutoStopConfig({ enabled: true, thresholdPct: 20 });
    store.setIsWarmupSet(false);
    store.setOnAutoStop(onAutoStop);

    store.getState().startRecording('bench', 'Bench');
    feedRepWithVelocity(store, 0.8);
    feedRepWithVelocity(store, 0.7);
    feedRepWithVelocity(store, 0.5);

    store.getState().startRecording('bench', 'Bench');
    feedRepWithVelocity(store, 0.8);
    feedRepWithVelocity(store, 0.75);
    feedRepWithVelocity(store, 0.7);

    expect(onAutoStop).not.toHaveBeenCalled();
  });

  it('clears callback when set to null', () => {
    const onAutoStop = vi.fn();
    store.setAutoStopConfig({ enabled: true, thresholdPct: 20 });
    store.setIsWarmupSet(false);
    store.setOnAutoStop(onAutoStop);
    store.setOnAutoStop(null);

    store.getState().startRecording('bench', 'Bench');
    feedRepWithVelocity(store, 0.8);
    feedRepWithVelocity(store, 0.7);
    feedRepWithVelocity(store, 0.5);
    feedRepWithVelocity(store, 0.4);
    feedRepWithVelocity(store, 0.3);

    expect(onAutoStop).not.toHaveBeenCalled();
  });
});
