/**
 * Device Domain
 *
 * This module bridges the @voltras/node-sdk with the app's workout domain.
 * It handles the conversion from raw TelemetryFrame to WorkoutSample.
 */

// Adapter for converting TelemetryFrame to WorkoutSample
export { toWorkoutSample, toWorkoutSamples } from './voltra-adapter';

// Re-export SDK types that stores/components need
export {
  VoltraManager,
  type VoltraClient,
  type TelemetryFrame,
  type DiscoveredDevice,
  type VoltraClientState,
  type VoltraConnectionState,
  type VoltraRecordingState,
  type VoltraDeviceSettings,
  type ScanOptions,
  type Platform,
  type VoltraManagerOptions,
  type VoltraManagerEvent,
  type VoltraClientEvent,
  // Training modes
  TrainingMode,
  TrainingModeNames,
  // Errors
  ConnectionError,
  AuthenticationError,
  TimeoutError,
  NotConnectedError,
} from '@voltras/node-sdk';

// Environment detection
export { detectBLEEnvironment, type BLEEnvironmentInfo } from './environment';
