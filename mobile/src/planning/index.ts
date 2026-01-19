/**
 * Voltra Planning Module
 * 
 * Exports all workout planning, adaptation, and progression functionality.
 */

// Models and constants
export {
  // Enums
  TrainingGoal,
  TrainingLevel,
  ProgressionScheme,
  ReadinessZone,
  MuscleGroup,
  
  // Constants
  VELOCITY_LOSS_TARGETS,
  REST_DEFAULTS,
  RIR_DEFAULTS,
  VOLUME_LANDMARKS,
  SESSION_SET_LIMITS,
  READINESS_THRESHOLDS,
  EXPECTED_REP_DROP,
  PROGRESSION_INCREMENTS,
  
  // Types
  type ExerciseType,
  type WarmupScheme,
  type AdaptiveSettings,
  type ExercisePrescription,
  type WorkoutPlan,
  type SetAdjustment,
  type AdaptiveSessionState,
  type DeloadTrigger,
  type DeloadWeek,
  type WeeklyVolume,
  
  // Functions
  DEFAULT_WARMUP_SCHEME,
  DEFAULT_ADAPTIVE_SETTINGS,
  DEFAULT_DELOAD,
  getWarmupSets,
  createExercisePrescription,
  createSessionState,
  getVolumeStatus,
  getVolumeLandmarks,
  getDefaultProgressionScheme,
} from './models';

// Readiness detection
export {
  type ReadinessCheckResult,
  type WarmupSetData,
  ReadinessChecker,
  estimateReadinessFromFirstRep,
} from './readiness';

// Intra-workout adaptation
export {
  type SetPerformance,
  type NextSetRecommendation,
  AdaptiveEngine,
  checkVelocityRecovery,
  isSetWithinExpectations,
} from './adaptation';

// Session-to-session progression
export {
  type ExerciseSessionSummary,
  type ProgressionDecision,
  ProgressionEngine,
  createSessionSummary,
} from './progression';

// User messaging
export {
  type MessageTone,
  type UserMessage,
  getRepProgressMessage,
  getTempoFeedback,
  getRomWarning,
  getPostSetSummary,
  getReadinessMessage,
  getNextSetGuidance,
  getProgressionMessage,
  getWorkoutCompleteMessage,
  sortMessages,
  getTopMessage,
  toneToColor,
  toneToBgColor,
} from './messaging';

// Weight discovery
export {
  // Constants
  VELOCITY_AT_PERCENT_1RM,
  TRAINING_ZONES,
  MINIMUM_VELOCITY_THRESHOLD,
  DISCOVERY_START_PERCENTAGES,
  
  // Types
  type DiscoverySetResult,
  type LoadVelocityProfile,
  type DiscoveryStep,
  type DiscoveryRecommendation,
  type DiscoveryPhase,
  
  // Class
  WeightDiscoveryEngine,
  
  // Utility functions
  estimatePercent1RMFromVelocity,
  estimate1RMFromSet,
  getTargetVelocityForGoal,
  suggestNextWeight,
} from './weightDiscovery';

// Plan loading and validation
export {
  // Exercise mappings
  EXERCISE_MUSCLE_GROUPS,
  EXERCISE_TYPES,
  
  // Validation
  PlanValidationError,
  type ValidationResult,
  validatePlan,
  
  // Loading
  loadPlanFromObject,
  loadPlanFromJSON,
  
  // Serialization
  planToObject,
  planToJSON,
  
  // Utilities
  createMinimalPlan,
  getExerciseName,
  getKnownExercises,
  getExercisesByMuscleGroup,
} from './planLoader';
