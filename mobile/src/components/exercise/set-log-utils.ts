/**
 * Pure utility functions for SetLog component.
 * Extracted to avoid loading native UI dependencies in tests.
 */

import { getRepPeakVelocity, type Rep } from '@voltras/workout-analytics';
import type { ClusterBoundary } from '@/domain/workout';

export function computeClusterMeanVelocity(reps: readonly Rep[], cluster: ClusterBoundary): number {
  const clusterReps = reps.slice(cluster.repStart, cluster.repEnd);
  if (clusterReps.length === 0) return 0;
  const sum = clusterReps.reduce((acc, r) => acc + getRepPeakVelocity(r), 0);
  return sum / clusterReps.length;
}
