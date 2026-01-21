/**
 * Exercise Session - Plan Execution State
 *
 * An exercise session is a plan (sequence of PlannedSet targets) plus the recorded actuals.
 * State is derived from data, not stored explicitly.
 *
 * Design notes:
 * - completedSets.length tells us where we are in the plan
 * - plan.sets[i] corresponds to completedSets[i] (zip by index)
 * - Status is derived from comparing lengths
 * - Profile/recommendation derived from completed sets (not stored)
 * - Simpler, less state to sync, no stale derived data
 */

import type { Set } from './set';
import type { Exercise } from '@/domain/exercise';
import type { ExercisePlan, PlannedSet } from './plan';

/**
 * Exercise session - runtime state during exercise execution.
 *
 * Everything else is derived:
 * - currentSetIndex = completedSets.length
 * - currentPlannedSet = plan.sets[completedSets.length]
 * - isResting = restEndsAt !== null && Date.now() < restEndsAt
 * - isComplete = completedSets.length >= plan.sets.length
 * - isDiscovery = plan.generatedBy === 'discovery'
 *
 * Derived on demand (not stored):
 * - velocityProfile = buildLoadVelocityProfile(exerciseId, completedSets)
 * - recommendation = generateWorkingWeightRecommendation(velocityProfile, plan.goal)
 */
export interface ExerciseSession {
  /** Unique session identifier */
  id: string;

  /** Exercise being performed */
  exercise: Exercise;

  /** The plan being executed */
  plan: ExercisePlan;

  /** Actual sets performed - index matches plan.sets index */
  completedSets: Set[];

  /** Rest state - timestamp when rest ends (null if not resting) */
  restEndsAt: number | null;

  /** When the session started */
  startedAt: number;
}

// =============================================================================
// Session Factory
// =============================================================================

/**
 * Create a new exercise session.
 */
export function createExerciseSession(exercise: Exercise, plan: ExercisePlan): ExerciseSession {
  return {
    id: generateSessionId(),
    exercise,
    plan,
    completedSets: [],
    restEndsAt: null,
    startedAt: Date.now(),
  };
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// Derived State Helpers
// =============================================================================

/**
 * Get the current set index (0-based).
 */
export function getSessionCurrentSetIndex(session: ExerciseSession): number {
  return session.completedSets.length;
}

/**
 * Get the current planned set (next to be performed).
 */
export function getCurrentPlannedSet(session: ExerciseSession): PlannedSet | undefined {
  const index = getSessionCurrentSetIndex(session);
  return session.plan.sets[index];
}

/**
 * Check if the session is currently in rest period.
 */
export function isResting(session: ExerciseSession): boolean {
  return session.restEndsAt !== null && Date.now() < session.restEndsAt;
}

/**
 * Get remaining rest time in seconds.
 */
export function getRemainingRestSeconds(session: ExerciseSession): number {
  if (!session.restEndsAt) return 0;
  const remaining = Math.max(0, session.restEndsAt - Date.now());
  return Math.ceil(remaining / 1000);
}

/**
 * Check if the session is complete (all planned sets done).
 */
export function isSessionComplete(session: ExerciseSession): boolean {
  return session.completedSets.length >= session.plan.sets.length;
}

/**
 * Check if this is a discovery session.
 */
export function isDiscoverySession(session: ExerciseSession): boolean {
  return session.plan.generatedBy === 'discovery';
}

/**
 * Get total completed volume (weight × reps).
 */
export function getCompletedVolume(session: ExerciseSession): number {
  return session.completedSets.reduce((total, set) => total + set.weight * set.reps.length, 0);
}

/**
 * Get total completed reps.
 */
export function getTotalReps(session: ExerciseSession): number {
  return session.completedSets.reduce((total, set) => total + set.reps.length, 0);
}

// =============================================================================
// Session Mutations (return new session)
// =============================================================================

/**
 * Add a completed set to the session.
 */
export function addCompletedSet(session: ExerciseSession, set: Set): ExerciseSession {
  return {
    ...session,
    completedSets: [...session.completedSets, set],
  };
}

/**
 * Start rest period.
 */
export function startRest(session: ExerciseSession, restSeconds: number): ExerciseSession {
  return {
    ...session,
    restEndsAt: Date.now() + restSeconds * 1000,
  };
}

/**
 * Clear rest period.
 */
export function clearRest(session: ExerciseSession): ExerciseSession {
  return {
    ...session,
    restEndsAt: null,
  };
}

// =============================================================================
// Comparison Helpers
// =============================================================================

/**
 * Compare a completed set against its planned target.
 */
export interface SetComparison {
  planned: PlannedSet;
  actual: Set;
  repsDelta: number; // positive = exceeded, negative = missed
  weightDelta: number; // positive = heavier, negative = lighter
}

/**
 * Get comparison between planned and actual for a set index.
 */
export function compareSetAtIndex(
  session: ExerciseSession,
  index: number
): SetComparison | undefined {
  const planned = session.plan.sets[index];
  const actual = session.completedSets[index];

  if (!planned || !actual) return undefined;

  return {
    planned,
    actual,
    repsDelta: actual.reps.length - planned.targetReps,
    weightDelta: actual.weight - planned.weight,
  };
}

/**
 * Get all set comparisons for the session.
 */
export function getAllSetComparisons(session: ExerciseSession): SetComparison[] {
  const comparisons: SetComparison[] = [];

  for (let i = 0; i < session.completedSets.length; i++) {
    const comparison = compareSetAtIndex(session, i);
    if (comparison) {
      comparisons.push(comparison);
    }
  }

  return comparisons;
}
