/**
 * Workout models - hardware-agnostic exercise data structures.
 *
 * Core analytics types (Set, Rep, Phase, WorkoutSample, MovementPhase) come
 * from @voltras/workout-analytics. App-specific types (CompletedSet, Plan,
 * Session) are defined here.
 */

// Re-export library types used throughout the app
export {
  MovementPhase,
  PhaseNames,
  type WorkoutSample,
  type Phase,
  type Rep,
  type Set as AnalyticsSet,
  type LoadSettings,
  createSet,
  addSampleToSet,
  completeSet,
} from '@voltras/workout-analytics';

// CompletedSet - app wrapper around library's Set
export type { CompletedSet } from './completed-set';
export { createCompletedSet } from './completed-set';

// Stats (recording session aggregates)
export type { WorkoutStats } from './stats';
export { computeWorkoutStats, createEmptyWorkoutStats } from './stats';

// Plan
export type { PlannedSet, ExercisePlan, PlanSource, TrainingGoal, TempoTarget } from './plan';
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
