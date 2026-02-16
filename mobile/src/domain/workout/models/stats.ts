/**
 * Workout Stats Model
 *
 * Aggregate statistics computed from rep data during a recording session.
 * Uses library's Rep type and analytics functions.
 */

import type { Rep } from '@voltras/workout-analytics';
import { getRepPeakForce, getRepDuration } from '@voltras/workout-analytics';

/**
 * Aggregate statistics for a workout set/recording.
 */
export interface WorkoutStats {
  /** Number of completed reps */
  repCount: number;

  /** Recording start time (ms since epoch) */
  startTime: number;

  /** Recording end time (ms since epoch, null if still recording) */
  endTime: number | null;

  /** Weight used (lbs, null if not set) */
  weightLbs: number | null;

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
 */
export function computeWorkoutStats(
  reps: readonly Rep[],
  startTime: number | null,
  weightLbs: number | null
): WorkoutStats {
  const now = Date.now();
  const start = startTime || now;
  const totalDuration = (now - start) / 1000;

  const avgPeakForce =
    reps.length > 0 ? reps.reduce((sum, r) => sum + getRepPeakForce(r), 0) / reps.length : 0;

  const maxPeakForce =
    reps.length > 0 ? Math.max(...reps.map((r) => getRepPeakForce(r))) : 0;

  const durations = reps.map((r) => getRepDuration(r));
  const avgRepDuration =
    reps.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / reps.length : 0;

  const timeUnderTension = durations.reduce((sum, d) => sum + d, 0);

  return {
    repCount: reps.length,
    startTime: start,
    endTime: now,
    weightLbs,
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
    repCount: 0,
    startTime: Date.now(),
    endTime: null,
    weightLbs: null,
    totalDuration: 0,
    avgPeakForce: 0,
    maxPeakForce: 0,
    avgRepDuration: 0,
    timeUnderTension: 0,
  };
}
