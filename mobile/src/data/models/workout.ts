/**
 * Workout Data Models
 * 
 * Defines the stored workout data structures.
 * StoredRepData omits the raw frames from RepData for storage efficiency.
 */

import type { RepData } from '@/protocol/telemetry';

/**
 * Rep data for storage (without raw telemetry frames).
 * All the computed metrics, but not the ~1000 frames per rep.
 */
export type StoredRepData = Omit<RepData, 'frames'>;

/**
 * A single stored workout set.
 */
export interface StoredWorkout {
  /** Unique identifier */
  id: string;
  
  /** Exercise identifier */
  exerciseId: string;
  
  /** Exercise name (human readable) */
  exerciseName?: string;
  
  /** Unix timestamp when workout was performed */
  date: number;
  
  /** ISO date string (for display) */
  dateString: string;
  
  /** Weight used in lbs */
  weight: number;
  
  /** Chains weight in lbs (if used) */
  chains?: number;
  
  /** Eccentric adjustment (if used) */
  eccentric?: number;
  
  /** Rep data (without frames) */
  reps: StoredRepData[];
  
  /** Total duration in seconds */
  duration: number;
  
  /** Computed analytics */
  analytics: StoredWorkoutAnalytics;
  
  /** Optional notes */
  notes?: string;
}

/**
 * Analytics computed and stored with each workout.
 */
export interface StoredWorkoutAnalytics {
  /** Velocity loss from first to last rep (percentage) */
  velocityLossPercent: number;
  
  /** Estimated reps in reserve */
  estimatedRIR: number;
  
  /** Estimated RPE (1-10) */
  estimatedRPE: number;
  
  /** Average velocity across all reps */
  avgVelocity: number;
  
  /** Peak velocity in the set */
  peakVelocity: number;
  
  /** Total time under tension in seconds */
  timeUnderTension: number;
  
  /** Average rep duration in seconds */
  avgRepDuration: number;
  
  /** Per-rep velocity for charting */
  velocityByRep: number[];
  
  /** Average concentric (pulling) time */
  avgConcentricTime: number;
  
  /** Average eccentric (lowering) time */
  avgEccentricTime: number;
  
  /** Average pause at top */
  avgTopPauseTime: number;
  
  /** Average pause at bottom */
  avgBottomPauseTime: number;
  
  /** Average tempo string (e.g., "2-1-1-0") */
  avgTempo: string;
}

/**
 * Summary info for workout list display.
 */
export interface WorkoutSummary {
  id: string;
  exerciseId: string;
  exerciseName?: string;
  date: number;
  weight: number;
  repCount: number;
  velocityLossPercent: number;
  estimatedRPE: number;
}

/**
 * Convert a full StoredWorkout to a summary.
 */
export function toWorkoutSummary(workout: StoredWorkout): WorkoutSummary {
  return {
    id: workout.id,
    exerciseId: workout.exerciseId,
    exerciseName: workout.exerciseName,
    date: workout.date,
    weight: workout.weight,
    repCount: workout.reps.length,
    velocityLossPercent: workout.analytics.velocityLossPercent,
    estimatedRPE: workout.analytics.estimatedRPE,
  };
}
