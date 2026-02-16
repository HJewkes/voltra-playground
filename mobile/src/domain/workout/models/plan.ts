/**
 * Exercise Plan - Explicit Set Sequence
 *
 * The key insight: a plan is a concrete sequence of intended sets, not abstract rules.
 * A planner generates this sequence; adaptation handles deviations.
 *
 * @example
 * const plan = createStandardPlan('bench-press', 185, 3, 10);
 * // Results in: warmup 95x10, warmup 140x5, working 185x10 x3
 */

import { type TrainingGoal } from '@/domain/planning/types';

// Re-export for convenience
export { TrainingGoal } from '@/domain/planning/types';

/**
 * Tempo target for a set - time in seconds for each phase.
 */
export interface TempoTarget {
  concentric: number;
  eccentric: number;
  pauseTop: number;
  pauseBottom: number;
}

/**
 * Source of plan generation.
 */
export type PlanSource = 'manual' | 'standard' | 'discovery';

/**
 * A single intended set in a plan.
 *
 * Used by both plan generators and the unified planner.
 * Contains all the information needed to execute and adapt a set.
 */
export interface PlannedSet {
  /** Set number in sequence (1-based, for display) */
  setNumber: number;

  /** Target weight in lbs */
  weight: number;

  /** Target number of reps */
  targetReps: number;

  /** Target rep range [min, max] - optional, for double progression */
  repRange?: [number, number];

  /** Target RIR (reps in reserve) / RPE equivalent */
  rirTarget: number;

  /** Is this a warmup set? */
  isWarmup: boolean;

  /** Target tempo for each phase (optional) */
  targetTempo?: TempoTarget;

  /** Target range of motion 0-1 (optional, for partial detection) */
  targetROM?: number;
}

/**
 * The complete plan for an exercise session.
 *
 * Plans are explicit sequences of sets - not rules or templates.
 * Planners (standard-planner, discovery-planner) generate these.
 *
 * Design notes:
 * - No per-set rest - plan-level default, adaptation can adjust based on fatigue
 * - Goal is optional but needed for discovery recommendations
 */
export interface ExercisePlan {
  /** Exercise this plan is for */
  exerciseId: string;

  /** The set sequence (order implies warmup → working progression) */
  sets: PlannedSet[];

  /** Default rest between sets (seconds) */
  defaultRestSeconds: number;

  /** Training goal - for recommendation generation (discovery needs this) */
  goal?: TrainingGoal;

  /** When the plan was generated */
  generatedAt: number;

  /** How the plan was generated */
  generatedBy: PlanSource;
}

/**
 * Create an empty plan for an exercise.
 */
export function createEmptyPlan(exerciseId: string): ExercisePlan {
  return {
    exerciseId,
    sets: [],
    defaultRestSeconds: 90,
    generatedAt: Date.now(),
    generatedBy: 'manual',
  };
}

/**
 * Get the current set index based on completed sets count.
 */
export function getCurrentSetIndex(plan: ExercisePlan, completedCount: number): number {
  return Math.min(completedCount, plan.sets.length - 1);
}

/**
 * Get the planned set at a given index.
 */
export function getPlannedSet(plan: ExercisePlan, index: number): PlannedSet | undefined {
  return plan.sets[index];
}

/**
 * Check if a plan is a discovery plan.
 */
export function isDiscoveryPlan(plan: ExercisePlan): boolean {
  return plan.generatedBy === 'discovery';
}

/**
 * Get total planned volume (weight × reps) for a plan.
 */
export function getPlanVolume(plan: ExercisePlan): number {
  return plan.sets.reduce((total, set) => total + set.weight * set.targetReps, 0);
}
