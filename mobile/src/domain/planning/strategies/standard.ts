/**
 * Standard Planning Strategy
 * 
 * Intra-workout adaptation logic extracted from AdaptiveEngine.
 * Uses SessionMetrics as input for all decisions.
 * 
 * Responsibilities:
 * - Weight adjustments based on velocity loss
 * - Rest period adjustments based on fatigue
 * - Set termination decisions (junk volume detection)
 * - Extra set eligibility
 */

import type { SessionMetrics, FatigueEstimate } from '@/domain/workout/metrics/types';
import type { TrainingGoal, PlanAdjustment } from '../types';
import { VELOCITY_LOSS_TARGETS, REST_DEFAULTS, RIR_DEFAULTS, PROGRESSION_INCREMENTS } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface SetPerformance {
  setNumber: number;
  reps: number;
  weight: number;
  velocityLossPercent: number;
  estimatedRir: number;
  firstRepVelocity: number;
  avgVelocity: number;
  grindingDetected?: boolean;
}

export interface StandardStrategyConfig {
  goal: TrainingGoal;
  exerciseType: 'compound' | 'isolation';
  allowWeightAdjustment: boolean;
  allowSetAdjustment: boolean;
  maxSets: number;
  minSets: number;
  velocityLossTarget?: [number, number];
  baseRestSeconds?: number;
}

export interface WeightAdjustmentResult {
  adjustment: number;
  reason: string;
  shouldAdjust: boolean;
}

export interface RestAdjustmentResult {
  extraRest: number;
  reason: string;
  shouldExtend: boolean;
}

export interface StopDecision {
  shouldStop: boolean;
  reason: 'target_reached' | 'fatigue_limit' | 'junk_volume' | 'velocity_grinding' | null;
  message: string;
}

export interface ExtraSetEligibility {
  canAddSet: boolean;
  reason: string;
}

// =============================================================================
// Constants
// =============================================================================

/** % tolerance around target velocity loss */
const VL_TOLERANCE = 5.0;

/** Expected rep drop thresholds */
const REP_DROP_WARNING = 0.30;  // 30% drop triggers extended rest
const REP_DROP_STOP = 0.50;    // 50% drop = junk volume

/** Velocity drop thresholds */
const VELOCITY_DROP_WARNING = 0.40;  // 40% first-rep velocity drop

/** Expected rep drop by rest period (seconds) */
export const EXPECTED_REP_DROP: Record<number, number> = {
  60: 0.35,   // 1 min rest: ~35% drop
  120: 0.20,  // 2 min rest: ~20% drop
  180: 0.15,  // 3 min rest: ~15% drop
};

// =============================================================================
// Weight Adjustment
// =============================================================================

/**
 * Calculate weight adjustment based on velocity loss and fatigue.
 * 
 * Uses SessionMetrics to determine if weight should be increased or decreased.
 */
export function calculateWeightAdjustment(
  metrics: SessionMetrics,
  lastSetVelocityLoss: number,
  config: StandardStrategyConfig
): WeightAdjustmentResult {
  const [targetVlMin, targetVlMax] = config.velocityLossTarget ?? VELOCITY_LOSS_TARGETS[config.goal];
  const increment = PROGRESSION_INCREMENTS[config.exerciseType];
  
  // Check if fatigue is too high - don't increase (level > 0.7 = high fatigue)
  if (metrics.fatigue.level > 0.7 || metrics.fatigue.isJunkVolume) {
    return {
      adjustment: 0,
      reason: 'Fatigue too high for weight increase',
      shouldAdjust: false,
    };
  }
  
  // VL significantly under target - can increase weight
  if (lastSetVelocityLoss < targetVlMin - VL_TOLERANCE) {
    return {
      adjustment: increment,
      reason: `Velocity loss ${lastSetVelocityLoss.toFixed(0)}% under target ${targetVlMin}%`,
      shouldAdjust: true,
    };
  }
  
  // VL significantly over target - should decrease weight
  if (lastSetVelocityLoss > targetVlMax + VL_TOLERANCE) {
    return {
      adjustment: -increment,
      reason: `Velocity loss ${lastSetVelocityLoss.toFixed(0)}% over target ${targetVlMax}%`,
      shouldAdjust: true,
    };
  }
  
  // In range - no change
  return {
    adjustment: 0,
    reason: `Velocity loss ${lastSetVelocityLoss.toFixed(0)}% within target range`,
    shouldAdjust: false,
  };
}

// =============================================================================
// Rest Adjustment
// =============================================================================

/**
 * Calculate rest period adjustment based on fatigue metrics.
 */
export function calculateRestAdjustment(
  metrics: SessionMetrics,
  lastSetVelocityLoss: number,
  config: StandardStrategyConfig
): RestAdjustmentResult {
  const baseRest = config.baseRestSeconds ?? REST_DEFAULTS[config.goal];
  let extraRest = 0;
  let reason = '';
  
  // Velocity loss based adjustment
  if (lastSetVelocityLoss > 40) {
    extraRest = 60;
    reason = 'High velocity loss - need more recovery';
  } else if (lastSetVelocityLoss > 30) {
    extraRest = 30;
    reason = 'Moderate velocity loss - slight rest extension';
  }
  
  // Fatigue-based adjustment (level > 0.7 = high fatigue)
  if (metrics.fatigue.level > 0.7) {
    // Ensure at least 3 min rest
    const minRest = 180;
    if (baseRest + extraRest < minRest) {
      extraRest = minRest - baseRest;
      reason = 'High fatigue - ensuring adequate recovery';
    }
  }
  
  // Rep drop based adjustment
  if (metrics.fatigue.repDropPercent > REP_DROP_WARNING * 100) {
    const minRest = 180;
    if (baseRest + extraRest < minRest) {
      extraRest = minRest - baseRest;
      reason = `${metrics.fatigue.repDropPercent.toFixed(0)}% rep drop - extended rest`;
    }
  }
  
  return {
    extraRest,
    reason,
    shouldExtend: extraRest > 0,
  };
}

// =============================================================================
// Stop Decisions
// =============================================================================

/**
 * Determine if workout should stop based on fatigue and junk volume.
 */
export function shouldStop(
  metrics: SessionMetrics,
  setsCompleted: number,
  plannedSets: number,
  config: StandardStrategyConfig
): StopDecision {
  // Check for junk volume
  if (metrics.fatigue.isJunkVolume) {
    return {
      shouldStop: true,
      reason: 'junk_volume',
      message: 'Good work - additional sets won\'t help much',
    };
  }
  
  // Check velocity recovery
  if (metrics.fatigue.velocityRecoveryPercent < 60) {
    return {
      shouldStop: true,
      reason: 'velocity_grinding',
      message: 'Velocity dropping significantly - time to stop',
    };
  }
  
  // Check if we've hit planned sets
  if (setsCompleted >= plannedSets) {
    return {
      shouldStop: true,
      reason: 'target_reached',
      message: 'Great job - exercise complete!',
    };
  }
  
  // Check if below minimum sets but fatigue is extreme
  if (setsCompleted >= config.minSets && metrics.fatigue.level > 0.7) {
    return {
      shouldStop: true,
      reason: 'fatigue_limit',
      message: 'Met minimum sets - stopping due to fatigue',
    };
  }
  
  return {
    shouldStop: false,
    reason: null,
    message: '',
  };
}

/**
 * Check if session is showing signs of junk volume.
 * Extracted from AdaptiveEngine.isJunkVolume().
 */
export function checkJunkVolume(fatigue: FatigueEstimate): boolean {
  // Rep drop >= 50% is junk volume
  if (fatigue.repDropPercent >= REP_DROP_STOP * 100) {
    return true;
  }
  
  // Velocity drop >= 40% is junk volume
  if (fatigue.velocityRecoveryPercent <= (1 - VELOCITY_DROP_WARNING) * 100) {
    return true;
  }
  
  return fatigue.isJunkVolume;
}

// =============================================================================
// Extra Set Eligibility
// =============================================================================

/**
 * Determine if an extra set beyond the plan is advisable.
 */
export function canAddSet(
  metrics: SessionMetrics,
  lastSet: SetPerformance,
  setsCompleted: number,
  config: StandardStrategyConfig
): ExtraSetEligibility {
  // Already at max
  if (setsCompleted >= config.maxSets) {
    return {
      canAddSet: false,
      reason: 'Already at maximum sets',
    };
  }
  
  // RIR too low
  if (lastSet.estimatedRir < RIR_DEFAULTS[config.exerciseType]) {
    return {
      canAddSet: false,
      reason: 'Too close to failure for another set',
    };
  }
  
  // VL over target
  const [, targetVlMax] = config.velocityLossTarget ?? VELOCITY_LOSS_TARGETS[config.goal];
  if (lastSet.velocityLossPercent > targetVlMax) {
    return {
      canAddSet: false,
      reason: 'Velocity loss already at target',
    };
  }
  
  // Junk volume
  if (metrics.fatigue.isJunkVolume) {
    return {
      canAddSet: false,
      reason: 'Would be junk volume',
    };
  }
  
  // High fatigue
  if (metrics.fatigue.level > 0.7) {
    return {
      canAddSet: false,
      reason: 'Fatigue too high',
    };
  }
  
  return {
    canAddSet: true,
    reason: 'Feeling good - can add another set',
  };
}

// =============================================================================
// Expected Performance
// =============================================================================

/**
 * Get expected performance for a set based on first set and rest period.
 */
export function getExpectedPerformance(
  setNumber: number,
  firstSetReps: number,
  restSeconds: number
): { expectedReps: number; expectedDropPercent: number } | null {
  if (setNumber === 1 || firstSetReps <= 0) {
    return null;
  }
  
  // Get expected rep drop for this rest period
  const expectedDrop = EXPECTED_REP_DROP[restSeconds] ?? 
    EXPECTED_REP_DROP[120]; // Default to 2 min if not found
  
  // Compound drop across sets
  const cumulativeDrop = 1 - Math.pow(1 - expectedDrop, setNumber - 1);
  
  const expectedReps = Math.max(1, Math.round(
    firstSetReps * (1 - cumulativeDrop)
  ));
  
  return {
    expectedReps,
    expectedDropPercent: cumulativeDrop * 100,
  };
}

/**
 * Check if actual performance is within expected range.
 */
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
  const repDeviation = expectedReps > 0 
    ? (actualReps - expectedReps) / expectedReps 
    : 0;
  const velocityDeviation = expectedVelocity > 0
    ? (actualVelocity - expectedVelocity) / expectedVelocity
    : 0;
  
  const withinExpectations = (
    Math.abs(repDeviation) <= tolerance &&
    Math.abs(velocityDeviation) <= tolerance
  );
  
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

// =============================================================================
// Adjustment Creation Helper
// =============================================================================

/**
 * Create a PlanAdjustment record for tracking.
 */
export function createAdjustment(
  type: PlanAdjustment['type'],
  reason: string,
  confidence: PlanAdjustment['confidence'],
  from?: number | [number, number],
  to?: number | [number, number]
): PlanAdjustment {
  return { type, reason, confidence, from, to };
}
