/**
 * Stats Service
 *
 * Computes aggregate statistics from set history.
 */

import type { CompletedSet } from '@/domain/workout';

/**
 * Aggregate statistics across all sets.
 */
export interface AggregateStats {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
}

/**
 * Compute aggregate statistics from a list of sets.
 */
export function computeAggregateStats(sets: CompletedSet[]): AggregateStats {
  let totalReps = 0;
  let totalVolume = 0;

  for (const set of sets) {
    totalReps += set.data.reps.length;
    totalVolume += set.weight * set.data.reps.length;
  }

  return {
    totalSets: sets.length,
    totalReps,
    totalVolume,
  };
}
