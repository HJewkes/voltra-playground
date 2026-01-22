/**
 * Domain Module
 *
 * Central export for all domain modules.
 * Business logic organized by concept with models and controllers.
 *
 * Domain Structure:
 * - device/     - SDK adapter layer (converts SDK TelemetryFrame to WorkoutSample)
 * - exercise/   - Exercise definitions, catalog, and mappings
 * - history/    - Workout history, personal records, and trends
 * - planning/   - Training plans and progression strategies
 * - vbt/        - VBT reference data and load-velocity profiles
 * - workout/    - Hardware-agnostic workout models, sessions, and aggregators
 *
 * Note: Bluetooth and Voltra hardware logic is now in @voltras/node-sdk.
 * The device/ module provides the adapter layer to convert SDK data to app models.
 *
 * Movement phase and phase names come from workout domain (hardware-agnostic).
 */

// Device adapter layer (wraps @voltras/node-sdk)
export * from './device';

// Exercise domain (pure definitions/catalog)
export * from './exercise';

// Planning domain (unified planning system)
export * from './planning';

// VBT domain (has VELOCITY_LOSS_TARGETS - also in training)
// Import specific exports to avoid conflict
export {
  // Constants
  VELOCITY_AT_PERCENT_1RM,
  MINIMUM_VELOCITY_THRESHOLD,
  TRAINING_ZONES,
  REP_RANGES,
  VELOCITY_RIR_MAP,
  DISCOVERY_START_PERCENTAGES,
  PROFILE_CONFIDENCE_REQUIREMENTS,

  // Functions
  estimatePercent1RMFromVelocity,
  getTargetVelocityForGoal,
  categorizeVelocity,
  suggestNextWeight,
  buildLoadVelocityProfile,
  estimateWeightForPercent1RM,
  estimateWeightForVelocity,
  predictVelocityAtWeight,
  addDataPointToProfile,
  generateWorkingWeightRecommendation,
  generateWarmupSets,
  estimate1RMFromSet,

  // Types
  type VelocityTrend,
  type LoadVelocityDataPoint,
  type LoadVelocityProfile,
  type WorkingWeightRecommendation,
  type WarmupSet,
} from './vbt';

// Workout domain (hardware-agnostic - includes MovementPhase, PhaseNames)
export * from './workout';
