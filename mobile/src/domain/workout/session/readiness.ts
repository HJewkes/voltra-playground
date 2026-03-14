/**
 * Readiness Assessment
 *
 * Compares warmup set velocity to historical baseline to estimate
 * athlete readiness. Uses computeReadiness from @voltras/workout-analytics
 * for the core velocity ratio calculation, then layers on intensity
 * adjustment suggestions.
 *
 * Integration point: called after first set completion at a familiar load,
 * before working sets begin.
 */

import {
  computeReadiness,
  getSetFirstRepVelocity,
  type ReadinessEstimate,
} from '@voltras/workout-analytics';
import type { CompletedSet } from '../models/completed-set';
import type { VelocityBaseline } from '@/domain/history/models';
import { interpolateVelocity } from '@/domain/history/services/baseline-service';

/**
 * Intensity adjustment suggestion based on readiness.
 */
export interface IntensityAdjustment {
  /** Suggested load multiplier (e.g. 0.95 = reduce 5%) */
  readonly loadMultiplier: number;
  /** Human-readable suggestion */
  readonly suggestion: string;
}

/**
 * Full readiness assessment including the library estimate and adjustment.
 */
export interface ReadinessAssessment {
  /** Core readiness estimate from workout-analytics */
  readonly estimate: ReadinessEstimate;
  /** Suggested intensity adjustment */
  readonly adjustment: IntensityAdjustment;
  /** Whether baseline data was available */
  readonly hasBaseline: boolean;
}

/**
 * Derive an intensity adjustment from a readiness zone and velocity ratio.
 */
export function deriveIntensityAdjustment(
  zone: ReadinessEstimate['zone'],
  velocityRatio: number,
): IntensityAdjustment {
  switch (zone) {
    case 'green':
      return {
        loadMultiplier: 1.0,
        suggestion: 'Feeling strong — proceed as planned',
      };
    case 'yellow': {
      const deficit = Math.round((1 - velocityRatio) * 100);
      return {
        loadMultiplier: 0.95,
        suggestion: `Velocity ${deficit}% below baseline — consider reducing load 5%`,
      };
    }
    case 'red': {
      const deficit = Math.round((1 - velocityRatio) * 100);
      return {
        loadMultiplier: 0.9,
        suggestion: `Velocity ${deficit}% below baseline — reduce load 10%`,
      };
    }
  }
}

/**
 * Assess readiness from a warmup set compared to historical baseline.
 *
 * Returns null if the set has no reps or velocity data is invalid.
 */
export function assessReadiness(
  warmupSet: CompletedSet,
  baseline: VelocityBaseline,
): ReadinessAssessment | null {
  const actualVelocity = getSetFirstRepVelocity(warmupSet.data);
  if (actualVelocity <= 0) return null;

  const baselineVelocity = interpolateVelocity(baseline, warmupSet.weight);
  if (baselineVelocity === null || baselineVelocity <= 0) {
    return {
      estimate: { zone: 'yellow', velocityRatio: 0, confidence: 0 },
      adjustment: {
        loadMultiplier: 1.0,
        suggestion: 'No baseline data — proceed with caution',
      },
      hasBaseline: false,
    };
  }

  const estimate = computeReadiness(actualVelocity, baselineVelocity);
  const adjustment = deriveIntensityAdjustment(estimate.zone, estimate.velocityRatio);

  return { estimate, adjustment, hasBaseline: true };
}

/**
 * Check whether a completed set qualifies as a readiness check candidate.
 *
 * A set qualifies when:
 * 1. It is the first set in the session (index 0)
 * 2. It has at least one rep with measurable velocity
 * 3. Baseline data exists for that exercise at that weight
 */
export function isReadinessCheckCandidate(
  setIndex: number,
  set: CompletedSet,
  baseline: VelocityBaseline | null,
): boolean {
  if (setIndex !== 0) return false;
  if (set.data.reps.length === 0) return false;
  if (getSetFirstRepVelocity(set.data) <= 0) return false;
  if (!baseline || baseline.dataPoints.length === 0) return false;
  return true;
}
