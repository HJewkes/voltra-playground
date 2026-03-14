/**
 * Auto-Regulation Engine
 *
 * Pure functions that analyze completed set data and produce
 * actionable UI signals for the exercise screen:
 *
 * - Load suggestions: recommended weight changes between sets
 * - Velocity warnings: alerts when velocity drops below threshold
 * - Junk volume detection: flags when sets are no longer productive
 * - Auto-stop signals: when to stop the set based on intra-set velocity drop
 */

import type { SessionMetrics } from '@/domain/workout/metrics/types';
import { computeSessionMetrics } from '@/domain/workout/metrics/session-metrics';
import type { ExerciseSession } from '@/domain/workout/models/session';
import { planExercise } from './planner';
import type { PlanResult, PlanAdjustment, TrainingGoal } from './types';
import { TrainingLevel, VELOCITY_LOSS_TARGETS } from './types';
import { checkJunkVolume } from './strategies/standard';

// =============================================================================
// Types
// =============================================================================

export type AutoRegulationSeverity = 'info' | 'warning' | 'critical';

export interface LoadSuggestion {
  currentWeight: number;
  suggestedWeight: number;
  direction: 'increase' | 'decrease' | 'maintain';
  reason: string;
  confidence: PlanAdjustment['confidence'];
}

export interface VelocityWarning {
  severity: AutoRegulationSeverity;
  message: string;
  velocityLossPercent: number;
  threshold: number;
}

export interface JunkVolumeAlert {
  isJunkVolume: boolean;
  repDropPercent: number;
  velocityRecoveryPercent: number;
  message: string;
}

export interface AutoStopSignal {
  shouldStop: boolean;
  reason: PlanResult['stopReason'];
  message: string;
}

export interface AutoRegulationState {
  loadSuggestion: LoadSuggestion | null;
  velocityWarning: VelocityWarning | null;
  junkVolumeAlert: JunkVolumeAlert | null;
  autoStopSignal: AutoStopSignal;
  planResult: PlanResult | null;
  restSeconds: number;
  message: string;
}

// =============================================================================
// Main Entry Point
// =============================================================================

export function computeAutoRegulation(
  session: ExerciseSession,
  goal: TrainingGoal,
  exerciseType: 'compound' | 'isolation',
  originalPlanSetCount: number
): AutoRegulationState {
  const completedSets = session.completedSets;

  if (completedSets.length === 0) {
    return createEmptyAutoRegulationState();
  }

  const metrics = computeSessionMetrics(session);
  const lastSet = completedSets[completedSets.length - 1];

  const planResult = planExercise({
    exerciseId: session.exercise.id,
    goal,
    level: TrainingLevel.INTERMEDIATE,
    exerciseType,
    sessionMetrics: metrics,
    historicalMetrics: null,
    completedSets,
    originalPlanSetCount,
    isDiscovery: false,
  });

  const loadSuggestion = extractLoadSuggestion(planResult, lastSet.weight);
  const velocityWarning = computeVelocityWarning(metrics, goal);
  const junkVolumeAlert = computeJunkVolumeAlert(metrics);
  const autoStopSignal = extractAutoStopSignal(planResult);

  return {
    loadSuggestion,
    velocityWarning,
    junkVolumeAlert,
    autoStopSignal,
    planResult,
    restSeconds: planResult.restSeconds,
    message: planResult.message,
  };
}

// =============================================================================
// Load Suggestion
// =============================================================================

export function extractLoadSuggestion(
  planResult: PlanResult,
  currentWeight: number
): LoadSuggestion | null {
  const weightAdjustment = planResult.adjustments.find((a) => a.type === 'weight');
  if (!weightAdjustment) return null;

  const suggestedWeight =
    typeof weightAdjustment.to === 'number' ? weightAdjustment.to : currentWeight;

  let direction: LoadSuggestion['direction'] = 'maintain';
  if (suggestedWeight > currentWeight) direction = 'increase';
  else if (suggestedWeight < currentWeight) direction = 'decrease';

  return {
    currentWeight,
    suggestedWeight,
    direction,
    reason: weightAdjustment.reason,
    confidence: weightAdjustment.confidence,
  };
}

// =============================================================================
// Velocity Warning
// =============================================================================

export function computeVelocityWarning(
  metrics: SessionMetrics,
  goal: TrainingGoal
): VelocityWarning | null {
  const [, targetMax] = VELOCITY_LOSS_TARGETS[goal];
  const velocityLossPercent = 100 - metrics.fatigue.velocityRecoveryPercent;

  if (velocityLossPercent <= targetMax) return null;

  let severity: AutoRegulationSeverity;
  let message: string;

  if (velocityLossPercent > targetMax + 20) {
    severity = 'critical';
    message = 'Velocity dropped significantly - consider stopping';
  } else if (velocityLossPercent > targetMax + 10) {
    severity = 'warning';
    message = 'Velocity dropping - fatigue accumulating';
  } else {
    severity = 'info';
    message = 'Velocity above target loss - watch next set';
  }

  return {
    severity,
    message,
    velocityLossPercent: Math.round(velocityLossPercent * 10) / 10,
    threshold: targetMax,
  };
}

// =============================================================================
// Junk Volume Alert
// =============================================================================

export function computeJunkVolumeAlert(metrics: SessionMetrics): JunkVolumeAlert | null {
  const isJunk = checkJunkVolume(metrics.fatigue);

  if (!isJunk && metrics.fatigue.repDropPercent < 30) return null;

  return {
    isJunkVolume: isJunk,
    repDropPercent: metrics.fatigue.repDropPercent,
    velocityRecoveryPercent: metrics.fatigue.velocityRecoveryPercent,
    message: isJunk
      ? 'Sets are no longer productive - additional volume is junk'
      : 'Performance declining - approaching junk volume threshold',
  };
}

// =============================================================================
// Auto-Stop Signal
// =============================================================================

export function extractAutoStopSignal(planResult: PlanResult): AutoStopSignal {
  return {
    shouldStop: planResult.shouldStop,
    reason: planResult.stopReason,
    message: planResult.shouldStop ? planResult.message : '',
  };
}

// =============================================================================
// Intra-Set Velocity Monitor
// =============================================================================

export function shouldAutoStopSet(
  velocities: number[],
  goal: TrainingGoal
): { shouldStop: boolean; reason: string } {
  if (velocities.length < 2) {
    return { shouldStop: false, reason: '' };
  }

  const firstRepVelocity = velocities[0];
  const currentVelocity = velocities[velocities.length - 1];

  if (firstRepVelocity <= 0) {
    return { shouldStop: false, reason: '' };
  }

  const velocityLossPercent = ((firstRepVelocity - currentVelocity) / firstRepVelocity) * 100;
  const [, targetMax] = VELOCITY_LOSS_TARGETS[goal];

  if (velocityLossPercent >= targetMax) {
    return {
      shouldStop: true,
      reason: `Velocity dropped ${Math.round(velocityLossPercent)}% (target max: ${targetMax}%)`,
    };
  }

  if (currentVelocity < 0.2) {
    return {
      shouldStop: true,
      reason: 'Velocity below minimum threshold (0.2 m/s)',
    };
  }

  return { shouldStop: false, reason: '' };
}

// =============================================================================
// Helpers
// =============================================================================

function createEmptyAutoRegulationState(): AutoRegulationState {
  return {
    loadSuggestion: null,
    velocityWarning: null,
    junkVolumeAlert: null,
    autoStopSignal: { shouldStop: false, reason: undefined, message: '' },
    planResult: null,
    restSeconds: 0,
    message: '',
  };
}
