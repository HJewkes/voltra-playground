/**
 * domain/workout - Hardware-agnostic workout data models and aggregation logic.
 *
 * Architecture:
 *   WorkoutSample → PhaseAggregator → Phase → RepAggregator → Rep → SetAggregator → Set
 *
 * SetMetrics uses tiered computation:
 *   Rep[] → VelocityMetrics → FatigueAnalysis → EffortEstimate
 */

// Re-export all models
export {
  // Types
  MovementPhase,
  PhaseNames,
  // Sample
  type WorkoutSample,
  createSample,
  // Phase
  type Phase,
  type PhaseMetrics,
  // Rep
  type Rep,
  type RepMetrics,
  type StoredRep,
  createRep,
  // Set
  type Set,
  type SetMetrics,
  type VelocityMetrics,
  type FatigueAnalysis,
  type EffortEstimate,
  type TempoTarget,
  // Stats (recording session aggregates)
  type WorkoutStats,
  computeWorkoutStats,
  createEmptyWorkoutStats,
  // Plan
  type PlannedSet,
  type ExercisePlan,
  type PlanSource,
  // Note: TrainingGoal moved to @/domain/planning
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

// Re-export all aggregators
export {
  // Phase
  aggregatePhase,
  computePhaseMetrics,
  // Rep
  aggregateRep,
  computeRepMetrics,
  // Set
  aggregateSet,
  createEmptySetMetrics,
  DEFAULT_CONFIG,
  type SetAggregatorConfig,
} from './aggregators';

// Re-export utilities
export {
  getEffortLabel,
  getRIRDescription,
  getEffortBar,
  getRPEColor,
  getLiveEffortMessage,
} from './utils';

// Re-export detectors
export {
  RepDetector,
  type RepDetectorState,
  type RepBoundary,
  type PhaseSamples,
} from './detectors';

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

// Re-export planners (temporary home - will move to planning domain)
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
