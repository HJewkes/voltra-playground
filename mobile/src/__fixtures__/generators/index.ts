/**
 * Fixture Generators - Unified Builder System
 *
 * All builders use a consistent pattern for creating domain objects with
 * target-seeking physics. Types are colocated with their builders.
 *
 * Architecture:
 *   repBuilder()      → Rep objects with physics-based samples
 *   setBuilder()      → Set objects from rep compositions
 *   planBuilder()     → ExercisePlan objects
 *   sessionBuilder()  → ExerciseSession objects
 *   planning builders → PlanningContext, metrics, discovery
 *
 * @example
 * // Simple rep
 * repBuilder().fatiguing().build()
 *
 * // Rep with explicit targets
 * repBuilder().total({ duration: 2.5 }).build()
 *
 * // Set with preset composition
 * setBuilder().weight(185).productiveWorking().build()
 *
 * // Complete session
 * sessionBuilder().standardWorkout().workingWeight(185).build()
 *
 * // Planning context
 * planningContextBuilder()
 *   .historicalMetrics(historicalMetricsBuilder().experienced(100).build())
 *   .sessionMetrics(sessionMetricsBuilder().fresh().build())
 *   .build()
 */

// =============================================================================
// Rep Builder (with PhaseTargets, RepTargets, RepBehavior, BEHAVIOR_PRESETS)
// =============================================================================

export {
  repBuilder,
  // Types
  type RepBuilder,
  type PhaseTargets,
  type RepTargets,
  type GeneratedRep,
  // Enum and presets
  RepBehavior,
  BEHAVIOR_PRESETS,
} from './rep-builder';

// =============================================================================
// Set Builder (with SetTargets, SetPreset, SET_PRESETS)
// =============================================================================

export {
  setBuilder,
  // Types
  type SetBuilder,
  type SetTargets,
  type SetPreset,
  // Presets
  SET_PRESETS,
} from './set-builder';

// =============================================================================
// Plan Builder (with PlanTargets, PlannedSetTargets)
// =============================================================================

export {
  planBuilder,
  // Types
  type PlanBuilder,
  type PlanTargets,
  type PlannedSetTargets,
} from './plan-builder';

// =============================================================================
// Session Builder (with SessionTargets, SessionPreset, SESSION_PRESETS)
// =============================================================================

export {
  sessionBuilder,
  createTestExercise,
  // Types
  type SessionBuilder,
  type SessionTargets,
  type SessionSetSpec,
  type SessionComposition,
  type SessionPreset,
  // Presets
  SESSION_PRESETS,
} from './session-builder';

// =============================================================================
// Planning Builders (context, historical metrics, session metrics, discovery)
// =============================================================================

export {
  historicalMetricsBuilder,
  sessionMetricsBuilder,
  planningContextBuilder,
  discoverySetResultBuilder,
  // Types
  type HistoricalMetricsBuilder,
  type SessionMetricsBuilder,
  type PlanningContextBuilder,
  type DiscoverySetResultBuilder,
  type HistoricalMetricsTargets,
  type SessionMetricsTargets,
  type DiscoverySetResultTargets,
  type PlanningContextTargets,
  // Re-exports
  TrainingGoal,
  TrainingLevel,
} from './planning-builders';

// =============================================================================
// Physics Engine (low-level, for advanced use)
// =============================================================================

export {
  generateRepFromTargets,
  generatePhaseSamples,
  generateHoldSamples,
  resolveRepTargets,
  derivePhasesFromTotal,
  deriveVelocities,
  verifyRepMetrics,
  aggregateSamplesToRep,
  generateVelocityCurve,
  generateBellCurve,
  generatePlateauCurve,
  generateSpikyCurve,
  deepMerge,
  // Types
  type PhysicsConfig,
  type ResolvedRepTargets,
  type GeneratedPhase,
} from './physics-engine';

// =============================================================================
// Legacy Generators (kept for backward compatibility)
// =============================================================================

// Sample generators
export {
  generateWorkoutSample,
  generateSampleStream,
  resetSequence,
  type GenerateSampleOptions,
  type GenerateStreamOptions,
} from './sample-generator';

// Session generators (storage format)
export {
  generateStoredSession,
  generateStoredSet,
  type GenerateSessionOptions as GenerateStoredSessionOptions,
  type GenerateSetOptions as GenerateStoredSetOptions,
} from './session-generator';

// Recording generators
export { generateRecording, type GenerateRecordingOptions } from './recording-generator';

// Legacy rep behaviors (for compatibility with existing tests)
export {
  // Types (use RepBehavior from rep-builder instead)
  type RepBehavior as LegacyRepBehavior,
  type RepBehaviorOptions,
  type RepSamplesResult,
  // Physics constants
  REP_BEHAVIOR_PHYSICS,
  // Unified entry point
  generateRepSamples,
  // Individual generators
  generateExplosiveRep,
  generateNormalRep,
  generateFatiguingRep,
  generateGrindingRep,
  generateFailedRep,
  generatePartialRep,
} from './rep-behaviors';

// Legacy set compositions (for compatibility)
export {
  type SetComposition,
  type GenerateSetOptions,
  type SetFromBehaviorsResult,
  setPresets,
  generateSetFromBehaviors,
  sets,
} from './set-compositions';

// Legacy session compositions (for compatibility)
export {
  type SessionSetSpec as LegacySessionSetSpec,
  type SessionComposition as LegacySessionComposition,
  type GenerateSessionOptions,
  type SessionFromCompositionResult,
  sessionPresets,
  generateSessionFromComposition,
  sessions,
  testExercises,
  createTestExercise as legacyCreateTestExercise,
} from './session-compositions';

// Legacy planning fixtures (for compatibility)
export {
  type GeneratePlanningContextOptions,
  generatePlanningContext,
  type GenerateHistoricalMetricsOptions,
  generateHistoricalMetrics,
  generateNewExerciseMetrics,
  generateExperiencedMetrics,
  generateImprovingMetrics,
  generateDecliningMetrics,
  type GenerateSessionMetricsOptions,
  generateSessionMetrics,
  generateFreshSessionMetrics,
  generateFatiguedSessionMetrics,
  generateJunkVolumeSessionMetrics,
  type GenerateDiscoverySetResultOptions,
  generateDiscoverySetResult,
  generateDiscoverySequence,
  generateFailedDiscoverySequence,
  type LoadVelocityDataPoint,
  type LoadVelocityProfile,
  type GenerateLoadVelocityProfileOptions,
  generateLoadVelocityProfile,
  generateLowConfidenceProfile,
  generateHighConfidenceProfile,
} from './planning-fixtures';

// Phase stubs (deprecated - use repBuilder instead)
export {
  createStubPhase,
  createStubConcentricPhase,
  createStubEccentricPhase,
  createStubHoldPhase,
  createStubRep,
  createStubReps,
  type StubRepOptions,
} from './phase-stubs';
