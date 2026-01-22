/**
 * Standard Plan Generator
 *
 * Generates simple plans with warmups + working sets.
 * Uses fixed percentages for warmup progression.
 *
 * NOTE: This will move to domain/planning when that domain is created.
 */

import type { ExercisePlan, PlannedSet, TrainingGoal } from '../models/plan';

/**
 * Options for creating a standard plan.
 */
export interface StandardPlanOptions {
  exerciseId: string;
  workingWeight: number;
  workingSets?: number;
  workingReps?: number;
  restSeconds?: number;
  goal?: TrainingGoal;
  includeWarmups?: boolean;
}

/**
 * Default warmup percentages: [percentOfWorking, reps]
 */
const DEFAULT_WARMUP_SCHEME: [number, number][] = [
  [0.5, 10], // 50% x 10
  [0.75, 5], // 75% x 5
];

/**
 * Generate a simple plan: warmups + working sets.
 *
 * @example
 * const plan = createStandardPlan({
 *   exerciseId: 'bench_press',
 *   workingWeight: 185,
 *   workingSets: 3,
 *   workingReps: 10,
 * });
 * // Results in: warmup 95x10, warmup 140x5, working 185x10 x3
 */
export function createStandardPlan(options: StandardPlanOptions): ExercisePlan {
  const {
    exerciseId,
    workingWeight,
    workingSets = 3,
    workingReps = 10,
    restSeconds = 90,
    goal,
    includeWarmups = false, // Default to false for simpler UX
  } = options;

  const sets: PlannedSet[] = [];
  let setNumber = 1;

  // Add warmup sets
  if (includeWarmups && workingWeight > 0) {
    for (const [percent, reps] of DEFAULT_WARMUP_SCHEME) {
      const warmupWeight = roundToNearest5(workingWeight * percent);
      // Only add warmup if it's meaningfully different from working weight
      if (warmupWeight < workingWeight - 5) {
        sets.push({
          setNumber: setNumber++,
          weight: Math.max(5, warmupWeight),
          targetReps: reps,
          rirTarget: 5, // Warmups are easy
          isWarmup: true,
        });
      }
    }
  }

  // Add working sets
  for (let i = 0; i < workingSets; i++) {
    sets.push({
      setNumber: setNumber++,
      weight: workingWeight,
      targetReps: workingReps,
      rirTarget: 2, // Default RIR for working sets
      isWarmup: false,
    });
  }

  return {
    exerciseId,
    sets,
    defaultRestSeconds: restSeconds,
    goal,
    generatedAt: Date.now(),
    generatedBy: 'standard',
  };
}

/**
 * Generate a plan with custom warmup percentages.
 */
export function createStandardPlanWithWarmups(
  options: StandardPlanOptions,
  warmupScheme: [number, number][]
): ExercisePlan {
  const {
    exerciseId,
    workingWeight,
    workingSets = 3,
    workingReps = 10,
    restSeconds = 90,
    goal,
  } = options;

  const sets: PlannedSet[] = [];
  let setNumber = 1;

  // Add warmup sets from custom scheme
  if (workingWeight > 0) {
    for (const [percent, reps] of warmupScheme) {
      const warmupWeight = roundToNearest5(workingWeight * percent);
      if (warmupWeight < workingWeight) {
        sets.push({
          setNumber: setNumber++,
          weight: Math.max(5, warmupWeight),
          targetReps: reps,
          rirTarget: 5,
          isWarmup: true,
        });
      }
    }
  }

  // Add working sets
  for (let i = 0; i < workingSets; i++) {
    sets.push({
      setNumber: setNumber++,
      weight: workingWeight,
      targetReps: workingReps,
      rirTarget: 2,
      isWarmup: false,
    });
  }

  return {
    exerciseId,
    sets,
    defaultRestSeconds: restSeconds,
    goal,
    generatedAt: Date.now(),
    generatedBy: 'standard',
  };
}

/**
 * Round to nearest 5 (Voltra weight increment).
 */
function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

/**
 * Get recommended rest seconds based on training goal.
 */
export function getRecommendedRest(goal?: TrainingGoal): number {
  switch (goal) {
    case 'strength':
      return 180; // 3 minutes
    case 'hypertrophy':
      return 120; // 2 minutes
    case 'endurance':
      return 75; // 1:15
    default:
      return 90; // Default
  }
}

/**
 * Get recommended rep range based on training goal.
 */
export function getRecommendedRepRange(goal?: TrainingGoal): [number, number] {
  switch (goal) {
    case 'strength':
      return [3, 6];
    case 'hypertrophy':
      return [8, 12];
    case 'endurance':
      return [15, 20];
    default:
      return [8, 12];
  }
}
