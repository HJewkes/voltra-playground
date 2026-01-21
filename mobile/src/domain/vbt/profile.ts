/**
 * Load-Velocity Profile Builder
 *
 * Builds and analyzes load-velocity profiles for 1RM estimation
 * and training zone recommendations. Used by weight discovery and
 * ongoing workout analytics.
 *
 * The load-velocity relationship is approximately linear, allowing us to:
 * 1. Extrapolate 1RM from 2-3 submaximal data points
 * 2. Predict velocity at any given %1RM
 * 3. Recommend working weights for specific training goals
 */

import {
  MINIMUM_VELOCITY_THRESHOLD,
  TRAINING_ZONES,
  REP_RANGES,
  PROFILE_CONFIDENCE_REQUIREMENTS,
  estimatePercent1RMFromVelocity,
} from '@/domain/vbt/constants';
// Import directly from types to avoid circular dependency with planning/strategies
import { TrainingGoal } from '@/domain/planning/types';

// =============================================================================
// Types
// =============================================================================

export interface LoadVelocityDataPoint {
  weight: number;
  velocity: number;
  timestamp?: number;
}

export interface LoadVelocityProfile {
  exerciseId: string;
  dataPoints: LoadVelocityDataPoint[];

  /** Linear regression: velocity = slope * weight + intercept */
  slope: number;
  intercept: number;
  rSquared: number;

  /** Estimated 1RM from the profile */
  estimated1RM: number;

  /** Confidence in the estimate */
  confidence: 'high' | 'medium' | 'low';

  /** Minimum velocity threshold for this user/exercise */
  mvt: number;

  /** When the profile was created */
  createdAt: number;
}

export interface WorkingWeightRecommendation {
  /** Recommended working weight */
  workingWeight: number;

  /** Target rep range */
  repRange: [number, number];

  /** Recommended warmup sets */
  warmupSets: WarmupSet[];

  /** Confidence in recommendation */
  confidence: 'high' | 'medium' | 'low';

  /** Human-readable explanation */
  explanation: string;

  /** The profile used to generate this */
  profile: LoadVelocityProfile;

  /** Estimated 1RM from the profile */
  estimated1RM: number;
}

export interface WarmupSet {
  weight: number;
  reps: number;
  purpose: string;
  restSeconds: number;
}

// =============================================================================
// Profile Builder
// =============================================================================

/**
 * Build a load-velocity profile from data points.
 * Uses linear regression to model the relationship.
 */
export function buildLoadVelocityProfile(
  exerciseId: string,
  dataPoints: LoadVelocityDataPoint[]
): LoadVelocityProfile {
  const n = dataPoints.length;

  if (n === 0) {
    return createEmptyProfile(exerciseId);
  }

  const weights = dataPoints.map((p) => p.weight);
  const velocities = dataPoints.map((p) => p.velocity);

  // Calculate means
  const meanWeight = weights.reduce((a, b) => a + b, 0) / n;
  const meanVelocity = velocities.reduce((a, b) => a + b, 0) / n;

  // Calculate slope and intercept via linear regression
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (weights[i] - meanWeight) * (velocities[i] - meanVelocity);
    denominator += (weights[i] - meanWeight) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanVelocity - slope * meanWeight;

  // Calculate R-squared (goodness of fit)
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const predicted = slope * weights[i] + intercept;
    ssRes += (velocities[i] - predicted) ** 2;
    ssTot += (velocities[i] - meanVelocity) ** 2;
  }

  const rSquared = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // Estimate 1RM (weight where velocity = MVT)
  // MVT = slope * weight + intercept
  // weight = (MVT - intercept) / slope
  const mvt = MINIMUM_VELOCITY_THRESHOLD;
  let estimated1RM = slope !== 0 ? Math.round((mvt - intercept) / slope / 5) * 5 : 0;

  // Ensure estimated 1RM is at least as high as the heaviest tested weight
  estimated1RM = Math.max(estimated1RM, Math.max(...weights));

  // Determine confidence
  const confidence = determineConfidence(dataPoints, rSquared);

  return {
    exerciseId,
    dataPoints: [...dataPoints],
    slope,
    intercept,
    rSquared,
    estimated1RM,
    confidence,
    mvt,
    createdAt: Date.now(),
  };
}

/**
 * Create an empty profile for an exercise with no data.
 */
function createEmptyProfile(exerciseId: string): LoadVelocityProfile {
  return {
    exerciseId,
    dataPoints: [],
    slope: 0,
    intercept: 0,
    rSquared: 0,
    estimated1RM: 0,
    confidence: 'low',
    mvt: MINIMUM_VELOCITY_THRESHOLD,
    createdAt: Date.now(),
  };
}

/**
 * Determine profile confidence based on data quality.
 */
function determineConfidence(
  dataPoints: LoadVelocityDataPoint[],
  rSquared: number
): 'high' | 'medium' | 'low' {
  const n = dataPoints.length;

  if (n < 2) return 'low';

  // Check weight spread
  const weights = dataPoints.map((p) => p.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightSpread = minWeight > 0 ? (maxWeight - minWeight) / minWeight : 0;

  // Check velocity spread
  const velocities = dataPoints.map((p) => p.velocity);
  const velocitySpread = Math.max(...velocities) - Math.min(...velocities);

  const { high, medium } = PROFILE_CONFIDENCE_REQUIREMENTS;

  if (n >= high.minPoints && rSquared >= high.minRSquared && weightSpread >= high.minWeightSpread) {
    return 'high';
  }

  if (n >= medium.minPoints && rSquared >= medium.minRSquared && velocitySpread >= 0.15) {
    return 'medium';
  }

  return 'low';
}

// =============================================================================
// Profile Utilities
// =============================================================================

/**
 * Estimate weight for a target %1RM using the profile.
 */
export function estimateWeightForPercent1RM(profile: LoadVelocityProfile, percent: number): number {
  if (profile.estimated1RM === 0) return 0;

  const targetWeight = Math.round((profile.estimated1RM * (percent / 100)) / 5) * 5;
  return Math.max(5, targetWeight);
}

/**
 * Estimate weight for a target velocity using the profile.
 * Uses the linear equation: weight = (velocity - intercept) / slope
 */
export function estimateWeightForVelocity(
  profile: LoadVelocityProfile,
  targetVelocity: number
): number {
  if (profile.slope === 0 || profile.slope >= 0) {
    // Invalid slope (velocity should decrease with weight)
    return 0;
  }

  const weight = (targetVelocity - profile.intercept) / profile.slope;
  return Math.max(5, Math.round(weight / 5) * 5);
}

/**
 * Predict velocity at a given weight using the profile.
 */
export function predictVelocityAtWeight(profile: LoadVelocityProfile, weight: number): number {
  return profile.slope * weight + profile.intercept;
}

/**
 * Add a new data point to an existing profile and rebuild.
 */
export function addDataPointToProfile(
  profile: LoadVelocityProfile,
  newPoint: LoadVelocityDataPoint
): LoadVelocityProfile {
  const updatedPoints = [...profile.dataPoints, newPoint];
  return buildLoadVelocityProfile(profile.exerciseId, updatedPoints);
}

// =============================================================================
// Recommendation Generation
// =============================================================================

/**
 * Generate working weight recommendation from a profile.
 */
export function generateWorkingWeightRecommendation(
  profile: LoadVelocityProfile,
  goal: TrainingGoal
): WorkingWeightRecommendation {
  const targetZone = TRAINING_ZONES[goal];
  const repRange = REP_RANGES[goal];

  // Calculate working weight at optimal %1RM for goal
  const workingWeight = estimateWeightForPercent1RM(profile, targetZone.optimal);

  // Generate warmup sets
  const warmupSets = generateWarmupSets(profile.estimated1RM, workingWeight);

  // Generate explanation
  const explanation = generateExplanation(profile, workingWeight, goal);

  return {
    workingWeight,
    repRange,
    warmupSets,
    confidence: profile.confidence,
    explanation,
    profile,
    estimated1RM: profile.estimated1RM,
  };
}

/**
 * Generate warmup sets based on estimated 1RM and working weight.
 */
export function generateWarmupSets(estimated1RM: number, workingWeight: number): WarmupSet[] {
  if (estimated1RM === 0) return [];

  const warmupSets: WarmupSet[] = [
    {
      weight: Math.round((estimated1RM * 0.4) / 5) * 5,
      reps: 10,
      purpose: 'Get moving, feel the groove',
      restSeconds: 60,
    },
    {
      weight: Math.round((estimated1RM * 0.6) / 5) * 5,
      reps: 6,
      purpose: 'Increase load, activate muscles',
      restSeconds: 90,
    },
    {
      weight: Math.round((estimated1RM * 0.75) / 5) * 5,
      reps: 3,
      purpose: 'Prime nervous system (readiness check)',
      restSeconds: 120,
    },
  ];

  // Filter out sets that are too light or at/above working weight
  return warmupSets.filter((s) => s.weight >= 5 && s.weight < workingWeight);
}

/**
 * Generate human-readable explanation for recommendations.
 */
function generateExplanation(
  profile: LoadVelocityProfile,
  workingWeight: number,
  goal: TrainingGoal
): string {
  const targetZone = TRAINING_ZONES[goal];

  const goalNames: Record<TrainingGoal, string> = {
    [TrainingGoal.STRENGTH]: 'strength',
    [TrainingGoal.HYPERTROPHY]: 'muscle growth',
    [TrainingGoal.ENDURANCE]: 'endurance',
  };

  const confidenceText: Record<string, string> = {
    high: "Based on your velocity data, I'm confident that",
    medium: 'Based on initial data,',
    low: 'As a starting point,',
  };

  return (
    `${confidenceText[profile.confidence]} your estimated 1RM is around ${profile.estimated1RM} lbs. ` +
    `For ${goalNames[goal]} training (${targetZone.min}-${targetZone.max}% of max), ` +
    `your working weight should be around ${workingWeight} lbs. ` +
    `We'll track your performance and adjust as we learn more.`
  );
}

// =============================================================================
// 1RM Estimation Utilities
// =============================================================================

/**
 * Estimate 1RM from a single set (using Epley formula as fallback).
 */
export function estimate1RMFromSet(weight: number, reps: number, velocity?: number): number {
  if (velocity && velocity > 0) {
    // Use velocity-based estimation
    const percent = estimatePercent1RMFromVelocity(velocity);
    return Math.round(weight / (percent / 100) / 5) * 5;
  }

  // Fallback to Epley formula
  if (reps === 1) return weight;
  return Math.round((weight * (1 + reps / 30)) / 5) * 5;
}
