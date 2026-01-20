/**
 * Session Metrics Types
 *
 * Types for metrics derived from exercise session data.
 * These metrics are inputs to the planning domain.
 *
 * Design principle: Estimates have uncertainty (confidence), calculations don't.
 */

// =============================================================================
// Estimates (inferred with uncertainty)
// =============================================================================

/**
 * Estimated 1RM and confidence.
 * Common currency for discovery and training.
 */
export interface StrengthEstimate {
  /** Estimated one-rep max in lbs */
  estimated1RM: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Where this estimate came from */
  source: 'discovery' | 'historical' | 'session';
}

/**
 * Readiness estimate based on warmup performance vs baseline.
 */
export interface ReadinessEstimate {
  /** Readiness zone classification */
  zone: 'green' | 'yellow' | 'red';
  /** Velocity as percentage of baseline (100 = normal) */
  velocityPercent: number;
  /** Confidence in this estimate (0-1) */
  confidence: number;
  /** Recommended adjustments based on readiness */
  adjustments: ReadinessAdjustments;
  /** User-facing message */
  message: string;
}

/**
 * Recommended adjustments based on readiness.
 */
export interface ReadinessAdjustments {
  /** Weight adjustment in lbs (positive = increase, negative = decrease) */
  weight: number;
  /** Volume multiplier (1.0 = no change, 0.75 = reduce 25%) */
  volume: number;
}

/**
 * Fatigue estimate based on performance decay across sets.
 */
export interface FatigueEstimate {
  /** Overall fatigue level (0-1, higher = more fatigued) */
  level: number;
  /** Whether current performance indicates junk volume */
  isJunkVolume: boolean;
  /** Velocity recovery percentage vs first set */
  velocityRecoveryPercent: number;
  /** Rep drop percentage from first working set */
  repDropPercent: number;
}

// =============================================================================
// Session Metrics (combines estimates + calculations)
// =============================================================================

/**
 * Complete metrics for an exercise session.
 *
 * Estimates have uncertainty and are derived with inference.
 * Volume is directly calculated from data.
 */
export interface SessionMetrics {
  // Estimates (derived with uncertainty)
  strength: StrengthEstimate;
  readiness: ReadinessEstimate;
  fatigue: FatigueEstimate;

  // Calculated directly from data (no uncertainty)
  volumeAccumulated: number;
  effectiveVolume: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Readiness thresholds (velocity as fraction of baseline).
 */
export const READINESS_THRESHOLDS = {
  excellent: 1.05, // >105% = feeling great
  normal: 0.95, // 95-105% = normal range
  fatigued: 0.85, // 85-95% = fatigued
  red: 0.85, // <85% = major adjustment needed
} as const;

/**
 * Expected rep drop by rest period (seconds).
 * Research-backed values.
 */
export const EXPECTED_REP_DROP: Record<number, number> = {
  60: 0.35, // 1 min rest: ~35% drop
  120: 0.2, // 2 min rest: ~20% drop
  180: 0.15, // 3 min rest: ~15% drop
};

/**
 * Junk volume threshold (rep drop percentage).
 */
export const JUNK_VOLUME_THRESHOLD = 0.5; // 50% rep drop

/**
 * Velocity grinding threshold (m/s).
 */
export const VELOCITY_GRINDING_THRESHOLD = 0.3;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an empty/default strength estimate.
 */
export function createEmptyStrengthEstimate(): StrengthEstimate {
  return {
    estimated1RM: 0,
    confidence: 0,
    source: 'session',
  };
}

/**
 * Create a default readiness estimate (normal readiness).
 */
export function createDefaultReadinessEstimate(): ReadinessEstimate {
  return {
    zone: 'green',
    velocityPercent: 100,
    confidence: 0,
    adjustments: { weight: 0, volume: 1.0 },
    message: 'No baseline data - proceeding as planned',
  };
}

/**
 * Create an empty fatigue estimate.
 */
export function createEmptyFatigueEstimate(): FatigueEstimate {
  return {
    level: 0,
    isJunkVolume: false,
    velocityRecoveryPercent: 100,
    repDropPercent: 0,
  };
}

/**
 * Create empty session metrics.
 */
export function createEmptySessionMetrics(): SessionMetrics {
  return {
    strength: createEmptyStrengthEstimate(),
    readiness: createDefaultReadinessEstimate(),
    fatigue: createEmptyFatigueEstimate(),
    volumeAccumulated: 0,
    effectiveVolume: 0,
  };
}
