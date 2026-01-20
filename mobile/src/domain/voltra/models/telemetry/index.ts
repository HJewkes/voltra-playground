/**
 * Telemetry Models
 * 
 * Data structures and business logic for workout telemetry.
 */

// Frame model
export type { TelemetryFrame } from './frame';
export { 
  createFrame, 
  isActivePhase, 
  isConcentricPhase, 
  isEccentricPhase,
} from './frame';

// Rep model (legacy types - kept for internal reference)
// Note: Use Rep from @/domain/workout for new code

// Stats model - re-exported from workout domain
export type { WorkoutStats } from '@/domain/workout';
export { computeWorkoutStats, createEmptyWorkoutStats } from '@/domain/workout';

// State model
export type { TelemetryState } from './state';
export { 
  DEFAULT_TELEMETRY_STATE, 
  createTelemetryState,
  RECENT_FRAMES_WINDOW,
} from './state';

// Note: MovementPhase and PhaseNames should be imported from @/domain/workout
// The voltra/protocol/constants version is internal for protocol decoding only
