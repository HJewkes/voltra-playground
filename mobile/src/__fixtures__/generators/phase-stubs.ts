/**
 * Phase Stubs
 *
 * Minimal but valid Phase objects for testing scenarios where
 * phase data isn't the focus of the test.
 *
 * Use these when you need Rep objects but the phase samples/metrics
 * aren't relevant to what you're testing.
 */

import { MovementPhase } from '@/domain/workout/models/types';
import type { Phase, PhaseMetrics } from '@/domain/workout/models/phase';
import type { Rep, RepMetrics } from '@/domain/workout/models/rep';

// =============================================================================
// Phase Stubs
// =============================================================================

/**
 * Create a minimal but valid Phase object.
 */
export function createStubPhase(type: MovementPhase, options: Partial<PhaseMetrics> = {}): Phase {
  const defaults: PhaseMetrics = {
    duration: type === MovementPhase.CONCENTRIC ? 0.8 : 1.5,
    meanVelocity: type === MovementPhase.CONCENTRIC ? 0.5 : 0.3,
    peakVelocity: type === MovementPhase.CONCENTRIC ? 0.65 : 0.4,
    meanForce: 80,
    peakForce: 100,
    startPosition: type === MovementPhase.CONCENTRIC ? 0 : 1,
    endPosition: type === MovementPhase.CONCENTRIC ? 1 : 0,
  };

  return {
    type,
    timestamp: { start: 0, end: defaults.duration * 1000 },
    samples: [], // Empty - not needed for most tests
    metrics: { ...defaults, ...options },
  };
}

/**
 * Create a stub concentric phase.
 */
export function createStubConcentricPhase(options: Partial<PhaseMetrics> = {}): Phase {
  return createStubPhase(MovementPhase.CONCENTRIC, options);
}

/**
 * Create a stub eccentric phase.
 */
export function createStubEccentricPhase(options: Partial<PhaseMetrics> = {}): Phase {
  return createStubPhase(MovementPhase.ECCENTRIC, options);
}

/**
 * Create a stub hold phase (for top or bottom of rep).
 */
export function createStubHoldPhase(options: Partial<PhaseMetrics> = {}): Phase {
  return createStubPhase(MovementPhase.HOLD, {
    duration: 0.15,
    meanVelocity: 0,
    peakVelocity: 0,
    meanForce: 60,
    peakForce: 70,
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
  /** Concentric metrics (velocity, force, etc.) */
  concentric?: Partial<PhaseMetrics>;
  /** Eccentric metrics */
  eccentric?: Partial<PhaseMetrics>;
  /** Include hold at top of rep */
  includeHoldAtTop?: boolean;
  /** Include hold at bottom of rep */
  includeHoldAtBottom?: boolean;
  /** Override computed rep metrics */
  metrics?: Partial<RepMetrics>;
}

/**
 * Create a minimal but valid Rep object with proper Phase objects.
 */
export function createStubRep(options: StubRepOptions = {}): Rep {
  const {
    repNumber = 1,
    concentric: concentricOpts = {},
    eccentric: eccentricOpts = {},
    includeHoldAtTop = false,
    includeHoldAtBottom = false,
    metrics: metricsOverrides = {},
  } = options;

  const concentricPhase = createStubConcentricPhase(concentricOpts);
  const eccentricPhase = createStubEccentricPhase(eccentricOpts);
  const holdAtTop = includeHoldAtTop ? createStubHoldPhase() : null;
  const holdAtBottom = includeHoldAtBottom
    ? createStubHoldPhase({ startPosition: 0, endPosition: 0 })
    : null;

  // Compute rep metrics from phases
  const defaultMetrics: RepMetrics = {
    totalDuration:
      concentricPhase.metrics.duration +
      eccentricPhase.metrics.duration +
      (holdAtTop?.metrics.duration ?? 0) +
      (holdAtBottom?.metrics.duration ?? 0),
    concentricDuration: concentricPhase.metrics.duration,
    eccentricDuration: eccentricPhase.metrics.duration,
    topPauseTime: holdAtTop?.metrics.duration ?? 0,
    bottomPauseTime: holdAtBottom?.metrics.duration ?? 0,
    tempo: `${eccentricPhase.metrics.duration.toFixed(0)}-${(holdAtTop?.metrics.duration ?? 0).toFixed(0)}-${concentricPhase.metrics.duration.toFixed(0)}-${(holdAtBottom?.metrics.duration ?? 0).toFixed(0)}`,
    concentricMeanVelocity: concentricPhase.metrics.meanVelocity,
    concentricPeakVelocity: concentricPhase.metrics.peakVelocity,
    eccentricMeanVelocity: eccentricPhase.metrics.meanVelocity,
    eccentricPeakVelocity: eccentricPhase.metrics.peakVelocity,
    peakForce: Math.max(concentricPhase.metrics.peakForce, eccentricPhase.metrics.peakForce),
    rangeOfMotion: 1,
  };

  return {
    repNumber,
    timestamp: { start: 0, end: defaultMetrics.totalDuration * 1000 },
    concentric: concentricPhase,
    eccentric: eccentricPhase,
    holdAtTop,
    holdAtBottom,
    metrics: { ...defaultMetrics, ...metricsOverrides },
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
  } = {}
): Rep[] {
  const { startVelocity = 0.6, velocityDeclinePerRep = 0.03, baseForce = 80 } = options;

  return Array.from({ length: count }, (_, i) => {
    const velocity = Math.max(0.2, startVelocity - i * velocityDeclinePerRep);
    return createStubRep({
      repNumber: i + 1,
      concentric: {
        meanVelocity: velocity,
        peakVelocity: velocity + 0.15,
        meanForce: baseForce,
        peakForce: baseForce + 20,
      },
      eccentric: {
        meanVelocity: velocity * 0.5,
        peakVelocity: velocity * 0.6,
      },
    });
  });
}
