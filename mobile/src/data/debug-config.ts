/**
 * Debug Configuration
 *
 * Configuration flags for debug/development features.
 * Separated from provider.ts to avoid circular dependencies.
 */

// Default to true in development, false in production
let _debugTelemetryEnabled = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

/**
 * Check if debug telemetry storage is enabled.
 * When enabled, raw WorkoutSamples are stored with sets for replay.
 */
export function isDebugTelemetryEnabled(): boolean {
  return _debugTelemetryEnabled;
}

/**
 * Enable or disable debug telemetry storage.
 */
export function setDebugTelemetryEnabled(enabled: boolean): void {
  _debugTelemetryEnabled = enabled;
}
