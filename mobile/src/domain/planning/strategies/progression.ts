/**
 * Progression Planning Strategy
 * 
 * Workout-to-workout progression logic extracted from ProgressionEngine.
 * Handles linear, double, and autoregulated progression schemes.
 * 
 * Responsibilities:
 * - Determine weight/rep changes for next workout
 * - Detect deload needs
 * - Track exercise trends
 */

import type { SessionMetrics } from '@/domain/workout/metrics/types';
import type { TrainingGoal, TrainingLevel, ProgressionScheme, HistoricalMetrics } from '../types';
import { VELOCITY_LOSS_TARGETS, PROGRESSION_INCREMENTS } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface ProgressionContext {
  exerciseId: string;
  exerciseType: 'compound' | 'isolation';
  goal: TrainingGoal;
  level: TrainingLevel;
  scheme: ProgressionScheme;
  
  /** Current session metrics */
  sessionMetrics: SessionMetrics;
  
  /** Historical data */
  historicalMetrics: HistoricalMetrics;
  
  /** Session performance */
  weight: number;
  totalReps: number;
  setsCompleted: number;
  repRange: [number, number];
  avgVelocityLoss: number;
  avgRir: number;
}

export interface ProgressionDecision {
  action: 'increase' | 'maintain' | 'decrease' | 'deload';
  weightChange: number;
  repRangeChange?: [number, number];
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  /** User-facing message */
  message: string;
}

export interface DeloadTrigger {
  triggerType: 'time' | 'performance' | 'readiness' | 'user_reported';
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
  detectedAt: number;
}

export interface DeloadWeek {
  /** Volume reduction (0.5 = 50% of normal sets) */
  volumeReduction: number;
  /** Intensity reduction (0.15 = 85% of normal weight) */
  intensityReduction: number;
  /** Never go below this RIR */
  rirFloor: number;
  /** Duration in days */
  durationDays: number;
  /** "active" (light training) or "rest" (skip gym) */
  mode: 'active' | 'rest';
  /** What triggered this deload */
  trigger?: DeloadTrigger;
}

export interface ExerciseTrend {
  sessionsAnalyzed: number;
  weightTrend: 'increasing' | 'decreasing' | 'stable';
  weightChange: number;
  repChangePercent: number;
  velocityLossChange: number;
  improving: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const CONSECUTIVE_FAILURES_FOR_DELOAD = 2;
const WEEKS_BETWEEN_DELOADS_INTERMEDIATE = 5;
const WEEKS_BETWEEN_DELOADS_ADVANCED = 6;

export const DEFAULT_DELOAD: DeloadWeek = {
  volumeReduction: 0.5,
  intensityReduction: 0.15,
  rirFloor: 4,
  durationDays: 7,
  mode: 'active',
};

// =============================================================================
// Progression Decision
// =============================================================================

/**
 * Get progression recommendation for next workout.
 */
export function getProgressionRecommendation(
  context: ProgressionContext
): ProgressionDecision {
  // Check for consecutive failures first
  const failures = context.historicalMetrics.sessionCount > 0 
    ? countConsecutiveFailures(context) 
    : 0;
    
  if (failures >= CONSECUTIVE_FAILURES_FOR_DELOAD) {
    return makeDeloadDecision(context, 'consecutive_failures');
  }
  
  // Route to appropriate progression logic
  switch (context.scheme) {
    case 'linear':
      return linearProgression(context);
    case 'double':
      return doubleProgression(context);
    case 'autoregulated':
      return autoregulatedProgression(context);
    default:
      return doubleProgression(context);
  }
}

/**
 * Linear progression: add weight every session if reps are hit.
 * Best for novices who can progress rapidly.
 */
export function linearProgression(context: ProgressionContext): ProgressionDecision {
  const [minReps] = context.repRange;
  const repsPerSet = context.totalReps / Math.max(1, context.setsCompleted);
  const increment = PROGRESSION_INCREMENTS[context.exerciseType];
  
  if (repsPerSet >= minReps) {
    // Hit target - add weight
    const newWeight = context.weight + increment;
    
    return {
      action: 'increase',
      weightChange: increment,
      reason: `Hit ${Math.round(repsPerSet)} reps/set - ready to add weight`,
      confidence: 'high',
      message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
    };
  }
  
  // Missed target - maintain
  return {
    action: 'maintain',
    weightChange: 0,
    reason: `Only ${Math.round(repsPerSet)} reps/set - build up first`,
    confidence: 'medium',
    message: 'Next time: Same weight, keep building',
  };
}

/**
 * Double progression: add reps until top of range, then add weight.
 * Best for intermediates who need more gradual progress.
 */
export function doubleProgression(context: ProgressionContext): ProgressionDecision {
  const [minReps, maxReps] = context.repRange;
  const repsPerSet = context.totalReps / Math.max(1, context.setsCompleted);
  const rir = context.avgRir;
  const increment = PROGRESSION_INCREMENTS[context.exerciseType];
  
  if (repsPerSet >= maxReps && rir >= 2) {
    // Ready to increase weight
    const newWeight = context.weight + increment;
    
    return {
      action: 'increase',
      weightChange: increment,
      reason: `Hit ${maxReps} reps at RIR ${Math.round(rir)} - ready for more weight`,
      confidence: 'high',
      message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
    };
  }
  
  if (repsPerSet >= maxReps && rir < 2) {
    // Hit top of range but was hard - consolidate
    return {
      action: 'maintain',
      weightChange: 0,
      reason: `Hit ${maxReps} reps but RIR ${Math.round(rir)} - consolidate first`,
      confidence: 'medium',
      message: 'Next time: Same weight, focus on consistency',
    };
  }
  
  if (repsPerSet >= minReps) {
    // In range but not at top - keep building
    return {
      action: 'maintain',
      weightChange: 0,
      reason: `Hit ${Math.round(repsPerSet)} reps - keep building to ${maxReps}`,
      confidence: 'high',
      message: 'Next time: Same weight, keep building',
    };
  }
  
  // Missed minimum
  return {
    action: 'maintain',
    weightChange: 0,
    reason: `Only ${Math.round(repsPerSet)} reps - try again next session`,
    confidence: 'low',
    message: 'Next time: Same weight, keep building',
  };
}

/**
 * Autoregulated progression: progress based on velocity and readiness.
 * Best for advanced trainees who need individualized progression.
 */
export function autoregulatedProgression(context: ProgressionContext): ProgressionDecision {
  const vl = context.avgVelocityLoss;
  const [targetVlMin, targetVlMax] = VELOCITY_LOSS_TARGETS[context.goal];
  const increment = PROGRESSION_INCREMENTS[context.exerciseType];
  
  // Check velocity trend
  const trend = context.historicalMetrics.trend;
  
  // Decision logic
  if (vl < targetVlMin - 5) {
    // Way under target - increase weight
    const newWeight = context.weight + increment;
    
    return {
      action: 'increase',
      weightChange: increment,
      reason: `VL ${Math.round(vl)}% is well under target - ready for more`,
      confidence: 'high',
      message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
    };
  }
  
  if (trend === 'improving' && context.avgRir >= 2) {
    // Getting easier over time
    const newWeight = context.weight + increment;
    
    return {
      action: 'increase',
      weightChange: increment,
      reason: 'Performance improving over recent sessions',
      confidence: 'medium',
      message: `Next time: Add ${increment} lbs → ${newWeight} lbs`,
    };
  }
  
  if (vl > targetVlMax + 10) {
    // Way over target - decrease weight
    const newWeight = context.weight - increment;
    
    return {
      action: 'decrease',
      weightChange: -increment,
      reason: `VL ${Math.round(vl)}% is too high - reduce weight`,
      confidence: 'high',
      message: `Next time: Drop to ${newWeight} lbs to rebuild`,
    };
  }
  
  // In range - maintain
  return {
    action: 'maintain',
    weightChange: 0,
    reason: `VL ${Math.round(vl)}% is in target range`,
    confidence: 'high',
    message: 'Next time: Same weight, keep building',
  };
}

// =============================================================================
// Deload Detection
// =============================================================================

/**
 * Check if a deload week is needed.
 */
export function checkDeloadNeeded(
  level: TrainingLevel,
  weeksSinceDeload: number,
  recentSessions: Array<{ avgVelocityLoss: number; hitMinimumReps: boolean }>
): DeloadTrigger | null {
  // Time-based check
  const weeksBetweenDeloads = level === 'intermediate' 
    ? WEEKS_BETWEEN_DELOADS_INTERMEDIATE 
    : WEEKS_BETWEEN_DELOADS_ADVANCED;
  
  if (weeksSinceDeload >= weeksBetweenDeloads) {
    return {
      triggerType: 'time',
      description: `It's been ${weeksSinceDeload} weeks since your last deload`,
      severity: 'moderate',
      detectedAt: Date.now(),
    };
  }
  
  // Performance-based check (need at least 3 sessions)
  if (recentSessions.length >= 3) {
    const recent = recentSessions.slice(-3);
    
    // Check velocity trend (increasing = getting harder)
    const vls = recent.map(s => s.avgVelocityLoss);
    const vlsIncreasing = vls.every((v, i) => i === 0 || v > vls[i - 1]);
    
    if (vlsIncreasing) {
      return {
        triggerType: 'performance',
        description: 'Performance declining over recent sessions',
        severity: 'moderate',
        detectedAt: Date.now(),
      };
    }
    
    // Check if consistently missing targets
    if (recent.every(s => !s.hitMinimumReps)) {
      return {
        triggerType: 'performance',
        description: 'Consistently missing rep targets',
        severity: 'severe',
        detectedAt: Date.now(),
      };
    }
  }
  
  return null;
}

/**
 * Create a deload week prescription.
 */
export function createDeloadPlan(trigger: DeloadTrigger): DeloadWeek {
  return {
    ...DEFAULT_DELOAD,
    trigger,
  };
}

// =============================================================================
// Trend Analysis
// =============================================================================

/**
 * Analyze exercise performance trend.
 */
export function getExerciseTrend(
  sessions: Array<{
    weight: number;
    totalReps: number;
    setsCompleted: number;
    avgVelocityLoss: number;
  }>,
  lookback: number = 5
): ExerciseTrend | null {
  if (sessions.length < 2) {
    return null;
  }
  
  const recent = sessions.slice(-lookback);
  
  // Calculate trends
  const weights = recent.map(s => s.weight);
  const repsPerSet = recent.map(s => s.totalReps / s.setsCompleted);
  const vls = recent.map(s => s.avgVelocityLoss);
  
  const weightTrend: 'increasing' | 'decreasing' | 'stable' = 
    weights[weights.length - 1] > weights[0] ? 'increasing' :
    weights[weights.length - 1] < weights[0] ? 'decreasing' : 'stable';
  
  const repChange = repsPerSet[0] > 0
    ? ((repsPerSet[repsPerSet.length - 1] - repsPerSet[0]) / repsPerSet[0]) * 100
    : 0;
  
  const vlChange = vls[vls.length - 1] - vls[0];
  
  return {
    sessionsAnalyzed: recent.length,
    weightTrend,
    weightChange: weights[weights.length - 1] - weights[0],
    repChangePercent: Math.round(repChange * 10) / 10,
    velocityLossChange: Math.round(vlChange * 10) / 10,
    improving: weightTrend === 'increasing' || (repChange > 5 && vlChange < 0),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function countConsecutiveFailures(context: ProgressionContext): number {
  // This would typically check the historical metrics
  // For now, return 0 as we'd need session history to track this
  return 0;
}

function makeDeloadDecision(
  context: ProgressionContext,
  triggerType: string
): ProgressionDecision {
  const increment = PROGRESSION_INCREMENTS[context.exerciseType];
  const newWeight = context.weight - increment;
  
  return {
    action: 'decrease',
    weightChange: -increment,
    reason: `Deload triggered: ${triggerType}`,
    confidence: 'high',
    message: `Next time: Drop to ${newWeight} lbs to rebuild`,
  };
}
