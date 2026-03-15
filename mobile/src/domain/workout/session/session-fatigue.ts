/**
 * Session Fatigue Tracking
 *
 * Computes a running fatigue score across a full session by comparing
 * mean velocity of the first working set to the latest set at the same weight.
 *
 * Integration point: called during rest periods after each completed set,
 * visible on the exercise screen once the first set is done.
 */

import { getSetMeanVelocity } from '@voltras/workout-analytics';
import type { CompletedSet } from '../models/completed-set';

/** Human-readable fatigue category. */
export type FatigueTrend = 'fresh' | 'moderate' | 'fatigued' | 'exhausted';

export interface SessionFatigueResult {
  /** 0 = no fatigue, 100 = complete velocity loss relative to first set. */
  fatigueScore: number;
  /** Categorical description of current fatigue level. */
  trend: FatigueTrend;
  /** Mean velocity decline from first set to latest set (m/s, positive = slower). */
  velocityDecline: number;
}

/** Weight tolerance band — sets within ±2.5 lbs are treated as same-load. */
const WEIGHT_BAND_LBS = 2.5;

/**
 * Find the first and latest completed sets at a comparable load.
 *
 * Uses the weight of the last set as the reference load, then finds the
 * earliest set within the tolerance band. This handles minor weight
 * adjustments (e.g. micro-plates) while still catching genuine load changes.
 */
function findComparableSets(
  completedSets: CompletedSet[],
): { first: CompletedSet; latest: CompletedSet } | null {
  if (completedSets.length < 2) return null;

  const latest = completedSets[completedSets.length - 1];
  const first = completedSets.find(
    (s) => Math.abs(s.weight - latest.weight) <= WEIGHT_BAND_LBS,
  );

  if (!first || first === latest) return null;

  return { first, latest };
}

function deriveTrend(score: number): FatigueTrend {
  if (score < 20) return 'fresh';
  if (score < 45) return 'moderate';
  if (score < 70) return 'fatigued';
  return 'exhausted';
}

/**
 * Compute session-level fatigue from all completed sets.
 *
 * Returns null when there are fewer than two sets at the same weight —
 * fatigue cannot be assessed without a baseline and a comparison point.
 */
export function computeSessionFatigue(
  completedSets: CompletedSet[],
): SessionFatigueResult | null {
  const pair = findComparableSets(completedSets);
  if (!pair) return null;

  const firstVelocity = getSetMeanVelocity(pair.first.data);
  const latestVelocity = getSetMeanVelocity(pair.latest.data);

  if (firstVelocity <= 0) return null;

  const velocityDecline = firstVelocity - latestVelocity;
  const rawScore = (velocityDecline / firstVelocity) * 100;

  // Clamp to [0, 100] — velocity can occasionally exceed first set (warm-up effect).
  const fatigueScore = Math.min(100, Math.max(0, rawScore));

  return {
    fatigueScore,
    trend: deriveTrend(fatigueScore),
    velocityDecline,
  };
}
