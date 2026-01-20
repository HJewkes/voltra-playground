/**
 * Baseline Service
 * 
 * Computes velocity baselines from set history.
 */

import type { Set } from '@/domain/workout';
import type { VelocityBaseline, VelocityDataPoint } from '../models';

/**
 * Compute velocity baseline from set history.
 * Uses concentricMeanVelocity from first rep, which is more stable for building load-velocity profiles.
 */
export function computeVelocityBaseline(
  exerciseId: string,
  sets: Set[],
): VelocityBaseline {
  const dataPoints: VelocityDataPoint[] = sets
    .filter((s) => s.reps.length > 0 && s.reps[0].metrics.concentricMeanVelocity > 0)
    .map((s) => ({
      weight: s.weight,
      velocity: s.reps[0].metrics.concentricMeanVelocity,
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
  
  // Find bracketing weights
  const sorted = [...points].sort((a, b) => a.weight - b.weight);
  
  // If below range, extrapolate from first two
  if (weight <= sorted[0].weight) {
    if (sorted.length < 2) return sorted[0].velocity;
    const slope = (sorted[1].velocity - sorted[0].velocity) / (sorted[1].weight - sorted[0].weight);
    return sorted[0].velocity + slope * (weight - sorted[0].weight);
  }
  
  // If above range, extrapolate from last two
  if (weight >= sorted[sorted.length - 1].weight) {
    if (sorted.length < 2) return sorted[sorted.length - 1].velocity;
    const n = sorted.length;
    const slope = (sorted[n - 1].velocity - sorted[n - 2].velocity) / (sorted[n - 1].weight - sorted[n - 2].weight);
    return sorted[n - 1].velocity + slope * (weight - sorted[n - 1].weight);
  }
  
  // Find bracketing points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    if (weight >= sorted[i].weight && weight <= sorted[i + 1].weight) {
      const ratio = (weight - sorted[i].weight) / (sorted[i + 1].weight - sorted[i].weight);
      return sorted[i].velocity + ratio * (sorted[i + 1].velocity - sorted[i].velocity);
    }
  }
  
  return null;
}
