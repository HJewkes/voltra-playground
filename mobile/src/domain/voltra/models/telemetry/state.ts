/**
 * Telemetry State Model
 *
 * UI-focused state for real-time frame display.
 * Contains only raw frame data - rep/analytics state is in recording-store.
 */

import type { TelemetryFrame } from './frame';

/**
 * Telemetry state for real-time display.
 *
 * Contains raw frame data only. Rep tracking and analytics
 * are now handled by the recording-store.
 */
export interface TelemetryState {
  /** Current telemetry frame */
  currentFrame: TelemetryFrame | null;

  /** Rolling window of recent frames for charts */
  recentFrames: TelemetryFrame[];
}

/**
 * Default telemetry state.
 */
export const DEFAULT_TELEMETRY_STATE: TelemetryState = {
  currentFrame: null,
  recentFrames: [],
};

/**
 * Create a fresh telemetry state.
 */
export function createTelemetryState(): TelemetryState {
  return {
    ...DEFAULT_TELEMETRY_STATE,
    recentFrames: [],
  };
}

/**
 * Rolling window size for recent frames (for charts).
 */
export const RECENT_FRAMES_WINDOW = 100;
