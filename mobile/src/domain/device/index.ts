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

// =============================================================================
// Environment Detection
// =============================================================================

export interface BLEEnvironmentInfo {
  environment: 'native' | 'web' | 'node';
  bleSupported: boolean;
  warningMessage: string | null;
  isWeb: boolean;
  requiresUserGesture: boolean;
}

/**
 * Detect the current BLE environment and capabilities.
 */
export function detectBLEEnvironment(): BLEEnvironmentInfo {
  // Check for browser environment
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    const hasWebBluetooth = 'bluetooth' in navigator;
    return {
      environment: 'web',
      bleSupported: hasWebBluetooth,
      warningMessage: hasWebBluetooth ? null : 'Web Bluetooth is not supported in this browser',
      isWeb: true,
      requiresUserGesture: true,
    };
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return {
      environment: 'node',
      bleSupported: true,
      warningMessage: null,
      isWeb: false,
      requiresUserGesture: false,
    };
  }

  // Default to native (React Native)
  return {
    environment: 'native',
    bleSupported: true,
    warningMessage: null,
    isWeb: false,
    requiresUserGesture: false,
  };
}
