/**
 * WorkoutSample - a single data point during exercise.
 *
 * Hardware-agnostic representation of one measurement.
 * Adapters convert device-specific data into this format.
 * All values are normalized/standardized.
 */
import { MovementPhase } from './types';

export interface WorkoutSample {
  /** Incrementing sequence number from source device (for drop detection) */
  sequence: number;

  /** Timestamp in ms since epoch */
  timestamp: number;

  /** Current movement phase */
  phase: MovementPhase;

  /** Position in range of motion (0 = start, 1 = full extension) */
  position: number;

  /** Instantaneous velocity (m/s, always positive) */
  velocity: number;

  /** Force reading (lbs, absolute value) */
  force: number;
}

/**
 * Create a workout sample from normalized values.
 */
export function createSample(
  sequence: number,
  timestamp: number,
  phase: MovementPhase,
  position: number,
  velocity: number,
  force: number,
): WorkoutSample {
  return { sequence, timestamp, phase, position, velocity, force };
}
