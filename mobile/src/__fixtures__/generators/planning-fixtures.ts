/**
 * Planning Fixtures
 *
 * Generators for planning domain objects: PlanningContext, HistoricalMetrics,
 * SessionMetrics, and Discovery-related types.
 *
 * These fixtures support testing the planning strategies (standard, discovery)
 * and the unified planner without needing to run through full sessions.
 */

import {
  type PlanningContext,
  type HistoricalMetrics,
  type PlanningOverrides,
  type DiscoverySetResult,
  type DiscoveryPhase,
  TrainingGoal,
  TrainingLevel,
  createEmptyHistoricalMetrics,
} from '@/domain/planning/types';
import {
  type SessionMetrics,
  type StrengthEstimate,
  type ReadinessEstimate,
  type FatigueEstimate,
} from '@/domain/workout/metrics/types';
import type { CompletedSet } from '@/domain/workout/models/completed-set';

// =============================================================================
// Planning Context Generators
// =============================================================================

/**
 * Options for generating a PlanningContext.
 */
export interface GeneratePlanningContextOptions {
  exerciseId?: string;
  goal?: TrainingGoal;
  level?: TrainingLevel;
  exerciseType?: 'compound' | 'isolation';
  sessionMetrics?: SessionMetrics | Partial<GenerateSessionMetricsOptions>;
  historicalMetrics?: HistoricalMetrics | Partial<GenerateHistoricalMetricsOptions>;
  completedSets?: CompletedSet[];
  originalPlanSetCount?: number;
  overrides?: PlanningOverrides;
  isDiscovery?: boolean;
  discoveryPhase?: DiscoveryPhase;
  discoveryHistory?: DiscoverySetResult[];
}

/**
 * Generate a PlanningContext for testing planning strategies.
 */
export function generatePlanningContext(
  options: GeneratePlanningContextOptions = {}
): PlanningContext {
  const {
    exerciseId = 'test_exercise',
    goal = TrainingGoal.HYPERTROPHY,
    level = TrainingLevel.INTERMEDIATE,
    exerciseType = 'compound',
    sessionMetrics = null,
    historicalMetrics = null,
    completedSets = [],
    originalPlanSetCount,
    overrides,
    isDiscovery = false,
    discoveryPhase,
    discoveryHistory,
  } = options;

  // Resolve sessionMetrics - can be a full object or options to generate
  let resolvedSessionMetrics: SessionMetrics | null = null;
  if (sessionMetrics !== null) {
    if ('strength' in sessionMetrics) {
      resolvedSessionMetrics = sessionMetrics as SessionMetrics;
    } else {
      resolvedSessionMetrics = generateSessionMetrics(
        sessionMetrics as Partial<GenerateSessionMetricsOptions>
      );
    }
  }

  // Resolve historicalMetrics - can be a full object or options to generate
  let resolvedHistoricalMetrics: HistoricalMetrics | null = null;
  if (historicalMetrics !== null) {
    if ('sessionCount' in historicalMetrics && 'recentEstimated1RM' in historicalMetrics) {
      resolvedHistoricalMetrics = historicalMetrics as HistoricalMetrics;
    } else {
      resolvedHistoricalMetrics = generateHistoricalMetrics(
        historicalMetrics as Partial<GenerateHistoricalMetricsOptions>
      );
    }
  }

  const context: PlanningContext = {
    exerciseId,
    goal,
    level,
    exerciseType,
    sessionMetrics: resolvedSessionMetrics,
    historicalMetrics: resolvedHistoricalMetrics,
    completedSets,
    isDiscovery,
  };

  if (originalPlanSetCount !== undefined) {
    context.originalPlanSetCount = originalPlanSetCount;
  }

  if (overrides) {
    context.overrides = overrides;
  }

  if (discoveryPhase) {
    context.discoveryPhase = discoveryPhase;
  }

  if (discoveryHistory) {
    context.discoveryHistory = discoveryHistory;
  }

  return context;
}

// =============================================================================
// Historical Metrics Generators
// =============================================================================

/**
 * Options for generating HistoricalMetrics.
 */
export interface GenerateHistoricalMetricsOptions {
  recentEstimated1RM?: number | null;
  trend?: 'improving' | 'stable' | 'declining' | null;
  lastWorkingWeight?: number | null;
  avgRepsAtWeight?: number | null;
  sessionCount?: number;
  daysSinceLastSession?: number | null;
  velocityBaseline?: Record<number, number> | null;
}

/**
 * Generate HistoricalMetrics for testing planning with history.
 */
export function generateHistoricalMetrics(
  options: GenerateHistoricalMetricsOptions = {}
): HistoricalMetrics {
  const {
    recentEstimated1RM = 150,
    trend = 'stable',
    lastWorkingWeight = 100,
    avgRepsAtWeight = 8,
    sessionCount = 5,
    daysSinceLastSession = 3,
    velocityBaseline = { 80: 0.65, 90: 0.55, 100: 0.45 },
  } = options;

  return {
    recentEstimated1RM,
    trend,
    lastWorkingWeight,
    avgRepsAtWeight,
    sessionCount,
    daysSinceLastSession,
    velocityBaseline,
  };
}

/**
 * Generate HistoricalMetrics for a new exercise (no history).
 */
export function generateNewExerciseMetrics(): HistoricalMetrics {
  return createEmptyHistoricalMetrics();
}

/**
 * Generate HistoricalMetrics for an experienced user.
 */
export function generateExperiencedMetrics(
  workingWeight: number = 100,
  estimated1RM: number = 150
): HistoricalMetrics {
  return generateHistoricalMetrics({
    recentEstimated1RM: estimated1RM,
    trend: 'stable',
    lastWorkingWeight: workingWeight,
    avgRepsAtWeight: 8,
    sessionCount: 20,
    daysSinceLastSession: 3,
    velocityBaseline: {
      [workingWeight * 0.8]: 0.65,
      [workingWeight * 0.9]: 0.55,
      [workingWeight]: 0.45,
    },
  });
}

/**
 * Generate HistoricalMetrics showing improvement trend.
 */
export function generateImprovingMetrics(workingWeight: number = 100): HistoricalMetrics {
  return generateHistoricalMetrics({
    recentEstimated1RM: workingWeight * 1.5,
    trend: 'improving',
    lastWorkingWeight: workingWeight - 5, // Previous session was lighter
    avgRepsAtWeight: 10, // Got more reps than target
    sessionCount: 8,
    daysSinceLastSession: 2,
  });
}

/**
 * Generate HistoricalMetrics showing declining performance.
 */
export function generateDecliningMetrics(workingWeight: number = 100): HistoricalMetrics {
  return generateHistoricalMetrics({
    recentEstimated1RM: workingWeight * 1.4,
    trend: 'declining',
    lastWorkingWeight: workingWeight + 5, // Previous session was heavier
    avgRepsAtWeight: 5, // Fewer reps than target
    sessionCount: 10,
    daysSinceLastSession: 7, // Long break
  });
}

// =============================================================================
// Session Metrics Generators
// =============================================================================

/**
 * Options for generating SessionMetrics.
 */
export interface GenerateSessionMetricsOptions {
  /** Fatigue level (0-1) */
  fatigueLevel?: number;
  /** Whether current performance indicates junk volume */
  isJunkVolume?: boolean;
  /** Velocity recovery percentage vs first set */
  velocityRecoveryPercent?: number;
  /** Rep drop percentage from first working set */
  repDropPercent?: number;
  /** Estimated 1RM */
  estimated1RM?: number;
  /** 1RM confidence (0-1) */
  strengthConfidence?: number;
  /** Readiness zone */
  readinessZone?: 'green' | 'yellow' | 'red';
  /** Volume accumulated */
  volumeAccumulated?: number;
  /** Effective volume */
  effectiveVolume?: number;
}

/**
 * Generate SessionMetrics for testing planning adaptation.
 */
export function generateSessionMetrics(
  options: GenerateSessionMetricsOptions = {}
): SessionMetrics {
  const {
    fatigueLevel = 0.3,
    isJunkVolume = false,
    velocityRecoveryPercent = 85,
    repDropPercent = 10,
    estimated1RM = 150,
    strengthConfidence = 0.8,
    readinessZone = 'green',
    volumeAccumulated = 2000,
    effectiveVolume = 1800,
  } = options;

  const strength: StrengthEstimate = {
    estimated1RM,
    confidence: strengthConfidence,
    source: 'session',
  };

  const readiness: ReadinessEstimate = {
    zone: readinessZone,
    velocityPercent: readinessZone === 'green' ? 100 : readinessZone === 'yellow' ? 92 : 82,
    confidence: 0.7,
    adjustments: {
      weight: readinessZone === 'green' ? 0 : readinessZone === 'yellow' ? -5 : -10,
      volume: readinessZone === 'green' ? 1.0 : readinessZone === 'yellow' ? 0.9 : 0.75,
    },
    message:
      readinessZone === 'green'
        ? 'Good to go'
        : readinessZone === 'yellow'
          ? 'Slightly fatigued'
          : 'Consider reducing load',
  };

  const fatigue: FatigueEstimate = {
    level: fatigueLevel,
    isJunkVolume,
    velocityRecoveryPercent,
    repDropPercent,
  };

  return {
    strength,
    readiness,
    fatigue,
    volumeAccumulated,
    effectiveVolume,
  };
}

/**
 * Generate SessionMetrics for a fresh session (early in workout).
 */
export function generateFreshSessionMetrics(): SessionMetrics {
  return generateSessionMetrics({
    fatigueLevel: 0.1,
    isJunkVolume: false,
    velocityRecoveryPercent: 98,
    repDropPercent: 0,
    estimated1RM: 150,
    strengthConfidence: 0.6,
    readinessZone: 'green',
    volumeAccumulated: 500,
    effectiveVolume: 500,
  });
}

/**
 * Generate SessionMetrics for a fatigued session (late in workout).
 */
export function generateFatiguedSessionMetrics(): SessionMetrics {
  return generateSessionMetrics({
    fatigueLevel: 0.7,
    isJunkVolume: false,
    velocityRecoveryPercent: 70,
    repDropPercent: 30,
    estimated1RM: 150,
    strengthConfidence: 0.85,
    readinessZone: 'yellow',
    volumeAccumulated: 3500,
    effectiveVolume: 3000,
  });
}

/**
 * Generate SessionMetrics indicating junk volume.
 */
export function generateJunkVolumeSessionMetrics(): SessionMetrics {
  return generateSessionMetrics({
    fatigueLevel: 0.9,
    isJunkVolume: true,
    velocityRecoveryPercent: 55,
    repDropPercent: 55,
    estimated1RM: 150,
    strengthConfidence: 0.9,
    readinessZone: 'red',
    volumeAccumulated: 4000,
    effectiveVolume: 2500,
  });
}

// =============================================================================
// Discovery Fixtures
// =============================================================================

/**
 * Options for generating DiscoverySetResult.
 */
export interface GenerateDiscoverySetResultOptions {
  weight?: number;
  reps?: number;
  meanVelocity?: number;
  peakVelocity?: number;
  rpe?: number;
  failed?: boolean;
  notes?: string;
}

/**
 * Generate a DiscoverySetResult for testing discovery flow.
 */
export function generateDiscoverySetResult(
  options: GenerateDiscoverySetResultOptions = {}
): DiscoverySetResult {
  const {
    weight = 80,
    reps = 5,
    meanVelocity = 0.55,
    peakVelocity = 0.75,
    rpe = 7,
    failed = false,
    notes,
  } = options;

  return {
    weight,
    reps,
    meanVelocity,
    peakVelocity,
    rpe,
    failed,
    notes,
  };
}

/**
 * Generate a sequence of discovery results showing progressive loading.
 */
export function generateDiscoverySequence(
  startWeight: number = 40,
  endWeight: number = 100,
  steps: number = 4
): DiscoverySetResult[] {
  const results: DiscoverySetResult[] = [];
  const weightStep = (endWeight - startWeight) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const weight = Math.round((startWeight + weightStep * i) / 5) * 5;
    // Velocity decreases as weight increases (linear approximation)
    const velocityRange = 0.9 - 0.3; // from 0.9 at light to 0.3 at heavy
    const progress = i / (steps - 1);
    const meanVelocity = 0.9 - velocityRange * progress;

    results.push(
      generateDiscoverySetResult({
        weight,
        reps: i < steps - 1 ? 5 : 3, // Fewer reps at heavy weight
        meanVelocity: Number(meanVelocity.toFixed(2)),
        peakVelocity: Number((meanVelocity + 0.15).toFixed(2)),
        rpe: 5 + i, // RPE increases with weight
        failed: false,
      })
    );
  }

  return results;
}

/**
 * Generate discovery results that end in failure.
 */
export function generateFailedDiscoverySequence(maxWeight: number = 110): DiscoverySetResult[] {
  const results = generateDiscoverySequence(40, maxWeight - 20, 4);

  // Add a failed attempt at max weight
  results.push(
    generateDiscoverySetResult({
      weight: maxWeight,
      reps: 1,
      meanVelocity: 0.2,
      peakVelocity: 0.3,
      rpe: 10,
      failed: true,
      notes: 'Failed on second rep',
    })
  );

  return results;
}

// =============================================================================
// Load Velocity Profile Fixtures
// =============================================================================

/**
 * Load-velocity profile data point.
 */
export interface LoadVelocityDataPoint {
  weight: number;
  velocity: number;
}

/**
 * Load-velocity profile for VBT calculations.
 */
export interface LoadVelocityProfile {
  dataPoints: LoadVelocityDataPoint[];
  slope: number;
  intercept: number;
  rSquared: number;
  estimated1RM: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Options for generating LoadVelocityProfile.
 */
export interface GenerateLoadVelocityProfileOptions {
  estimated1RM?: number;
  dataPointCount?: number;
  confidence?: 'high' | 'medium' | 'low';
  minWeight?: number;
  maxWeight?: number;
}

/**
 * Generate a LoadVelocityProfile for testing VBT functions.
 */
export function generateLoadVelocityProfile(
  options: GenerateLoadVelocityProfileOptions = {}
): LoadVelocityProfile {
  const {
    estimated1RM = 150,
    dataPointCount = 4,
    confidence = 'high',
    minWeight = estimated1RM * 0.5,
    maxWeight = estimated1RM * 0.9,
  } = options;

  // Generate data points along a linear load-velocity curve
  // Typical slope is around -0.01 to -0.02 (velocity drops ~0.01 m/s per lb)
  const dataPoints: LoadVelocityDataPoint[] = [];
  const weightStep = (maxWeight - minWeight) / (dataPointCount - 1);

  for (let i = 0; i < dataPointCount; i++) {
    const weight = Math.round((minWeight + weightStep * i) / 5) * 5;
    // Linear relationship: velocity = intercept + slope * weight
    // At 50% 1RM (~75 lbs), velocity ~0.9 m/s
    // At 90% 1RM (~135 lbs), velocity ~0.3 m/s
    // slope = (0.3 - 0.9) / (135 - 75) = -0.01
    const slope = -0.01;
    const intercept = 0.9 + 0.01 * minWeight;
    const velocity = intercept + slope * weight;

    dataPoints.push({
      weight,
      velocity: Math.max(0.15, Number(velocity.toFixed(2))),
    });
  }

  // Calculate regression (simplified - actual would use least squares)
  const slope = -0.01;
  const intercept = 0.9 + 0.01 * minWeight;

  // R-squared based on confidence
  const rSquared = confidence === 'high' ? 0.95 : confidence === 'medium' ? 0.8 : 0.6;

  return {
    dataPoints,
    slope,
    intercept,
    rSquared,
    estimated1RM,
    confidence,
  };
}

/**
 * Generate a profile with poor data quality (low confidence).
 */
export function generateLowConfidenceProfile(estimated1RM: number = 150): LoadVelocityProfile {
  return generateLoadVelocityProfile({
    estimated1RM,
    dataPointCount: 2,
    confidence: 'low',
    minWeight: estimated1RM * 0.6,
    maxWeight: estimated1RM * 0.7,
  });
}

/**
 * Generate a profile with good spread and high confidence.
 */
export function generateHighConfidenceProfile(estimated1RM: number = 150): LoadVelocityProfile {
  return generateLoadVelocityProfile({
    estimated1RM,
    dataPointCount: 6,
    confidence: 'high',
    minWeight: estimated1RM * 0.4,
    maxWeight: estimated1RM * 0.95,
  });
}
