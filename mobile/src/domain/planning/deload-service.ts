/**
 * Deload Service
 *
 * Detects when an athlete needs a deload week based on training load patterns
 * and generates reduced-volume recommendations to support recovery.
 *
 * Deload is triggered when:
 * - ACWR exceeds 1.3 (elevated injury risk threshold)
 * - 3+ consecutive weeks of progressive volume overload
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import {
  computeTrainingLoad,
  computeVolumeBuckets,
} from '@/domain/history/services/cross-session-analytics';

// =============================================================================
// Types
// =============================================================================

/** Reason a deload was triggered. */
export type DeloadReason = 'high_acwr' | 'progressive_overload_streak';

/** Deload recommendation output. */
export interface DeloadRecommendation {
  shouldDeload: boolean;
  reason: DeloadReason | null;
  /** Fraction of normal volume to use (e.g. 0.6 = 60%). Null if no deload needed. */
  volumeReduction: number | null;
  /** How long to maintain the deload (days). Null if no deload needed. */
  durationDays: number | null;
  /** Human-readable explanation shown in the UI. */
  message: string;
}

/** Configuration for deload detection thresholds. */
export interface DeloadConfig {
  /** ACWR threshold above which deload is triggered. Default: 1.3 */
  acwrThreshold: number;
  /** Consecutive volume increases required to trigger. Default: 3 */
  progressiveWeeksThreshold: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: DeloadConfig = {
  acwrThreshold: 1.3,
  progressiveWeeksThreshold: 3,
};

/** Volume during a deload = 60-70% of normal. We use 65% as the midpoint. */
const DELOAD_VOLUME_FRACTION = 0.65;

const DELOAD_DURATION_DAYS = 7;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Count consecutive week-over-week volume increases ending at the most recent week.
 * Uses the last `maxWeeks` weekly buckets, sorted chronologically.
 * Returns the number of consecutive "increase" transitions (not the number of weeks).
 */
function countProgressiveOverloadStreak(
  sessions: StoredExerciseSession[],
  maxWeeks: number = 6
): number {
  const buckets = computeVolumeBuckets(sessions, 'weekly', maxWeeks);
  if (buckets.length < 2) return 0;

  let streak = 0;
  for (let i = buckets.length - 1; i > 0; i--) {
    if (buckets[i].totalVolume > buckets[i - 1].totalVolume) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Determine whether the athlete should take a deload week.
 *
 * Returns true if ACWR exceeds the threshold OR if there have been
 * `progressiveWeeksThreshold` or more consecutive week-over-week volume increases.
 */
export function shouldDeload(
  sessions: StoredExerciseSession[],
  config: DeloadConfig = DEFAULT_CONFIG
): boolean {
  const load = computeTrainingLoad(sessions);
  if (load.acwr > config.acwrThreshold) return true;

  const streak = countProgressiveOverloadStreak(sessions);
  return streak >= config.progressiveWeeksThreshold;
}

/**
 * Generate a full deload recommendation from recent session history.
 *
 * Checks ACWR first (higher priority), then progressive overload streak.
 * Returns a no-deload recommendation when neither condition is met.
 */
export function generateDeloadPlan(
  sessions: StoredExerciseSession[],
  config: DeloadConfig = DEFAULT_CONFIG
): DeloadRecommendation {
  const load = computeTrainingLoad(sessions);

  if (load.acwr > config.acwrThreshold) {
    return {
      shouldDeload: true,
      reason: 'high_acwr',
      volumeReduction: DELOAD_VOLUME_FRACTION,
      durationDays: DELOAD_DURATION_DAYS,
      message: `Your training load ratio is ${load.acwr.toFixed(2)} — above the safe threshold. A deload week at 65% volume will help you recover and come back stronger.`,
    };
  }

  const streak = countProgressiveOverloadStreak(sessions);
  if (streak >= config.progressiveWeeksThreshold) {
    return {
      shouldDeload: true,
      reason: 'progressive_overload_streak',
      volumeReduction: DELOAD_VOLUME_FRACTION,
      durationDays: DELOAD_DURATION_DAYS,
      message: `You've increased volume for ${streak} consecutive weeks. A planned deload at 65% volume will consolidate your gains and prevent accumulated fatigue.`,
    };
  }

  return {
    shouldDeload: false,
    reason: null,
    volumeReduction: null,
    durationDays: null,
    message: 'Training load looks healthy — keep up the good work.',
  };
}
