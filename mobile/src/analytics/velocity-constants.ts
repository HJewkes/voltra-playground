/**
 * Voltra Velocity-Based Training Constants
 * 
 * Centralized constants for velocity zones, %1RM relationships,
 * and training goal thresholds. Used across discovery, analytics,
 * and workout planning modules.
 * 
 * Research basis:
 * - González-Badillo & Sánchez-Medina (2010) - Load-velocity relationship
 * - Pareja-Blanco et al. (2017) - VL thresholds and adaptations
 * - Sánchez-Medina & González-Badillo (2011) - Velocity loss as fatigue
 * - Rodiles-Guerrero et al. (2020) - Cable machine VL thresholds
 */

import { TrainingGoal } from '@/planning/models';

// =============================================================================
// Velocity at %1RM
// =============================================================================

/**
 * Mean concentric velocity at different percentages of 1RM.
 * These are approximate values - individual variation exists.
 * 
 * Use for:
 * - Estimating %1RM from observed velocity
 * - Predicting velocity at a target %1RM
 * - Building load-velocity profiles
 */
export const VELOCITY_AT_PERCENT_1RM: Record<number, number> = {
  100: 0.17,  // Minimum velocity threshold (MVT)
  95: 0.25,
  90: 0.37,
  85: 0.47,
  80: 0.55,
  75: 0.62,
  70: 0.72,
  65: 0.82,
  60: 0.90,
  55: 1.00,
  50: 1.10,
  45: 1.20,
  40: 1.30,
};

/**
 * Minimum velocity threshold - below this, the rep is likely a max effort.
 * Also called "velocity floor" or "sticking point velocity".
 */
export const MINIMUM_VELOCITY_THRESHOLD = 0.17;

// =============================================================================
// Training Zones
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
  STRENGTH: { min: 5, max: 10 },      // Heavy, low reps, minimal fatigue
  HYPERTROPHY: { min: 20, max: 25 },  // Moderate, metabolic stress
  POWER: { min: 10, max: 15 },        // Explosive, minimal fatigue
  ENDURANCE: { min: 25, max: 35 },    // High reps, sustained effort
} as const;

// =============================================================================
// Velocity-RIR Mapping (Cable-Specific)
// =============================================================================

/**
 * Velocity loss to RIR/RPE mapping.
 * 
 * More conservative than barbell research due to cable characteristics:
 * - Constant tension throughout ROM
 * - Continuous motor unit engagement
 * - Earlier fatigue onset
 * 
 * Format: [maxLossPercent, rir, rpe]
 */
export const VELOCITY_RIR_MAP: [number, number, number][] = [
  [10, 5.0, 5.0],   // 10% loss → ~5+ RIR
  [15, 4.0, 6.0],
  [20, 3.0, 7.0],   // 20% loss → ~3 RIR (conservative)
  [25, 2.5, 7.5],
  [30, 2.0, 8.0],   // 30% loss → ~2 RIR
  [35, 1.5, 8.5],
  [40, 1.0, 9.0],   // 40% loss → ~1 RIR
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
  medium: { minPoints: 2, minRSquared: 0.70, minWeightSpread: 0.15 },
  low: { minPoints: 1, minRSquared: 0, minWeightSpread: 0 },
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Estimate %1RM from mean concentric velocity.
 */
export function estimatePercent1RMFromVelocity(velocity: number): number {
  // Find the closest velocity in our table
  let closest = 50;
  let minDiff = Infinity;
  
  for (const [percent, v] of Object.entries(VELOCITY_AT_PERCENT_1RM)) {
    const diff = Math.abs(velocity - v);
    if (diff < minDiff) {
      minDiff = diff;
      closest = Number(percent);
    }
  }
  
  return closest;
}

/**
 * Get target velocity range for a training goal.
 */
export function getTargetVelocityForGoal(goal: TrainingGoal): { min: number; max: number } {
  const zone = TRAINING_ZONES[goal];
  
  return {
    min: VELOCITY_AT_PERCENT_1RM[zone.max] ?? 0.45,
    max: VELOCITY_AT_PERCENT_1RM[zone.min] ?? 0.85,
  };
}

/**
 * Estimate RIR from velocity loss percentage.
 */
export function estimateRIRFromVelocityLoss(velocityLossPercent: number): number {
  if (velocityLossPercent < 0) return 6; // Getting faster = very fresh
  
  for (const [maxLoss, rir] of VELOCITY_RIR_MAP) {
    if (velocityLossPercent <= maxLoss) {
      return rir;
    }
  }
  return 0;
}

/**
 * Estimate RPE from velocity loss percentage.
 */
export function estimateRPEFromVelocityLoss(velocityLossPercent: number): number {
  if (velocityLossPercent < 0) return 4; // Getting faster = very fresh
  
  for (const [maxLoss, , rpe] of VELOCITY_RIR_MAP) {
    if (velocityLossPercent <= maxLoss) {
      return rpe;
    }
  }
  return 10;
}

/**
 * Categorize velocity into training quality zones.
 */
export type VelocityTrend = 'fast' | 'moderate' | 'slow' | 'grinding';

export function categorizeVelocity(velocity: number): VelocityTrend {
  if (velocity > 0.9) return 'fast';
  if (velocity > 0.55) return 'moderate';
  if (velocity > 0.30) return 'slow';
  return 'grinding';
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
