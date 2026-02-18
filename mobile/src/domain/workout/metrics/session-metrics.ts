/**
 * Session Metrics Computation
 *
 * Functions to compute metrics from exercise session data.
 * Uses @voltras/workout-analytics library for per-set analytics.
 */

import type { CompletedSet } from '../models/completed-set';
import type { ExerciseSession } from '../models/session';
import type {
  SessionMetrics,
  StrengthEstimate,
  ReadinessEstimate,
  FatigueEstimate,
  ReadinessAdjustments,
} from './types';
import {
  READINESS_THRESHOLDS,
  EXPECTED_REP_DROP,
  JUNK_VOLUME_THRESHOLD,
  createEmptyStrengthEstimate,
  createDefaultReadinessEstimate,
  createEmptyFatigueEstimate,
} from './types';
import type { VelocityBaseline } from './baseline';
import { getBaselineVelocity } from './baseline';
import type { LoadVelocityProfile } from '@/domain/vbt';
import { getSetMeanVelocity, getSetVelocityLossPct } from '@voltras/workout-analytics';

// =============================================================================
// Main Computation Function
// =============================================================================

/**
 * Compute all session metrics from session data.
 */
export function computeSessionMetrics(
  session: ExerciseSession,
  baseline?: VelocityBaseline,
  velocityProfile?: LoadVelocityProfile
): SessionMetrics {
  const completedSets = session.completedSets;

  const strength = velocityProfile
    ? computeStrengthFromProfile(velocityProfile)
    : computeStrengthFromSets(completedSets);

  const readiness = baseline
    ? computeReadinessFromWarmups(completedSets, baseline)
    : createDefaultReadinessEstimate();

  const fatigue = computeFatigueFromSets(completedSets);

  const volumeAccumulated = computeVolume(completedSets);
  const effectiveVolume = computeEffectiveVolume(completedSets);

  return {
    strength,
    readiness,
    fatigue,
    volumeAccumulated,
    effectiveVolume,
  };
}

// =============================================================================
// Strength Estimation
// =============================================================================

function computeStrengthFromProfile(profile: LoadVelocityProfile): StrengthEstimate {
  const confidenceMap: Record<string, number> = {
    high: 0.9,
    medium: 0.7,
    low: 0.4,
  };

  return {
    estimated1RM: profile.estimated1RM,
    confidence: confidenceMap[profile.confidence] ?? 0.5,
    source: 'session',
  };
}

function computeStrengthFromSets(sets: CompletedSet[]): StrengthEstimate {
  if (sets.length === 0) {
    return createEmptyStrengthEstimate();
  }

  let best1RM = 0;
  let bestConfidence = 0;

  for (const set of sets) {
    const reps = set.data.reps.length;
    if (reps === 0) continue;

    const estimated1RM = set.weight * (1 + reps / 30);
    const repConfidence = Math.max(0, 1 - reps / 15);
    const weightConfidence = set.weight > 0 ? Math.min(1, set.weight / 200) : 0;
    const confidence = (repConfidence + weightConfidence) / 2;

    if (estimated1RM > best1RM) {
      best1RM = estimated1RM;
      bestConfidence = confidence;
    }
  }

  return {
    estimated1RM: Math.round(best1RM),
    confidence: bestConfidence,
    source: 'session',
  };
}

export function computeStrengthEstimate(
  weight: number,
  reps: number,
  velocity?: number
): StrengthEstimate {
  if (reps === 0 || weight === 0) {
    return createEmptyStrengthEstimate();
  }

  const estimated1RM = weight * (1 + reps / 30);

  let confidence = Math.max(0.3, 1 - reps / 15);
  if (velocity && velocity < 0.3) {
    confidence = Math.min(1, confidence + 0.2);
  }

  return {
    estimated1RM: Math.round(estimated1RM),
    confidence,
    source: 'session',
  };
}

// =============================================================================
// Readiness Estimation
// =============================================================================

function computeReadinessFromWarmups(
  sets: CompletedSet[],
  baseline: VelocityBaseline
): ReadinessEstimate {
  if (sets.length === 0) {
    return createDefaultReadinessEstimate();
  }

  const maxWeight = Math.max(...sets.map((s) => s.weight));
  const warmupSets = sets.filter((s) => s.weight < maxWeight);

  if (warmupSets.length === 0) {
    return createDefaultReadinessEstimate();
  }

  const checkSet = warmupSets[warmupSets.length - 1];
  const actualVelocity = getSetMeanVelocity(checkSet.data);
  const baselineVelocity = getBaselineVelocity(baseline, checkSet.weight);

  if (baselineVelocity === null || baselineVelocity <= 0) {
    return createDefaultReadinessEstimate();
  }

  return computeReadinessEstimate(actualVelocity, baselineVelocity, checkSet.weight);
}

export function computeReadinessEstimate(
  actualVelocity: number,
  baselineVelocity: number,
  weight: number,
  weightIncrement: number = 5
): ReadinessEstimate {
  const velocityRatio = actualVelocity / baselineVelocity;
  const velocityPercent = velocityRatio * 100;

  let zone: 'green' | 'yellow' | 'red';
  let adjustments: ReadinessAdjustments;
  let message: string;
  let confidence: number;

  if (velocityRatio > READINESS_THRESHOLDS.excellent) {
    zone = 'green';
    adjustments = { weight: weightIncrement, volume: 1.1 };
    confidence = 0.9;
    message = `Feeling strong! Bumping weight +${weightIncrement} lbs`;
  } else if (velocityRatio >= READINESS_THRESHOLDS.normal) {
    zone = 'green';
    adjustments = { weight: 0, volume: 1.0 };
    confidence = 0.9;
    message = 'Ready to go - proceeding as planned';
  } else if (velocityRatio >= READINESS_THRESHOLDS.fatigued) {
    zone = 'yellow';
    const reductionFactor =
      (READINESS_THRESHOLDS.normal - velocityRatio) /
      (READINESS_THRESHOLDS.normal - READINESS_THRESHOLDS.fatigued);
    const weightReduction = -Math.round(reductionFactor * 2) * weightIncrement;
    adjustments = { weight: weightReduction, volume: 1.0 };
    confidence = 0.7;
    message = `A bit off today - reducing weight ${Math.abs(weightReduction)} lbs`;
  } else {
    zone = 'red';
    adjustments = { weight: -2 * weightIncrement, volume: 0.75 };
    confidence = 0.9;
    message = 'Take it easy today - your body needs recovery';
  }

  return {
    zone,
    velocityPercent: Math.round(velocityPercent * 10) / 10,
    confidence,
    adjustments,
    message,
  };
}

export function estimateReadinessFromFirstRep(
  firstRepVelocity: number,
  baselineVelocity: number | null
): ReadinessEstimate {
  if (baselineVelocity === null || baselineVelocity <= 0) {
    return createDefaultReadinessEstimate();
  }

  const velocityPercent = (firstRepVelocity / baselineVelocity) * 100;
  const velocityRatio = firstRepVelocity / baselineVelocity;

  let zone: 'green' | 'yellow' | 'red';
  let message: string;

  if (velocityRatio > 1.05) {
    zone = 'green';
    message = 'Strong start!';
  } else if (velocityRatio >= 0.95) {
    zone = 'green';
    message = 'Good start';
  } else if (velocityRatio >= 0.85) {
    zone = 'yellow';
    message = 'Starting slower than usual';
  } else {
    zone = 'red';
    message = 'Significantly slower - consider reducing weight';
  }

  return {
    zone,
    velocityPercent: Math.round(velocityPercent * 10) / 10,
    confidence: 0.5,
    adjustments: { weight: 0, volume: 1.0 },
    message,
  };
}

// =============================================================================
// Fatigue Estimation
// =============================================================================

function computeFatigueFromSets(sets: CompletedSet[]): FatigueEstimate {
  if (sets.length < 2) {
    return createEmptyFatigueEstimate();
  }

  const firstSet = sets[0];
  const lastSet = sets[sets.length - 1];

  const firstVelocity = getSetMeanVelocity(firstSet.data);
  const lastVelocity = getSetMeanVelocity(lastSet.data);
  const velocityRecoveryPercent = firstVelocity > 0 ? (lastVelocity / firstVelocity) * 100 : 100;

  let repDropPercent = 0;
  if (firstSet.weight === lastSet.weight) {
    const firstReps = firstSet.data.reps.length;
    const lastReps = lastSet.data.reps.length;
    repDropPercent = firstReps > 0 ? ((firstReps - lastReps) / firstReps) * 100 : 0;
  }

  const isJunkVolume = checkIsJunkVolume(sets);
  const velocityFatigue = 1 - velocityRecoveryPercent / 100;
  const repFatigue = repDropPercent / 100;
  const level = Math.min(1, (velocityFatigue + repFatigue) / 2);

  return {
    level,
    isJunkVolume,
    velocityRecoveryPercent: Math.round(velocityRecoveryPercent * 10) / 10,
    repDropPercent: Math.round(repDropPercent * 10) / 10,
  };
}

export function computeFatigueEstimate(
  currentSet: CompletedSet,
  firstSet: CompletedSet
): FatigueEstimate {
  const firstVelocity = getSetMeanVelocity(firstSet.data);
  const currentVelocity = getSetMeanVelocity(currentSet.data);

  const velocityRecoveryPercent =
    firstVelocity > 0 ? (currentVelocity / firstVelocity) * 100 : 100;

  let repDropPercent = 0;
  if (firstSet.weight === currentSet.weight) {
    const firstReps = firstSet.data.reps.length;
    const currentReps = currentSet.data.reps.length;
    repDropPercent = firstReps > 0 ? ((firstReps - currentReps) / firstReps) * 100 : 0;
  }

  const isJunkVolume = repDropPercent >= JUNK_VOLUME_THRESHOLD * 100;
  const velocityFatigue = 1 - velocityRecoveryPercent / 100;
  const repFatigue = repDropPercent / 100;
  const level = Math.min(1, (velocityFatigue + repFatigue) / 2);

  return {
    level,
    isJunkVolume,
    velocityRecoveryPercent: Math.round(velocityRecoveryPercent * 10) / 10,
    repDropPercent: Math.round(repDropPercent * 10) / 10,
  };
}

function checkIsJunkVolume(sets: CompletedSet[]): boolean {
  if (sets.length < 2) return false;

  const sortedByWeight = [...sets].sort((a, b) => b.weight - a.weight);
  const firstWorkingSet = sortedByWeight[0];
  const lastSet = sets[sets.length - 1];

  if (lastSet.weight !== firstWorkingSet.weight) {
    return false;
  }

  const firstReps = firstWorkingSet.data.reps.length;
  const lastReps = lastSet.data.reps.length;

  if (firstReps === 0) return false;

  const repDrop = (firstReps - lastReps) / firstReps;
  return repDrop >= JUNK_VOLUME_THRESHOLD;
}

export function checkVelocityRecovery(
  currentFirstRepVelocity: number,
  set1FirstRepVelocity: number,
  targetRecoveryPercent: number = 0.9
): { recovered: boolean; currentPercent: number; recommendation: string } {
  if (set1FirstRepVelocity <= 0) {
    return {
      recovered: true,
      currentPercent: 100,
      recommendation: 'Ready to go',
    };
  }

  const currentPercent = (currentFirstRepVelocity / set1FirstRepVelocity) * 100;
  const recovered = currentPercent >= targetRecoveryPercent * 100;

  let recommendation: string;
  if (recovered) {
    recommendation = 'Velocity recovered - ready for next set';
  } else if (currentPercent >= 85) {
    recommendation = 'Almost recovered - 30 more seconds recommended';
  } else {
    recommendation = 'Still fatigued - rest a bit longer';
  }

  return {
    recovered,
    currentPercent: Math.round(currentPercent * 10) / 10,
    recommendation,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

export function hasAdequateProfileData(sets: CompletedSet[]): boolean {
  if (sets.length < 2) return false;

  const weights = sets.map((s) => s.weight);
  const velocities = sets.map((s) => getSetMeanVelocity(s.data));

  const minWeight = Math.min(...weights);
  const weightSpread = minWeight > 0 ? (Math.max(...weights) - minWeight) / minWeight : 0;
  const velocitySpread = Math.max(...velocities) - Math.min(...velocities);

  return weightSpread >= 0.2 && velocitySpread >= 0.15;
}

export function isSetWithinExpectations(
  actualReps: number,
  expectedReps: number,
  actualVelocity: number,
  expectedVelocity: number,
  tolerance: number = 0.15
): {
  withinExpectations: boolean;
  repDeviation: number;
  velocityDeviation: number;
  assessment: string;
} {
  const repDeviation = expectedReps > 0 ? (actualReps - expectedReps) / expectedReps : 0;
  const velocityDeviation =
    expectedVelocity > 0 ? (actualVelocity - expectedVelocity) / expectedVelocity : 0;

  const withinExpectations =
    Math.abs(repDeviation) <= tolerance && Math.abs(velocityDeviation) <= tolerance;

  let assessment: string;
  if (repDeviation > tolerance) {
    assessment = 'Performing better than expected';
  } else if (repDeviation < -tolerance) {
    assessment = 'Performing below expected - may need more rest';
  } else if (velocityDeviation < -tolerance) {
    assessment = 'Velocity dropping faster than normal';
  } else {
    assessment = 'On track';
  }

  return {
    withinExpectations,
    repDeviation: Math.round(repDeviation * 1000) / 10,
    velocityDeviation: Math.round(velocityDeviation * 1000) / 10,
    assessment,
  };
}

export function getExpectedPerformance(
  setNumber: number,
  firstSetReps: number,
  restSeconds: number
): { expectedReps: number; expectedDropPercent: number } | null {
  if (setNumber === 1 || firstSetReps === 0) {
    return null;
  }

  const expectedDrop = EXPECTED_REP_DROP[restSeconds] ?? 0.15;
  const cumulativeDrop = 1 - Math.pow(1 - expectedDrop, setNumber - 1);
  const expectedReps = Math.max(1, Math.round(firstSetReps * (1 - cumulativeDrop)));

  return {
    expectedReps,
    expectedDropPercent: cumulativeDrop * 100,
  };
}

function computeVolume(sets: CompletedSet[]): number {
  return sets.reduce((total, set) => total + set.weight * set.data.reps.length, 0);
}

function computeEffectiveVolume(sets: CompletedSet[]): number {
  return sets.reduce((total, set) => {
    const reps = set.data.reps.length;
    const velocityLoss = Math.abs(getSetVelocityLossPct(set.data));
    const estimatedRIR = Math.max(0, 5 - velocityLoss / 10);
    const effectiveMultiplier = 1 - estimatedRIR / 10;
    return total + set.weight * reps * effectiveMultiplier;
  }, 0);
}
