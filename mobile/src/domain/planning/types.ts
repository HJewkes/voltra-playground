/**
 * Planning Domain Types
 * 
 * Core types for the unified planning system that handles:
 * - Initial plan generation
 * - Intra-workout adaptation
 * - Post-workout progression
 * - Weight discovery
 * 
 * The planning system uses a single planExercise() function that takes
 * PlanningContext and returns PlanResult, regardless of whether we're:
 * - Creating an initial plan (no completedSets)
 * - Adapting mid-workout (has completedSets)
 * - Discovering weight (no history, building profile)
 */

import type { SessionMetrics, ReadinessEstimate, FatigueEstimate, StrengthEstimate } from '@/domain/workout/metrics/types';
import type { Set } from '@/domain/workout/models/set';
import type { PlannedSet } from '@/domain/workout/models/plan';

// =============================================================================
// Enums
// =============================================================================

/**
 * User's training goal - affects velocity loss targets, rep ranges, and rest periods.
 */
export enum TrainingGoal {
  STRENGTH = 'strength',       // Minimize fatigue, maximize force output
  HYPERTROPHY = 'hypertrophy', // Moderate fatigue, maximize volume
  ENDURANCE = 'endurance',     // High fatigue tolerance training
}

/**
 * User's training experience level - affects volume limits and progression.
 */
export enum TrainingLevel {
  NOVICE = 'novice',           // 0-6 months
  INTERMEDIATE = 'intermediate', // 6 months - 2 years
  ADVANCED = 'advanced',       // 2+ years
}

/**
 * How to progress weight over time.
 */
export enum ProgressionScheme {
  LINEAR = 'linear',           // Add weight every session (novices)
  DOUBLE = 'double',           // Add reps until top of range, then add weight
  AUTOREGULATED = 'autoregulated', // Progress based on velocity/readiness
}

// =============================================================================
// Discovery Types
// =============================================================================

/**
 * Phase of weight discovery workflow.
 */
export type DiscoveryPhase = 'not_started' | 'exploring' | 'dialing_in' | 'complete';

/**
 * A single step in the weight discovery process.
 */
export interface DiscoveryStep {
  stepNumber: number;
  instruction: string;
  weight: number;
  targetReps: number;
  purpose: string;
  velocityExpectation?: string;
}

/**
 * Result from a completed discovery set.
 */
export interface DiscoverySetResult {
  weight: number;
  reps: number;
  meanVelocity: number;
  peakVelocity: number;
  rpe?: number;
  failed: boolean;
  notes?: string;
}

// =============================================================================
// Research-Backed Constants
// =============================================================================

/** Velocity loss targets by training goal [min, max] */
export const VELOCITY_LOSS_TARGETS: Record<TrainingGoal, [number, number]> = {
  [TrainingGoal.STRENGTH]: [5, 15],      // Stop early, stay fresh
  [TrainingGoal.HYPERTROPHY]: [20, 30],  // Moderate fatigue
  [TrainingGoal.ENDURANCE]: [35, 50],    // High fatigue
};

/** Default rest periods (seconds) by training goal */
export const REST_DEFAULTS: Record<TrainingGoal, number> = {
  [TrainingGoal.STRENGTH]: 180,     // 3 minutes
  [TrainingGoal.HYPERTROPHY]: 120,  // 2 minutes
  [TrainingGoal.ENDURANCE]: 75,     // 1:15
};

/** RIR targets by exercise type */
export const RIR_DEFAULTS: Record<'compound' | 'isolation', number> = {
  compound: 2,   // Squats, rows, presses - leave 2-3 in tank
  isolation: 1,  // Curls, extensions - can push closer
};

/** Volume landmarks (sets/week/muscle) by training level */
export const VOLUME_LANDMARKS: Record<TrainingLevel, { mev: number; mav: number; mrv: number }> = {
  [TrainingLevel.NOVICE]: { mev: 4, mav: 10, mrv: 14 },
  [TrainingLevel.INTERMEDIATE]: { mev: 8, mav: 16, mrv: 20 },
  [TrainingLevel.ADVANCED]: { mev: 10, mav: 20, mrv: 26 },
};

/** Per-session set limits by muscle size */
export const SESSION_SET_LIMITS = {
  large: 6,   // Quads, back
  medium: 5,  // Chest, shoulders
  small: 4,   // Biceps, triceps
};

/** Progression increments (lbs) */
export const PROGRESSION_INCREMENTS = {
  compound: 5,
  isolation: 5,  // Would be 2.5 if available, but Voltra uses 5 lb steps
};

// =============================================================================
// Planning Context (Input)
// =============================================================================

/**
 * Historical data for an exercise - computed from past sessions.
 */
export interface HistoricalMetrics {
  /** Recent average 1RM estimates */
  recentEstimated1RM: number | null;
  /** Trend direction: improving, stable, declining */
  trend: 'improving' | 'stable' | 'declining' | null;
  /** Last used working weight */
  lastWorkingWeight: number | null;
  /** Average reps achieved at last weight */
  avgRepsAtWeight: number | null;
  /** Number of sessions with this exercise */
  sessionCount: number;
  /** Days since last session */
  daysSinceLastSession: number | null;
  /** Velocity baseline data for readiness checking */
  velocityBaseline: Record<number, number> | null;
}

/**
 * Manual overrides from user input.
 */
export interface PlanningOverrides {
  /** User-specified weight to use */
  weight?: number;
  /** User-specified rep range */
  repRange?: [number, number];
  /** User-specified number of sets */
  numSets?: number;
  /** Skip warmups entirely */
  skipWarmups?: boolean;
  /** User-reported energy level (1-5) */
  reportedEnergy?: number;
}

/**
 * Complete input context for planning decisions.
 * 
 * The unified planner uses this same context for:
 * - Initial planning: completedSets is empty
 * - Mid-workout adaptation: completedSets has data
 * - Discovery: historicalMetrics is minimal/null
 */
export interface PlanningContext {
  /** Exercise being planned */
  exerciseId: string;
  
  /** User's training goal */
  goal: TrainingGoal;
  
  /** User's training level */
  level: TrainingLevel;
  
  /** Exercise type (affects RIR targets, increments) */
  exerciseType: 'compound' | 'isolation';
  
  /** Current session metrics (from completed sets so far) */
  sessionMetrics: SessionMetrics | null;
  
  /** Historical data from past sessions */
  historicalMetrics: HistoricalMetrics | null;
  
  /** Sets completed in current session */
  completedSets: Set[];
  
  /** Original plan set count (if adapting mid-workout) */
  originalPlanSetCount?: number;
  
  /** Manual overrides from user */
  overrides?: PlanningOverrides;
  
  /** Is this a discovery session (no established working weight)? */
  isDiscovery: boolean;
  
  /** Discovery-specific state */
  discoveryPhase?: DiscoveryPhase;
  discoveryHistory?: DiscoverySetResult[];
}

// =============================================================================
// Planning Result (Output)
// =============================================================================

/**
 * Reason for a planning adjustment.
 */
export interface PlanAdjustment {
  type: 'weight' | 'reps' | 'sets' | 'rest' | 'stop';
  reason: string;
  /** Confidence in this adjustment */
  confidence: 'high' | 'medium' | 'low';
  /** Original value */
  from?: number | [number, number];
  /** New value */
  to?: number | [number, number];
}

/**
 * Output from the planning system.
 */
export interface PlanResult {
  /** Next set to perform (null if workout should end) */
  nextSet: PlannedSet | null;
  
  /** Remaining sets after nextSet */
  remainingSets: PlannedSet[];
  
  /** Recommended rest before nextSet (seconds) */
  restSeconds: number;
  
  /** Adjustments made from original plan */
  adjustments: PlanAdjustment[];
  
  /** User-facing message explaining the recommendation */
  message: string;
  
  /** Updated metrics after this decision */
  updatedMetrics: {
    strength: StrengthEstimate;
    readiness: ReadinessEstimate;
    fatigue: FatigueEstimate;
    volumeAccumulated: number;
    effectiveVolume: number;
  };
  
  /** Should the workout end after current set? */
  shouldStop: boolean;
  
  /** If stopping, why? */
  stopReason?: 'target_reached' | 'fatigue_limit' | 'junk_volume' | 'velocity_grinding' | 'user_requested';
  
  /** For discovery: next step instead of planned set */
  discoveryStep?: DiscoveryStep;
}

// =============================================================================
// Warmup Types
// =============================================================================

/**
 * How to warm up for an exercise.
 */
export interface WarmupScheme {
  /** Warmup sets as [percent of working weight, reps] */
  warmupPercentages: [number, number][];
  /** Which set to use for readiness check (-1 = last warmup set) */
  readinessCheckSet: number;
  /** Rest between warmup sets (shorter than working sets) */
  warmupRestSeconds: number;
}

export const DEFAULT_WARMUP_SCHEME: WarmupScheme = {
  warmupPercentages: [[0.5, 10], [0.75, 5], [0.9, 3]],
  readinessCheckSet: -1,
  warmupRestSeconds: 60,
};

/**
 * Get warmup set weights and reps.
 */
export function getWarmupSets(
  workingWeight: number,
  scheme: WarmupScheme = DEFAULT_WARMUP_SCHEME
): Array<{ weight: number; reps: number }> {
  return scheme.warmupPercentages.map(([percent, reps]) => {
    // Round to nearest 5 lbs (Voltra increment)
    let weight = Math.round(workingWeight * percent / 5) * 5;
    weight = Math.max(5, weight); // Minimum 5 lbs
    return { weight, reps };
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the recommended progression scheme based on user level and goal.
 */
export function getDefaultProgressionScheme(
  level: TrainingLevel,
  goal: TrainingGoal
): ProgressionScheme {
  if (level === TrainingLevel.NOVICE) {
    return ProgressionScheme.LINEAR;
  } else if (level === TrainingLevel.INTERMEDIATE) {
    if (goal === TrainingGoal.STRENGTH) {
      return ProgressionScheme.AUTOREGULATED;
    }
    return ProgressionScheme.DOUBLE;
  }
  // Advanced: always autoregulated
  return ProgressionScheme.AUTOREGULATED;
}

/**
 * Create empty historical metrics for new exercises.
 */
export function createEmptyHistoricalMetrics(): HistoricalMetrics {
  return {
    recentEstimated1RM: null,
    trend: null,
    lastWorkingWeight: null,
    avgRepsAtWeight: null,
    sessionCount: 0,
    daysSinceLastSession: null,
    velocityBaseline: null,
  };
}

/**
 * Create a default planning context for initial planning.
 */
export function createPlanningContext(
  exerciseId: string,
  goal: TrainingGoal,
  level: TrainingLevel,
  exerciseType: 'compound' | 'isolation',
  options?: {
    historicalMetrics?: HistoricalMetrics;
    overrides?: PlanningOverrides;
    isDiscovery?: boolean;
  }
): PlanningContext {
  return {
    exerciseId,
    goal,
    level,
    exerciseType,
    sessionMetrics: null,
    historicalMetrics: options?.historicalMetrics ?? null,
    completedSets: [],
    overrides: options?.overrides,
    isDiscovery: options?.isDiscovery ?? false,
  };
}
