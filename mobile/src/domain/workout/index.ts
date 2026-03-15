/**
 * domain/workout - Workout data models and session management.
 *
 * Core analytics types come from @voltras/workout-analytics.
 * App-specific types (CompletedSet, Plan, Session) are defined here.
 */

// Re-export all models
export {
  // Library types (from @voltras/workout-analytics via models)
  MovementPhase,
  PhaseNames,
  type WorkoutSample,
  type Phase,
  type Rep,
  type AnalyticsSet,
  type LoadSettings,
  createSet,
  addSampleToSet,
  completeSet,

  // CompletedSet (app wrapper)
  type CompletedSet,
  createCompletedSet,

  // Legacy (kept during migration)
  type TempoTarget,

  // Stats (recording session aggregates)
  type WorkoutStats,
  computeWorkoutStats,
  createEmptyWorkoutStats,

  // Plan
  type PlannedSet,
  type ExercisePlan,
  type PlanSource,
  createEmptyPlan,
  getCurrentSetIndex,
  getPlannedSet,
  isDiscoveryPlan,
  getPlanVolume,

  // Session
  type ExerciseSession,
  type SetComparison,
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
} from './models';

// Re-export utilities
export {
  getEffortLabel,
  getRIRDescription,
  getEffortBar,
  getRPEColor,
  getLiveEffortMessage,
} from './utils';

// Re-export session termination
export {
  type TerminationReason,
  type TerminationResult,
  type TerminationConfig,
  DEFAULT_TERMINATION_CONFIG,
  checkTermination,
  createUserStoppedTermination,
  getTerminationMessage,
} from './session';

// Re-export readiness assessment
export {
  type IntensityAdjustment,
  type ReadinessAssessment,
  deriveIntensityAdjustment,
  assessReadiness,
  isReadinessCheckCandidate,
} from './session';

// Telemetry
export { TelemetryRingBuffer } from './telemetry-ring-buffer';

// Re-export planners
export {
  type StandardPlanOptions,
  createStandardPlan,
  createStandardPlanWithWarmups,
  getRecommendedRest,
  getRecommendedRepRange,
  type DiscoveryPlanOptions,
  type DiscoveryContinuationCheck,
  createDiscoveryPlan,
  createDiscoveryPlanWithWeights,
  getNextDiscoveryWeight,
  checkDiscoveryContinuation,
} from './planners';

// Superset / Circuit support
export {
  type SupersetConfig,
  type SupersetSlot,
  type SupersetState,
  type SupersetAdvanceResult,
  createSupersetState,
  createSupersetConfig,
  getCurrentSlot,
  advanceSuperset,
  isSupersetComplete,
  getTotalSupersetSets,
  getUpcomingExercises,
  getSupersetPlannedSet,
} from './superset';
