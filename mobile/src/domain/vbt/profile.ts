/**
 * Load-Velocity Profile Builder
 *
 * App-level wrapper around @voltras/workout-analytics profile functions.
 * The core regression and prediction logic is delegated to the library.
 *
 * This module adds app-specific concerns:
 * - `exerciseId` and `createdAt` on profiles
 * - `weight`-based data points (library uses `load`)
 * - Training goal-aware recommendation generation
 * - Warmup set generation
 */

import {
  buildProfile as libBuildProfile,
  estimateE1RMFromReps,
  type LoadVelocityDataPoint as LibraryDataPoint,
  type LoadVelocityProfile as LibraryProfile,
} from '@voltras/workout-analytics';

import {
  MINIMUM_VELOCITY_THRESHOLD,
  TRAINING_ZONES,
  REP_RANGES,
  estimatePercent1RMFromVelocity,
} from '@/domain/vbt/constants';
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
  workingWeight: number;
  repRange: [number, number];
  warmupSets: WarmupSet[];
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  profile: LoadVelocityProfile;
  estimated1RM: number;
}

export interface WarmupSet {
  weight: number;
  reps: number;
  purpose: string;
  restSeconds: number;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/** Convert app data point (weight) to library data point (load). */
function toLibraryPoint(dp: LoadVelocityDataPoint): LibraryDataPoint {
  return { load: dp.weight, velocity: dp.velocity, timestamp: dp.timestamp };
}

/** Convert library profile to app profile with metadata. */
function toAppProfile(
  libProfile: LibraryProfile,
  exerciseId: string,
  originalPoints: LoadVelocityDataPoint[]
): LoadVelocityProfile {
  return {
    exerciseId,
    dataPoints: [...originalPoints],
    slope: libProfile.slope,
    intercept: libProfile.intercept,
    rSquared: libProfile.rSquared,
    estimated1RM: Math.round(libProfile.estimated1RM / 5) * 5,
    confidence: libProfile.confidence,
    mvt: libProfile.mvt,
    createdAt: Date.now(),
  };
}

// =============================================================================
// Profile Builder (delegates to library)
// =============================================================================

/**
 * Build a load-velocity profile from data points.
 * Regression is performed by @voltras/workout-analytics.
 */
export function buildLoadVelocityProfile(
  exerciseId: string,
  dataPoints: LoadVelocityDataPoint[]
): LoadVelocityProfile {
  if (dataPoints.length === 0) {
    return createEmptyProfile(exerciseId);
  }

  const libraryPoints = dataPoints.map(toLibraryPoint);
  const libProfile = libBuildProfile(libraryPoints, MINIMUM_VELOCITY_THRESHOLD);

  const appProfile = toAppProfile(libProfile, exerciseId, dataPoints);

  // Ensure estimated 1RM is at least as high as the heaviest tested weight
  const maxWeight = Math.max(...dataPoints.map((p) => p.weight));
  appProfile.estimated1RM = Math.max(appProfile.estimated1RM, maxWeight);

  return appProfile;
}

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

// =============================================================================
// Profile Utilities (delegate to library)
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
    return 0;
  }

  const weight = (targetVelocity - profile.intercept) / profile.slope;
  return Math.max(5, Math.round(weight / 5) * 5);
}

/**
 * Predict velocity at a given weight using the profile.
 * Uses the linear equation: velocity = slope * weight + intercept
 */
export function predictVelocityAtWeight(profile: LoadVelocityProfile, weight: number): number {
  return Math.max(0, profile.slope * weight + profile.intercept);
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
// Recommendation Generation (app-specific)
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

  const workingWeight = estimateWeightForPercent1RM(profile, targetZone.optimal);
  const warmupSets = generateWarmupSets(profile.estimated1RM, workingWeight);
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

  return warmupSets.filter((s) => s.weight >= 5 && s.weight < workingWeight);
}

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
// 1RM Estimation (delegates to library)
// =============================================================================

/**
 * Estimate 1RM from a single set.
 * Uses velocity-based estimation when available, falls back to Epley formula.
 */
export function estimate1RMFromSet(weight: number, reps: number, velocity?: number): number {
  if (velocity && velocity > 0) {
    const percent = estimatePercent1RMFromVelocity(velocity);
    return Math.round(weight / (percent / 100) / 5) * 5;
  }

  // Delegate to library's Epley-based estimation
  const estimate = estimateE1RMFromReps(weight, reps);
  return Math.round(estimate.e1RM / 5) * 5;
}
