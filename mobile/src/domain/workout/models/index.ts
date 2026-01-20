/**
 * Workout models - hardware-agnostic exercise data structures.
 */

// Types
export { MovementPhase, PhaseNames } from './types';

// Sample
export type { WorkoutSample } from './sample';
export { createSample } from './sample';

// Phase
export type { Phase, PhaseMetrics } from './phase';

// Rep
export type { Rep, RepMetrics, StoredRep } from './rep';
export { createRep } from './rep';

// Set
export type {
  Set,
  SetMetrics,
  VelocityMetrics,
  FatigueAnalysis,
  EffortEstimate,
  TempoTarget,
} from './set';

// Stats (recording session aggregates)
export type { WorkoutStats } from './stats';
export { computeWorkoutStats, createEmptyWorkoutStats } from './stats';

// Plan
export type { PlannedSet, ExercisePlan, PlanSource, TrainingGoal } from './plan';
export {
  createEmptyPlan,
  getCurrentSetIndex,
  getPlannedSet,
  isDiscoveryPlan,
  getPlanVolume,
} from './plan';

// Session
export type { ExerciseSession, SetComparison } from './session';
export {
  createExerciseSession,
  getSessionCurrentSetIndex,
  getCurrentPlannedSet,
  isResting,
  getRemainingRestSeconds,
  isSessionComplete,
  isDiscoverySession,
  getCompletedVolume,
  getTotalReps,
  addCompletedSet,
  startRest,
  clearRest,
  compareSetAtIndex,
  getAllSetComparisons,
} from './session';
