/**
 * Mock Helpers for Test Fixtures
 *
 * Creates properly-typed mock objects for CompletedSet, AnalyticsSet, Rep,
 * and Phase from the @voltras/workout-analytics library. These mocks produce
 * correct values when used with the library's getter functions.
 *
 * Use these when you need CompletedSet objects with controllable metric values
 * without running the full sample processing pipeline.
 *
 * @example
 * // Simple 5-rep set at 100lbs
 * const set = mockCompletedSet({ weight: 100, repCount: 5 });
 *
 * // Set with specific per-rep velocities
 * const set = mockCompletedSet({
 *   weight: 135,
 *   velocities: [0.7, 0.65, 0.6, 0.55, 0.5],
 * });
 *
 * // Set with explicit reps
 * const set = mockCompletedSet({
 *   weight: 100,
 *   reps: [mockRep(1, 0.6), mockRep(2, 0.55)],
 * });
 */

import type {
  Phase,
  Rep,
  Set as AnalyticsSet,
} from '@voltras/workout-analytics';
import { createCompletedSet, type CompletedSet } from '@/domain/workout/models/completed-set';

/**
 * Create a mock Phase with controllable velocity and force metrics.
 *
 * The running aggregates are set so that library getters return expected values:
 *   getPhaseMeanVelocity(phase) → meanVelocity
 *   getPhasePeakVelocity(phase) → peakVelocity
 *   getPhaseMeanForce(phase) → force
 */
export function mockPhase(overrides: {
  meanVelocity?: number;
  peakVelocity?: number;
  force?: number;
  peakForce?: number;
  duration?: number;
  startTime?: number;
} = {}): Phase {
  const {
    meanVelocity = 0.5,
    peakVelocity = meanVelocity * 1.3,
    force = 80,
    peakForce = force * 1.25,
    duration = 0.8,
    startTime = 0,
  } = overrides;

  const sampleCount = 10;
  const endTime = startTime + duration * 1000;

  return {
    samples: [],
    startTime,
    endTime,
    startPosition: 0,
    endPosition: 1,
    _totalVelocity: meanVelocity * sampleCount,
    _totalForce: force * sampleCount,
    _totalLoad: 0,
    _movementSampleCount: sampleCount,
    _totalHoldDuration: 0,
    peakVelocity,
    peakForce,
    peakLoad: 0,
  };
}

/**
 * Create a mock library Rep with controllable concentric/eccentric velocities.
 *
 * Library getters will return:
 *   getRepMeanVelocity(rep) → concentricVelocity
 *   getRepPeakVelocity(rep) → concentricVelocity * 1.3
 *   getRepEccentricMeanVelocity(rep) → eccentricVelocity
 */
export function mockRep(
  repNumber: number,
  concentricVelocity: number = 0.5,
  eccentricVelocity: number = concentricVelocity * 0.5,
): Rep {
  return {
    repNumber,
    concentric: mockPhase({
      meanVelocity: concentricVelocity,
      peakVelocity: concentricVelocity * 1.3,
      duration: 0.8,
      startTime: 0,
    }),
    eccentric: mockPhase({
      meanVelocity: eccentricVelocity,
      peakVelocity: eccentricVelocity * 1.3,
      duration: 1.5,
      startTime: 800,
    }),
  };
}

/**
 * Create a mock library Set (AnalyticsSet) with controllable rep data.
 *
 * @param reps - Library Rep objects, or auto-generated from repCount/velocities
 */
export function mockAnalyticsSet(options: {
  reps?: readonly Rep[];
  repCount?: number;
  velocities?: number[];
  startVelocity?: number;
  velocityDeclinePerRep?: number;
} = {}): AnalyticsSet {
  const {
    reps: explicitReps,
    repCount = 5,
    velocities,
    startVelocity = 0.6,
    velocityDeclinePerRep = 0.03,
  } = options;

  let reps: readonly Rep[];

  if (explicitReps) {
    reps = explicitReps;
  } else if (velocities) {
    reps = velocities.map((v, i) => mockRep(i + 1, v));
  } else {
    reps = Array.from({ length: repCount }, (_, i) =>
      mockRep(i + 1, Math.max(0.2, startVelocity - i * velocityDeclinePerRep)),
    );
  }

  return { reps };
}

/**
 * Create a mock CompletedSet with controllable properties.
 *
 * This is the primary helper for most test scenarios. It creates a properly-
 * typed CompletedSet with library AnalyticsSet data inside.
 *
 * @example
 * // Basic set
 * mockCompletedSet({ weight: 100, repCount: 5 })
 *
 * // Set with specific velocities (for testing velocity-based logic)
 * mockCompletedSet({ velocities: [0.7, 0.65, 0.6, 0.55, 0.5] })
 *
 * // Set with all metadata
 * mockCompletedSet({
 *   id: 'set-1', exerciseId: 'bench', weight: 135,
 *   repCount: 8, startTime: 1000, endTime: 2000,
 * })
 */
export function mockCompletedSet(overrides: {
  id?: string;
  exerciseId?: string;
  exerciseName?: string;
  weight?: number;
  chains?: number;
  eccentricOffset?: number;
  startTime?: number;
  endTime?: number;
  repCount?: number;
  velocities?: number[];
  startVelocity?: number;
  velocityDeclinePerRep?: number;
  reps?: readonly Rep[];
} = {}): CompletedSet {
  const {
    id,
    exerciseId = 'test_exercise',
    exerciseName = 'Test Exercise',
    weight = 100,
    chains,
    eccentricOffset,
    startTime = 1000,
    endTime = 2000,
    ...setOptions
  } = overrides;

  const data = mockAnalyticsSet(setOptions);

  return createCompletedSet(data, {
    exerciseId,
    exerciseName,
    weight,
    chains,
    eccentricOffset,
    startTime,
    endTime,
    id,
  });
}
