/**
 * VBT Constants and Utility Functions
 *
 * Core VBT reference data (velocity tables, %1RM estimation, velocity zones)
 * comes from @voltras/workout-analytics.
 *
 * App-specific training zone constants (goal thresholds, rep ranges,
 * discovery percentages) are defined here.
 *
 * Research basis:
 * - González-Badillo & Sánchez-Medina (2010) - Load-velocity relationship
 * - Pareja-Blanco et al. (2017) - VL thresholds and adaptations
 * - Sánchez-Medina & González-Badillo (2011) - Velocity loss as fatigue
 * - Rodiles-Guerrero et al. (2020) - Cable machine VL thresholds
 */

// Import directly from types to avoid circular dependency with planning/strategies
import { TrainingGoal } from '@/domain/planning/types';
import {
  VELOCITY_AT_PERCENT_1RM as LIB_VELOCITY_TABLE,
  DEFAULT_MVT,
  estimatePercent1RMFromVelocity as libEstimatePercent1RM,
  categorizeVelocity as libCategorizeVelocity,
  type VelocityZone,
} from '@voltras/workout-analytics';

// =============================================================================
// Re-exports from @voltras/workout-analytics
// =============================================================================

/** Mean concentric velocity at different %1RM (from library). */
export const VELOCITY_AT_PERCENT_1RM = LIB_VELOCITY_TABLE;

/** Minimum velocity threshold (0.17 m/s) from library. */
export const MINIMUM_VELOCITY_THRESHOLD = DEFAULT_MVT;

/** Estimate %1RM from mean concentric velocity (from library). */
export const estimatePercent1RMFromVelocity = libEstimatePercent1RM;

/** Categorize velocity into qualitative zones (from library). */
export const categorizeVelocity = libCategorizeVelocity;

/** Velocity zone type -- re-exported as VelocityTrend for app compatibility. */
export type VelocityTrend = VelocityZone;

// =============================================================================
// App-Specific Training Zones
// =============================================================================

/**
 * Target %1RM ranges for different training goals.
 *
 * - STRENGTH: High intensity, low reps (1-5)
 * - HYPERTROPHY: Moderate intensity, moderate reps (8-12)
 * - ENDURANCE: Lower intensity, high reps (15-20+)
 */
export const TRAINING_ZONES: Record<TrainingGoal, { min: number; max: number; optimal: number }> = {
  [TrainingGoal.STRENGTH]: { min: 82, max: 92, optimal: 87 },
  [TrainingGoal.HYPERTROPHY]: { min: 65, max: 80, optimal: 72 },
  [TrainingGoal.ENDURANCE]: { min: 50, max: 65, optimal: 57 },
};

/**
 * Target rep ranges for different training goals.
 */
export const REP_RANGES: Record<TrainingGoal, [number, number]> = {
  [TrainingGoal.STRENGTH]: [3, 6],
  [TrainingGoal.HYPERTROPHY]: [8, 12],
  [TrainingGoal.ENDURANCE]: [15, 20],
};

// =============================================================================
// Velocity Loss Thresholds
// =============================================================================

/**
 * Velocity loss thresholds for different training goals.
 *
 * Key insight: cables may reach failure at SMALLER velocity losses
 * than barbells due to constant tension and continuous motor unit engagement.
 *
 * Format: { min, max } as percentage loss from first rep
 */
export const VELOCITY_LOSS_TARGETS = {
  STRENGTH: { min: 5, max: 10 },
  HYPERTROPHY: { min: 20, max: 25 },
  POWER: { min: 10, max: 15 },
  ENDURANCE: { min: 25, max: 35 },
} as const;

// =============================================================================
// Velocity-RIR Mapping (Cable-Specific)
// =============================================================================

/**
 * Velocity loss to RIR/RPE mapping (tuple format for app display).
 *
 * Format: [maxLossPercent, rir, rpe]
 *
 * Note: The library provides a configurable InterpolationScheme-based mapping
 * (DEFAULT_VELOCITY_RIR_MAP) for computation. This tuple array is retained
 * for the app's VBT display and reference UI.
 */
export const VELOCITY_RIR_MAP: [number, number, number][] = [
  [10, 5.0, 5.0],
  [15, 4.0, 6.0],
  [20, 3.0, 7.0],
  [25, 2.5, 7.5],
  [30, 2.0, 8.0],
  [35, 1.5, 8.5],
  [40, 1.0, 9.0],
  [50, 0.5, 9.5],
  [100, 0.0, 10.0],
];

// =============================================================================
// Discovery Constants
// =============================================================================

/**
 * Starting weights as rough %1RM for discovery sets.
 * Used when building load-velocity profile from scratch.
 */
export const DISCOVERY_START_PERCENTAGES = [30, 50, 65, 75, 85];

/**
 * Minimum data points needed for profile confidence levels.
 */
export const PROFILE_CONFIDENCE_REQUIREMENTS = {
  high: { minPoints: 3, minRSquared: 0.85, minWeightSpread: 0.2 },
  medium: { minPoints: 2, minRSquared: 0.7, minWeightSpread: 0.15 },
  low: { minPoints: 1, minRSquared: 0, minWeightSpread: 0 },
} as const;

// =============================================================================
// App-Specific Utility Functions
// =============================================================================

/**
 * Get target velocity range for a training goal.
 */
export function getTargetVelocityForGoal(goal: TrainingGoal): { min: number; max: number } {
  const zone = TRAINING_ZONES[goal];

  return {
    min: LIB_VELOCITY_TABLE[zone.max] ?? 0.45,
    max: LIB_VELOCITY_TABLE[zone.min] ?? 0.85,
  };
}

/**
 * Suggest next weight based on current performance.
 */
export function suggestNextWeight(
  currentWeight: number,
  currentVelocity: number,
  goal: TrainingGoal,
  increment: number = 5
): { weight: number; direction: 'up' | 'down' | 'same'; reason: string } {
  const targetVelocity = getTargetVelocityForGoal(goal);

  if (currentVelocity > targetVelocity.max) {
    return {
      weight: currentWeight + increment,
      direction: 'up',
      reason: `Velocity ${currentVelocity.toFixed(2)} m/s is above target range`,
    };
  }

  if (currentVelocity < targetVelocity.min) {
    return {
      weight: Math.max(5, currentWeight - increment),
      direction: 'down',
      reason: `Velocity ${currentVelocity.toFixed(2)} m/s is below target range`,
    };
  }

  return {
    weight: currentWeight,
    direction: 'same',
    reason: `Velocity ${currentVelocity.toFixed(2)} m/s is in target range`,
  };
}
