/**
 * Discovery Plan Generator
 *
 * Generates discovery plans with fixed weight increments.
 * Used for initial working weight discovery.
 *
 * Discovery sessions:
 * - Start light and increase weight each set
 * - Use fewer reps to avoid fatigue
 * - Stop when hitting failure or grinding velocity
 * - Build velocity profile for 1RM estimation
 *
 * NOTE: This will move to domain/planning when that domain is created.
 */

import type { ExercisePlan, PlannedSet, TrainingGoal } from '../models/plan';

/**
 * Options for creating a discovery plan.
 */
export interface DiscoveryPlanOptions {
  exerciseId: string;
  goal: TrainingGoal;
  /** Optional: user's estimated max (helps determine starting weight) */
  userEstimate?: number;
  /** Optional: override number of discovery sets (default 8) */
  maxSets?: number;
  /** Optional: override reps per set (default 5) */
  repsPerSet?: number;
}

/**
 * Default discovery parameters.
 */
const DISCOVERY_DEFAULTS = {
  maxSets: 8,
  repsPerSet: 5,
  restSeconds: 60,
  defaultStartWeight: 20,
  defaultIncrement: 20,
  estimateStartPercent: 0.3, // Start at 30% of estimated max
  estimateIncrementPercent: 0.15, // Jump 15% each set
};

/**
 * Generate discovery plan: fixed weight increments.
 *
 * If user provides an estimate, we use it to determine starting weight
 * and increment size. Otherwise, we use conservative defaults.
 *
 * @example
 * // With estimate
 * createDiscoveryPlan({ exerciseId: 'bench_press', goal: 'hypertrophy', userEstimate: 200 });
 * // Starts at 60 lbs (30%), increments by 30 lbs (15%)
 *
 * // Without estimate
 * createDiscoveryPlan({ exerciseId: 'bench_press', goal: 'hypertrophy' });
 * // Starts at 20 lbs, increments by 20 lbs
 */
export function createDiscoveryPlan(options: DiscoveryPlanOptions): ExercisePlan {
  const {
    exerciseId,
    goal,
    userEstimate,
    maxSets = DISCOVERY_DEFAULTS.maxSets,
    repsPerSet = DISCOVERY_DEFAULTS.repsPerSet,
  } = options;

  // Determine starting weight and increment
  let startWeight: number;
  let increment: number;

  if (userEstimate && userEstimate > 0) {
    // Start at 30% of estimated max
    startWeight = roundToNearest5(userEstimate * DISCOVERY_DEFAULTS.estimateStartPercent);
    // Jump ~15% each set
    increment = roundToNearest5(userEstimate * DISCOVERY_DEFAULTS.estimateIncrementPercent);
    // Ensure minimum increment
    increment = Math.max(5, increment);
  } else {
    // Default: start light with fixed increments
    startWeight = DISCOVERY_DEFAULTS.defaultStartWeight;
    increment = DISCOVERY_DEFAULTS.defaultIncrement;
  }

  // Generate weight sequence
  const sets: PlannedSet[] = [];
  for (let i = 0; i < maxSets; i++) {
    const weight = startWeight + i * increment;
    sets.push({
      setNumber: i + 1,
      weight: weight,
      targetReps: repsPerSet,
      rirTarget: 3, // Discovery sets should stop before failure
      isWarmup: false, // Discovery sets build data, not warmups
    });
  }

  return {
    exerciseId,
    sets,
    defaultRestSeconds: DISCOVERY_DEFAULTS.restSeconds,
    goal,
    generatedAt: Date.now(),
    generatedBy: 'discovery',
  };
}

/**
 * Create a discovery plan with custom weight sequence.
 */
export function createDiscoveryPlanWithWeights(
  exerciseId: string,
  weights: number[],
  goal: TrainingGoal,
  repsPerSet: number = DISCOVERY_DEFAULTS.repsPerSet
): ExercisePlan {
  const sets: PlannedSet[] = weights.map((weight, i) => ({
    setNumber: i + 1,
    weight: weight,
    targetReps: repsPerSet,
    rirTarget: 3,
    isWarmup: false,
  }));

  return {
    exerciseId,
    sets,
    defaultRestSeconds: DISCOVERY_DEFAULTS.restSeconds,
    goal,
    generatedAt: Date.now(),
    generatedBy: 'discovery',
  };
}

/**
 * Round to nearest 5 (Voltra weight increment).
 */
function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

/**
 * Calculate recommended next weight for discovery based on current performance.
 *
 * If RPE is very low (< 5), use a larger increment.
 * This helps avoid wasting sets at weights that are too easy.
 */
export function getNextDiscoveryWeight(
  currentWeight: number,
  currentRPE: number,
  baseIncrement: number = 20
): number {
  // If RPE is very low, double the increment to move faster
  const multiplier = currentRPE < 5 ? 2 : 1;
  return currentWeight + baseIncrement * multiplier;
}

/**
 * Check if discovery should continue based on set results.
 *
 * Discovery should stop when:
 * - Failure (0 reps)
 * - Velocity grinding (< 0.3 m/s)
 * - Very high RPE (> 9)
 */
export interface DiscoveryContinuationCheck {
  shouldContinue: boolean;
  reason?: string;
}

export function checkDiscoveryContinuation(
  repsCompleted: number,
  meanVelocity: number,
  rpe?: number
): DiscoveryContinuationCheck {
  // Failure - stop immediately
  if (repsCompleted === 0) {
    return {
      shouldContinue: false,
      reason: 'No reps completed - reached failure',
    };
  }

  // Velocity grinding - stop
  if (meanVelocity < 0.3) {
    return {
      shouldContinue: false,
      reason: 'Velocity too low - near max effort',
    };
  }

  // Very high RPE - stop
  if (rpe && rpe > 9) {
    return {
      shouldContinue: false,
      reason: 'RPE too high - near max effort',
    };
  }

  return { shouldContinue: true };
}
