/**
 * Baseline Service
 *
 * Computes velocity baselines from set history.
 */

import type { CompletedSet } from '@/domain/workout';
import { getSetFirstRepVelocity } from '@voltras/workout-analytics';
import type { VelocityBaseline, VelocityDataPoint } from '../models';

/**
 * Compute velocity baseline from set history.
 * Uses first rep velocity, which is more stable for building load-velocity profiles.
 */
export function computeVelocityBaseline(
  exerciseId: string,
  sets: CompletedSet[]
): VelocityBaseline {
  const dataPoints: VelocityDataPoint[] = sets
    .filter((s) => s.data.reps.length > 0 && getSetFirstRepVelocity(s.data) > 0)
    .map((s) => ({
      weight: s.weight,
      velocity: getSetFirstRepVelocity(s.data),
      timestamp: s.timestamp.start,
    }))
    .sort((a, b) => a.weight - b.weight);

  return {
    exerciseId,
    dataPoints,
    lastUpdated: Date.now(),
  };
}

/**
 * Interpolate expected velocity at a given weight from baseline.
 */
export function interpolateVelocity(baseline: VelocityBaseline, weight: number): number | null {
  const points = baseline.dataPoints;
  if (points.length === 0) return null;
  if (points.length === 1) return points[0].velocity;

  const sorted = [...points].sort((a, b) => a.weight - b.weight);

  if (weight <= sorted[0].weight) {
    if (sorted.length < 2) return sorted[0].velocity;
    const slope =
      (sorted[1].velocity - sorted[0].velocity) / (sorted[1].weight - sorted[0].weight);
    return sorted[0].velocity + slope * (weight - sorted[0].weight);
  }

  if (weight >= sorted[sorted.length - 1].weight) {
    if (sorted.length < 2) return sorted[sorted.length - 1].velocity;
    const n = sorted.length;
    const slope =
      (sorted[n - 1].velocity - sorted[n - 2].velocity) /
      (sorted[n - 1].weight - sorted[n - 2].weight);
    return sorted[n - 1].velocity + slope * (weight - sorted[n - 1].weight);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (weight >= sorted[i].weight && weight <= sorted[i + 1].weight) {
      const ratio = (weight - sorted[i].weight) / (sorted[i + 1].weight - sorted[i].weight);
      return sorted[i].velocity + ratio * (sorted[i + 1].velocity - sorted[i].velocity);
    }
  }

  return null;
}
