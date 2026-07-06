/**
 * Velocity Auto-Stop
 *
 * Detects when an athlete's rep velocity has declined past a configurable
 * threshold, signaling that the set should be automatically terminated.
 *
 * Guards:
 * - Never triggers on first rep (no baseline)
 * - Never triggers on warmup sets
 * - Only triggers after 3+ reps completed (need enough data)
 * - Requires 2+ consecutive reps exceeding threshold (filters single bad reps)
 */

import {
  type Set as AnalyticsSet,
  getSetVelocityLossPct,
  getRepPeakVelocity,
} from '@voltras/workout-analytics';

// =============================================================================
// Types
// =============================================================================

export interface VelocityAutoStopConfig {
  enabled: boolean;
  /** Velocity loss threshold as a percentage (e.g. 20 means 20%) */
  thresholdPct: number;
}

export interface VelocityAutoStopResult {
  shouldStop: boolean;
  velocityLossPct: number;
  consecutiveRepsOverThreshold: number;
}

export interface VelocityAutoStopTracker {
  consecutiveRepsOverThreshold: number;
}

export const DEFAULT_AUTO_STOP_CONFIG: VelocityAutoStopConfig = {
  enabled: false,
  thresholdPct: 20,
};

const MIN_REPS_FOR_AUTO_STOP = 3;
const CONSECUTIVE_REPS_REQUIRED = 2;

// =============================================================================
// Core Logic
// =============================================================================

export function createAutoStopTracker(): VelocityAutoStopTracker {
  return { consecutiveRepsOverThreshold: 0 };
}

/**
 * Evaluate whether the current set should be auto-stopped based on velocity loss.
 *
 * Called after each rep completion. Returns whether the set should stop and
 * the current velocity loss percentage for display.
 */
export function evaluateAutoStop(
  analyticsSet: AnalyticsSet,
  tracker: VelocityAutoStopTracker,
  config: VelocityAutoStopConfig,
  isWarmup: boolean
): VelocityAutoStopResult {
  const repCount = analyticsSet.reps.length;
  const velocityLossPct = Math.abs(getSetVelocityLossPct(analyticsSet));

  const noStop: VelocityAutoStopResult = {
    shouldStop: false,
    velocityLossPct,
    consecutiveRepsOverThreshold: tracker.consecutiveRepsOverThreshold,
  };

  if (!config.enabled || isWarmup || repCount < MIN_REPS_FOR_AUTO_STOP) {
    tracker.consecutiveRepsOverThreshold = 0;
    return noStop;
  }

  const lastRep = analyticsSet.reps.at(-1);
  const firstRep = analyticsSet.reps[0];
  if (!lastRep || !firstRep) {
    return noStop;
  }

  const firstVelocity = getRepPeakVelocity(firstRep);
  const lastVelocity = getRepPeakVelocity(lastRep);

  if (firstVelocity <= 0) {
    return noStop;
  }

  const repVelocityLossPct = ((firstVelocity - lastVelocity) / firstVelocity) * 100;

  if (repVelocityLossPct >= config.thresholdPct) {
    tracker.consecutiveRepsOverThreshold++;
  } else {
    tracker.consecutiveRepsOverThreshold = 0;
  }

  return {
    shouldStop: tracker.consecutiveRepsOverThreshold >= CONSECUTIVE_REPS_REQUIRED,
    velocityLossPct,
    consecutiveRepsOverThreshold: tracker.consecutiveRepsOverThreshold,
  };
}
