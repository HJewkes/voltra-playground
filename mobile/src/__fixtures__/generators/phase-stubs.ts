/**
 * Phase Stubs
 *
 * Minimal but valid Phase and Rep objects from the @voltras/workout-analytics
 * library for testing scenarios where phase data isn't the focus of the test.
 *
 * Use these when you need Rep objects but the phase samples/metrics
 * aren't relevant to what you're testing.
 */

import type { Phase, Rep } from '@voltras/workout-analytics';

// =============================================================================
// Phase Stubs
// =============================================================================

export interface StubPhaseOptions {
  meanVelocity?: number;
  peakVelocity?: number;
  force?: number;
  peakForce?: number;
  duration?: number;
  startTime?: number;
  startPosition?: number;
  endPosition?: number;
}

/**
 * Create a minimal but valid library Phase object.
 * Running aggregates are set so library getters return expected values.
 */
export function createStubPhase(options: StubPhaseOptions = {}): Phase {
  const {
    meanVelocity = 0.5,
    peakVelocity = meanVelocity * 1.3,
    force = 80,
    peakForce = force * 1.25,
    duration = 0.8,
    startTime = 0,
    startPosition = 0,
    endPosition = 1,
  } = options;

  const sampleCount = 10;
  return {
    samples: [],
    startTime,
    endTime: startTime + duration * 1000,
    startPosition,
    endPosition,
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
 * Create a stub concentric phase.
 */
export function createStubConcentricPhase(options: Omit<StubPhaseOptions, 'startPosition' | 'endPosition'> = {}): Phase {
  return createStubPhase({ startPosition: 0, endPosition: 1, ...options });
}

/**
 * Create a stub eccentric phase.
 */
export function createStubEccentricPhase(options: Omit<StubPhaseOptions, 'startPosition' | 'endPosition'> = {}): Phase {
  return createStubPhase({
    meanVelocity: 0.3,
    duration: 1.5,
    startPosition: 1,
    endPosition: 0,
    ...options,
  });
}

/**
 * Create a stub hold phase (for top or bottom of rep).
 */
export function createStubHoldPhase(options: StubPhaseOptions = {}): Phase {
  return createStubPhase({
    meanVelocity: 0,
    peakVelocity: 0,
    force: 60,
    peakForce: 70,
    duration: 0.15,
    startPosition: 1,
    endPosition: 1,
    ...options,
  });
}

// =============================================================================
// Rep Stubs
// =============================================================================

export interface StubRepOptions {
  repNumber?: number;
  concentricVelocity?: number;
  eccentricVelocity?: number;
  concentricPeakVelocity?: number;
  eccentricPeakVelocity?: number;
  force?: number;
}

/**
 * Create a minimal but valid library Rep object.
 */
export function createStubRep(options: StubRepOptions = {}): Rep {
  const {
    repNumber = 1,
    concentricVelocity = 0.5,
    eccentricVelocity = 0.3,
    concentricPeakVelocity = concentricVelocity * 1.3,
    eccentricPeakVelocity = eccentricVelocity * 1.3,
    force = 80,
  } = options;

  return {
    repNumber,
    concentric: createStubConcentricPhase({
      meanVelocity: concentricVelocity,
      peakVelocity: concentricPeakVelocity,
      force,
    }),
    eccentric: createStubEccentricPhase({
      meanVelocity: eccentricVelocity,
      peakVelocity: eccentricPeakVelocity,
      force,
    }),
  };
}

/**
 * Create an array of stub reps with optional velocity decline (simulating fatigue).
 */
export function createStubReps(
  count: number,
  options: {
    startVelocity?: number;
    velocityDeclinePerRep?: number;
    baseForce?: number;
  } = {},
): Rep[] {
  const { startVelocity = 0.6, velocityDeclinePerRep = 0.03, baseForce = 80 } = options;

  return Array.from({ length: count }, (_, i) => {
    const velocity = Math.max(0.2, startVelocity - i * velocityDeclinePerRep);
    return createStubRep({
      repNumber: i + 1,
      concentricVelocity: velocity,
      eccentricVelocity: velocity * 0.5,
      force: baseForce,
    });
  });
}
