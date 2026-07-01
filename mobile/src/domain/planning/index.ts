/**
 * Planning Domain
 *
 * Unified planning system for:
 * - Initial plan generation (standard workouts)
 * - Intra-workout adaptation (readiness, fatigue)
 * - Post-workout progression (weight increases)
 * - Weight discovery (new exercises)
 *
 * The planning system consumes SessionMetrics from workout/metrics
 * and produces PlanResults with next-set recommendations.
 */

// Main planner
export { planExercise } from './planner';

// Types
export {
  // Enums
  TrainingGoal,
  TrainingLevel,
  ProgressionScheme,

  // Discovery types
  type DiscoveryPhase,
  type DiscoveryStep,
  type DiscoverySetResult,

  // Planning context/result
  type HistoricalMetrics,
  type PlanningOverrides,
  type PlanningContext,
  type PlanAdjustment,
  type PlanResult,

  // Warmup
  type WarmupScheme,
  DEFAULT_WARMUP_SCHEME,
  getWarmupSets,

  // Constants
  VELOCITY_LOSS_TARGETS,
  REST_DEFAULTS,
  RIR_DEFAULTS,
  VOLUME_LANDMARKS,
  SESSION_SET_LIMITS,
  PROGRESSION_INCREMENTS,

  // Utility functions
  getDefaultProgressionScheme,
  createEmptyHistoricalMetrics,
  createPlanningContext,
} from './types';

// Auto-regulation engine
export {
  computeAutoRegulation,
  extractLoadSuggestion,
  computeVelocityWarning,
  computeJunkVolumeAlert,
  extractAutoStopSignal,
  shouldAutoStopSet,
  type AutoRegulationState,
  type AutoRegulationSeverity,
  type LoadSuggestion,
  type VelocityWarning,
  type JunkVolumeAlert,
  type AutoStopSignal,
} from './auto-regulation';

// Auto-plan
export { autoPlanWorkout, type AutoPlan } from './auto-plan-service';

// Programmatic plan loading (receive + validate + persist)
export {
  parseWorkoutPlanPayload,
  loadWorkoutPlan,
  type PlanLoadResult,
} from './plan-load-service';

// Strategies (for advanced usage)
export * from './strategies';
