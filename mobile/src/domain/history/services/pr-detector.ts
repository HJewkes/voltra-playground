/**
 * PR Detector Service
 *
 * Detects personal records by comparing a newly completed set against
 * the session's prior sets. Returns PR badges for any records broken.
 */

// Import directly to avoid circular dep through workout barrel
import type { CompletedSet } from '@/domain/workout/models/completed-set';
import { getSetPeakVelocity } from '@voltras/workout-analytics';

// =============================================================================
// Types
// =============================================================================

/** PR types that can be broken in a single set. */
export type PRType = 'max_weight' | 'max_velocity' | 'max_reps' | 'max_volume';

/** A PR badge attached to a completed set in the log. */
export interface PRBadge {
  type: PRType;
  label: string;
  value: number;
}

/** Snapshot of current PRs used for comparison */
export interface PRSnapshot {
  maxWeight: number;
  maxReps: number;
  maxVelocity: number;
  maxVolume: number;
}

// =============================================================================
// Helpers
// =============================================================================

function formatPRLabel(type: PRType, value: number): string {
  switch (type) {
    case 'max_weight':
      return `Best weight: ${value} lbs`;
    case 'max_reps':
      return `Best reps: ${value}`;
    case 'max_velocity':
      return `Best velocity: ${value.toFixed(2)} m/s`;
    case 'max_volume':
      return `Best volume: ${Math.round(value)} lbs`;
  }
}

// =============================================================================
// PR Snapshot Builder
// =============================================================================

/**
 * Build a PR snapshot from a list of previously completed sets.
 * Call this before appending the newest set.
 */
export function buildPRSnapshot(priorSets: CompletedSet[]): PRSnapshot {
  if (priorSets.length === 0) {
    return { maxWeight: 0, maxReps: 0, maxVelocity: 0, maxVolume: 0 };
  }

  let maxWeight = 0;
  let maxReps = 0;
  let maxVelocity = 0;
  let maxVolume = 0;

  for (const s of priorSets) {
    if (s.weight > maxWeight) maxWeight = s.weight;

    const reps = s.data.reps.length;
    if (reps > maxReps) maxReps = reps;

    const vel = getSetPeakVelocity(s.data);
    if (vel > maxVelocity) maxVelocity = vel;

    const vol = s.weight * reps;
    if (vol > maxVolume) maxVolume = vol;
  }

  return { maxWeight, maxReps, maxVelocity, maxVolume };
}

// =============================================================================
// PR Detection
// =============================================================================

/**
 * Detect which PRs the given set breaks against the snapshot.
 * Returns empty array when there is no prior history (empty snapshot).
 */
export function detectPRs(set: CompletedSet, snapshot: PRSnapshot): PRBadge[] {
  if (
    snapshot.maxWeight === 0 &&
    snapshot.maxReps === 0 &&
    snapshot.maxVelocity === 0 &&
    snapshot.maxVolume === 0
  ) {
    return [];
  }

  const badges: PRBadge[] = [];
  const reps = set.data.reps.length;
  const velocity = getSetPeakVelocity(set.data);
  const volume = set.weight * reps;

  if (set.weight > snapshot.maxWeight) {
    badges.push({ type: 'max_weight', label: formatPRLabel('max_weight', set.weight), value: set.weight });
  }
  if (reps > snapshot.maxReps) {
    badges.push({ type: 'max_reps', label: formatPRLabel('max_reps', reps), value: reps });
  }
  if (velocity > snapshot.maxVelocity) {
    badges.push({ type: 'max_velocity', label: formatPRLabel('max_velocity', velocity), value: velocity });
  }
  if (volume > snapshot.maxVolume) {
    badges.push({ type: 'max_volume', label: formatPRLabel('max_volume', volume), value: volume });
  }

  return badges;
}
