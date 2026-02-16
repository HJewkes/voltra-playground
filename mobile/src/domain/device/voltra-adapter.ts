/**
 * Voltra Adapter - converts SDK TelemetryFrames to app's WorkoutSamples.
 *
 * This adapter isolates the workout domain from hardware-specific data.
 * The SDK exposes raw TelemetryFrame; this converts to WorkoutSample.
 */
import type { TelemetryFrame } from '@voltras/node-sdk';
import { type WorkoutSample, MovementPhase } from '@voltras/workout-analytics';

/** Voltra position range (0 = rest, ~600 = full extension) */
const VOLTRA_MAX_POSITION = 600;

/**
 * Velocity scaling factor.
 * Raw encoder value is in approximate mm/s, divide by 1000 to get m/s.
 * - Raw 500 → 0.5 m/s (moderate lifting speed)
 * - Raw 200 → 0.2 m/s (heavy/slow lifting)
 * - Raw 800 → 0.8 m/s (explosive/fast lifting)
 */
const VELOCITY_SCALE = 1000;

/**
 * Convert a Voltra TelemetryFrame to a hardware-agnostic WorkoutSample.
 */
export function toWorkoutSample(frame: TelemetryFrame): WorkoutSample {
  // Phase values are aligned between Voltra protocol and workout domain,
  // but we clamp unknown values to IDLE for safety
  const phase =
    frame.phase >= 0 && frame.phase <= 3 ? (frame.phase as MovementPhase) : MovementPhase.IDLE;

  const scaledVelocity = frame.velocity / VELOCITY_SCALE;

  return {
    sequence: frame.sequence,
    timestamp: frame.timestamp,
    phase,
    position: frame.position / VOLTRA_MAX_POSITION, // Normalize to 0-1
    velocity: scaledVelocity, // Convert raw encoder to m/s
    force: Math.abs(frame.force), // Absolute force in lbs
  };
}

/**
 * Convert multiple frames to samples.
 */
export function toWorkoutSamples(frames: TelemetryFrame[]): WorkoutSample[] {
  return frames.map(toWorkoutSample);
}
