/**
 * Voltra Domain
 *
 * Voltra device management, telemetry processing, and workout control.
 */

// =============================================================================
// Models
// =============================================================================

// Device model
export {
  VoltraDevice,
  DEFAULT_SETTINGS,
  type VoltraDeviceSettings,
  type VoltraRecordingState,
  type VoltraDeviceState,
} from './models/device';

// Connection model
export {
  type VoltraConnectionState,
  isValidVoltraTransition,
  VoltraConnectionStateModel,
} from './models/connection';

// Device filter
export { VOLTRA_DEVICE_PREFIX, isVoltraDevice, filterVoltraDevices } from './models/device-filter';

// Telemetry models (from telemetry/ submodule)
// Note: MovementPhase and PhaseNames are NOT exported - use @/domain/workout instead
export {
  // Types
  type TelemetryFrame,
  type WorkoutStats,
  type TelemetryState,
  // Functions
  createFrame,
  isActivePhase,
  isConcentricPhase,
  isEccentricPhase,
  computeWorkoutStats,
  createEmptyWorkoutStats,
  createTelemetryState,
  // Constants
  DEFAULT_TELEMETRY_STATE,
  RECENT_FRAMES_WINDOW,
} from './models/telemetry';

// =============================================================================
// Controllers
// =============================================================================

export {
  VoltraDeviceController,
  InvalidWeightError,
  InvalidChainsError,
  InvalidEccentricError,
  NotConnectedError,
} from './controllers/device-controller';

export {
  VoltraConnectionController,
  type VoltraConnectionEvent,
  type VoltraConnectionEventListener,
  type VoltraConnectionResult,
} from './controllers/voltra-connection-controller';

export {
  TelemetryController,
  type TelemetryEvent,
  type TelemetryEventListener,
} from './controllers/telemetry-controller';

export {
  RecordingController,
  type RecordingEvent,
  type RecordingEventListener,
} from './controllers/recording-controller';

// =============================================================================
// Protocol
// =============================================================================

// Command builders
export {
  WeightCommands,
  ChainsCommands,
  EccentricCommands,
  type DualCommand,
} from './protocol/commands';

// Protocol constants
export {
  MessageTypes,
  TelemetryOffsets,
  Timing,
  Auth,
  Init,
  Workout,
  BLE,
} from './protocol/constants';

// Telemetry decoder (low-level)
export {
  decodeNotification,
  decodeTelemetryFrame,
  identifyMessageType,
  type DecodeResult,
  type MessageType,
} from './protocol/telemetry-decoder';

// =============================================================================
// Adapters
// =============================================================================

// Sample adapter (TelemetryFrame → WorkoutSample)
export { toWorkoutSample, toWorkoutSamples } from './adapters';
