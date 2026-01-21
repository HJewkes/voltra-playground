/**
 * Domain Module
 *
 * Central export for all domain modules.
 * Business logic organized by concept with models and controllers.
 *
 * Domain Structure:
 * - bluetooth/  - BLE connection and scanning
 * - exercise/   - Exercise definitions, catalog, and mappings
 * - training/   - Training engines and progression (being refactored to planning)
 * - vbt/        - VBT reference data and load-velocity profiles
 * - voltra/     - Voltra device-specific protocol and telemetry
 * - workout/    - Hardware-agnostic workout models, sessions, and aggregators
 * - shared/     - Shared utilities
 *
 * Note: Some symbols have the same name in multiple modules:
 * - VELOCITY_LOSS_TARGETS: exists in both training and vbt (import from specific module)
 *
 * Movement phase and phase names come from workout domain (hardware-agnostic).
 * Voltra has its own internal phase enum for protocol decoding but doesn't export it.
 */

// Bluetooth domain
export * from './bluetooth';

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

// Voltra domain (hardware-specific)
export {
  // Device
  VoltraDevice,
  DEFAULT_SETTINGS,
  type VoltraDeviceSettings,
  type VoltraRecordingState,
  type VoltraDeviceState,
  // Telemetry (internal types - use WorkoutSample for UI)
  type TelemetryFrame,
  type WorkoutStats,
  type TelemetryState,
  createFrame,
  isActivePhase,
  isConcentricPhase,
  isEccentricPhase,
  computeWorkoutStats,
  createEmptyWorkoutStats,
  createTelemetryState,
  DEFAULT_TELEMETRY_STATE,
  RECENT_FRAMES_WINDOW,
  // Controllers
  VoltraDeviceController,
  InvalidWeightError,
  InvalidChainsError,
  InvalidEccentricError,
  NotConnectedError,
  TelemetryController,
  type TelemetryEvent,
  type TelemetryEventListener,
  RecordingController,
  type RecordingEvent,
  type RecordingEventListener,
  // Protocol
  WeightCommands,
  ChainsCommands,
  EccentricCommands,
  type DualCommand,
  MessageTypes,
  TelemetryOffsets,
  Timing,
  Auth,
  Init,
  Workout,
  BLE,
  decodeNotification,
  decodeTelemetryFrame,
  identifyMessageType,
  type DecodeResult,
  type MessageType,
  // Adapters
  toWorkoutSample,
  toWorkoutSamples,
} from './voltra';

// Workout domain (hardware-agnostic - includes MovementPhase, PhaseNames)
export * from './workout';

// Shared utilities
export * from './shared';
