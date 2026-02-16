/**
 * CompletedSet - App wrapper around library's analytics Set.
 *
 * The library's Set is purely analytical (immutable reps + load settings).
 * CompletedSet adds app metadata: identity, weight, timing, exercise context.
 *
 * All analytics are computed on demand via library functions:
 *   import { getSetVelocityLossPct, estimateSetRIR } from '@voltras/workout-analytics';
 *   const loss = getSetVelocityLossPct(completedSet.data);
 *   const { rir, rpe } = estimateSetRIR(completedSet.data);
 */

import type { Set as AnalyticsSet } from '@voltras/workout-analytics';

export interface CompletedSet {
  /** Unique set identifier */
  id: string;

  /** Exercise being performed */
  exerciseId: string;
  exerciseName?: string;

  /** Weight used in lbs */
  weight: number;

  /** Optional chains weight in lbs */
  chains?: number;

  /** Optional eccentric offset */
  eccentricOffset?: number;

  /** Timing */
  timestamp: { start: number; end: number };

  /**
   * Library analytics set.
   * Use library functions for all metrics:
   *   getSetRepVelocities(data), estimateSetRIR(data), etc.
   */
  data: AnalyticsSet;
}

/**
 * Create a CompletedSet from a library Set and app metadata.
 */
export function createCompletedSet(
  data: AnalyticsSet,
  metadata: {
    exerciseId: string;
    exerciseName?: string;
    weight: number;
    chains?: number;
    eccentricOffset?: number;
    startTime: number;
    endTime?: number;
    id?: string;
  }
): CompletedSet {
  return {
    id: metadata.id ?? `set-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    exerciseId: metadata.exerciseId,
    exerciseName: metadata.exerciseName,
    weight: metadata.weight,
    chains: metadata.chains,
    eccentricOffset: metadata.eccentricOffset,
    timestamp: {
      start: metadata.startTime,
      end: metadata.endTime ?? Date.now(),
    },
    data,
  };
}
