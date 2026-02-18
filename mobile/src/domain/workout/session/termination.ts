/**
 * Session Termination Logic
 *
 * Unified termination rules for both discovery and standard sessions.
 * Checked after every set completion.
 *
 * Termination rules:
 * - All sessions: failure (0 reps), velocity grinding (< 0.3 m/s), plan exhausted
 * - Standard only: junk volume (50%+ rep drop from first working set)
 * - Discovery only: profile complete (enough data points with good spread)
 */

import type { CompletedSet } from '../models/completed-set';
import type { ExerciseSession } from '../models/session';
import { getSetMeanVelocity } from '@voltras/workout-analytics';

/**
 * Reason why a session terminated.
 */
export type TerminationReason =
  | 'failure' // 0 reps (auto-detected via idle timeout)
  | 'velocity_grinding' // Near max effort (< 0.3 m/s)
  | 'junk_volume' // Significant performance drop (> 50% rep drop)
  | 'plan_exhausted' // Completed all planned sets
  | 'profile_complete' // Discovery: enough data points
  | 'user_stopped'; // User chose to end early

/**
 * Result of termination check.
 */
export interface TerminationResult {
  shouldTerminate: boolean;
  reason?: TerminationReason;
  message?: string; // User-facing explanation
}

/**
 * Configuration for termination rules.
 */
export interface TerminationConfig {
  /** Velocity threshold for grinding detection (m/s) */
  velocityGrindingThreshold: number;
  /** Rep drop threshold for junk volume (0-1) */
  junkVolumeThreshold: number;
  /** Minimum data points for profile completion */
  profileMinPoints: number;
  /** Minimum weight spread for profile completion (as ratio) */
  profileMinWeightSpread: number;
}

/**
 * Default termination configuration.
 */
export const DEFAULT_TERMINATION_CONFIG: TerminationConfig = {
  velocityGrindingThreshold: 0.3, // m/s
  junkVolumeThreshold: 0.5, // 50% rep drop
  profileMinPoints: 3,
  profileMinWeightSpread: 0.3, // 30% weight spread
};

/**
 * Check if session should terminate after completing a set.
 *
 * Applies different rules for discovery vs standard sessions.
 * Called after every set completion (including auto-stopped sets).
 */
export function checkTermination(
  session: ExerciseSession,
  lastSet: CompletedSet,
  config: TerminationConfig = DEFAULT_TERMINATION_CONFIG
): TerminationResult {
  const isDiscovery = session.plan.generatedBy === 'discovery';

  // Check failure (0 reps)
  const failureResult = checkFailure(lastSet);
  if (failureResult.shouldTerminate) {
    return failureResult;
  }

  // Check velocity grinding
  const grindingResult = checkVelocityGrinding(lastSet, config);
  if (grindingResult.shouldTerminate) {
    return grindingResult;
  }

  // Check plan exhausted
  const exhaustedResult = checkPlanExhausted(session);
  if (exhaustedResult.shouldTerminate) {
    return exhaustedResult;
  }

  // Standard-only: Check junk volume
  if (!isDiscovery) {
    const junkResult = checkJunkVolume(session, config);
    if (junkResult.shouldTerminate) {
      return junkResult;
    }
  }

  // Discovery-only: Check profile complete
  if (isDiscovery) {
    const profileResult = checkProfileComplete(session, config);
    if (profileResult.shouldTerminate) {
      return profileResult;
    }
  }

  return { shouldTerminate: false };
}

/**
 * Check for failure (0 reps completed).
 */
function checkFailure(lastSet: CompletedSet): TerminationResult {
  if (lastSet.data.reps.length === 0) {
    return {
      shouldTerminate: true,
      reason: 'failure',
      message: 'No reps completed - reached failure',
    };
  }
  return { shouldTerminate: false };
}

/**
 * Check for velocity grinding (near max effort).
 */
function checkVelocityGrinding(lastSet: CompletedSet, config: TerminationConfig): TerminationResult {
  const meanVelocity = getSetMeanVelocity(lastSet.data);

  if (meanVelocity < config.velocityGrindingThreshold) {
    return {
      shouldTerminate: true,
      reason: 'velocity_grinding',
      message: `Velocity too low (${meanVelocity.toFixed(2)} m/s) - near max effort`,
    };
  }
  return { shouldTerminate: false };
}

/**
 * Check if plan is exhausted (all sets completed).
 */
function checkPlanExhausted(session: ExerciseSession): TerminationResult {
  if (session.completedSets.length >= session.plan.sets.length) {
    return {
      shouldTerminate: true,
      reason: 'plan_exhausted',
      message: 'All planned sets completed',
    };
  }
  return { shouldTerminate: false };
}

/**
 * Check for junk volume (significant rep drop from first working set).
 * Only applies to standard sessions.
 */
function checkJunkVolume(session: ExerciseSession, config: TerminationConfig): TerminationResult {
  // Need at least 2 sets to compare
  if (session.completedSets.length < 2) {
    return { shouldTerminate: false };
  }

  // Find first working set (highest weight = first working set typically)
  // In practice, warmups have lower weights
  const sortedByWeight = [...session.completedSets].sort((a, b) => b.weight - a.weight);
  const firstWorkingSet = sortedByWeight[0];
  const lastSet = session.completedSets[session.completedSets.length - 1];

  // Only compare sets at same weight (working sets)
  if (lastSet.weight !== firstWorkingSet.weight) {
    return { shouldTerminate: false };
  }

  const firstReps = firstWorkingSet.data.reps.length;
  const lastReps = lastSet.data.reps.length;

  if (firstReps === 0) {
    return { shouldTerminate: false };
  }

  const repDrop = (firstReps - lastReps) / firstReps;

  if (repDrop >= config.junkVolumeThreshold) {
    return {
      shouldTerminate: true,
      reason: 'junk_volume',
      message: `Rep count dropped ${Math.round(repDrop * 100)}% - entering junk volume`,
    };
  }

  return { shouldTerminate: false };
}

/**
 * Check if discovery profile is complete (enough data points with good spread).
 * Only applies to discovery sessions.
 */
function checkProfileComplete(
  session: ExerciseSession,
  config: TerminationConfig
): TerminationResult {
  const sets = session.completedSets;

  // Need minimum number of data points
  if (sets.length < config.profileMinPoints) {
    return { shouldTerminate: false };
  }

  // Check weight spread
  const weights = sets.map((s) => s.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  if (minWeight === 0) {
    return { shouldTerminate: false };
  }

  const weightSpread = (maxWeight - minWeight) / minWeight;

  // Check velocity spread (indicates we've covered a good range)
  const velocities = sets.map((s) => getSetMeanVelocity(s.data));
  const maxVelocity = Math.max(...velocities);
  const minVelocity = Math.min(...velocities);
  const velocitySpread = maxVelocity - minVelocity;

  // Profile is complete if we have enough data points with good spread
  if (weightSpread >= config.profileMinWeightSpread && velocitySpread >= 0.3) {
    return {
      shouldTerminate: true,
      reason: 'profile_complete',
      message: 'Enough data collected for velocity profile',
    };
  }

  return { shouldTerminate: false };
}

/**
 * Create a user-stopped termination result.
 */
export function createUserStoppedTermination(): TerminationResult {
  return {
    shouldTerminate: true,
    reason: 'user_stopped',
    message: 'Session ended by user',
  };
}

/**
 * Get a user-friendly message for a termination reason.
 */
export function getTerminationMessage(reason: TerminationReason): string {
  switch (reason) {
    case 'failure':
      return 'Session ended: reached failure';
    case 'velocity_grinding':
      return 'Session ended: near max effort';
    case 'junk_volume':
      return 'Session ended: performance declined';
    case 'plan_exhausted':
      return 'Session complete!';
    case 'profile_complete':
      return 'Discovery complete!';
    case 'user_stopped':
      return 'Session saved';
  }
}
