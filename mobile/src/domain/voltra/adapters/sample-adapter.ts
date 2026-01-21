/**
 * SampleAdapter - converts Voltra TelemetryFrames to WorkoutSamples.
 *
 * This is a THIN adapter that only normalizes/maps fields.
 * No metric computation happens here - that's in domain/workout/aggregators.
 *
 * Note: The workout domain's MovementPhase enum is aligned with Voltra's
 * protocol ordering, so phase values pass through directly.
 */
import type { TelemetryFrame } from '@/domain/voltra/models/telemetry';
import type { WorkoutSample } from '@/domain/workout/models/sample';
import { createSample } from '@/domain/workout/models/sample';
import { MovementPhase } from '@/domain/workout/models/types';

/** Voltra position range (0 = rest, ~600 = full extension) */
const VOLTRA_MAX_POSITION = 600;

/**
 * Convert a Voltra TelemetryFrame to a hardware-agnostic WorkoutSample.
 */
export function toWorkoutSample(frame: TelemetryFrame): WorkoutSample {
  // Phase values are aligned between Voltra protocol and workout domain,
  // but we clamp unknown values to IDLE for safety
  const phase =
    frame.phase >= 0 && frame.phase <= 3 ? (frame.phase as MovementPhase) : MovementPhase.IDLE;

  return createSample(
    frame.sequence, // Pass through sequence for drop detection
    frame.timestamp,
    phase,
    frame.position / VOLTRA_MAX_POSITION, // Normalize to 0-1
    frame.velocity, // Already in m/s
    Math.abs(frame.force) // Absolute force in lbs
  );
}

/**
 * Convert multiple frames to samples.
 */
export function toWorkoutSamples(frames: TelemetryFrame[]): WorkoutSample[] {
  return frames.map(toWorkoutSample);
}
