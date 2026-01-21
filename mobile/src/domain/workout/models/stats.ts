/**
 * Workout Stats Model
 *
 * Aggregate statistics computed from rep data during a recording session.
 * Hardware-agnostic - works with Rep models from any device.
 */

import type { Rep } from './rep';

/**
 * Aggregate statistics for a workout set/recording.
 */
export interface WorkoutStats {
  /** All completed reps in the set */
  reps: Rep[];

  /** Recording start time (ms since epoch) */
  startTime: number;

  /** Recording end time (ms since epoch, null if still recording) */
  endTime: number | null;

  /** Weight used (lbs, null if not set) */
  weightLbs: number | null;

  // Computed aggregates
  /** Number of completed reps */
  repCount: number;

  /** Total recording duration (seconds) */
  totalDuration: number;

  /** Average peak force across reps (lbs) */
  avgPeakForce: number;

  /** Maximum peak force across reps (lbs) */
  maxPeakForce: number;

  /** Average rep duration (seconds) */
  avgRepDuration: number;

  /** Total time under tension (seconds) */
  timeUnderTension: number;
}

/**
 * Compute workout stats from rep data.
 *
 * @param reps - Completed reps
 * @param startTime - Recording start time (ms since epoch)
 * @param weightLbs - Weight used (lbs)
 * @returns Computed workout statistics
 */
export function computeWorkoutStats(
  reps: Rep[],
  startTime: number | null,
  weightLbs: number | null
): WorkoutStats {
  const now = Date.now();
  const start = startTime || now;
  const totalDuration = (now - start) / 1000;

  const avgPeakForce =
    reps.length > 0 ? reps.reduce((sum, r) => sum + r.metrics.peakForce, 0) / reps.length : 0;

  const maxPeakForce = reps.length > 0 ? Math.max(...reps.map((r) => r.metrics.peakForce)) : 0;

  const avgRepDuration =
    reps.length > 0 ? reps.reduce((sum, r) => sum + r.metrics.totalDuration, 0) / reps.length : 0;

  const timeUnderTension = reps.reduce((sum, r) => sum + r.metrics.totalDuration, 0);

  return {
    reps: [...reps],
    startTime: start,
    endTime: now,
    weightLbs,
    repCount: reps.length,
    totalDuration,
    avgPeakForce,
    maxPeakForce,
    avgRepDuration,
    timeUnderTension,
  };
}

/**
 * Empty workout stats for initial state.
 */
export function createEmptyWorkoutStats(): WorkoutStats {
  return {
    reps: [],
    startTime: Date.now(),
    endTime: null,
    weightLbs: null,
    repCount: 0,
    totalDuration: 0,
    avgPeakForce: 0,
    maxPeakForce: 0,
    avgRepDuration: 0,
    timeUnderTension: 0,
  };
}
