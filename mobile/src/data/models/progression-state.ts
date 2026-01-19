/**
 * Progression State Models
 * 
 * Stores progression engine state for workout-to-workout decisions.
 */

/**
 * Progression type used by the engine.
 */
export type ProgressionType = 'linear' | 'double' | 'autoregulated';

/**
 * Stored state for the progression engine.
 */
export interface StoredProgressionState {
  /** Exercise-specific progression data */
  exercises: Record<string, ExerciseProgressionState>;
  
  /** Global deload counter */
  globalDeloadCounter: number;
  
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Per-exercise progression state.
 */
export interface ExerciseProgressionState {
  /** Exercise identifier */
  exerciseId: string;
  
  /** Current working weight */
  currentWeight: number;
  
  /** Progression type for this exercise */
  progressionType: ProgressionType;
  
  /** Consecutive successful sessions */
  successStreak: number;
  
  /** Consecutive failed sessions */
  failStreak: number;
  
  /** Last workout performance metrics */
  lastPerformance?: {
    weight: number;
    reps: number;
    velocityLoss: number;
    estimatedRIR: number;
    date: number;
  };
  
  /** Weight history for trend analysis */
  weightHistory: Array<{
    weight: number;
    date: number;
    success: boolean;
  }>;
  
  /** Number of sessions since last deload */
  sessionsSinceDeload: number;
}

/**
 * Configuration for exercise progression.
 */
export interface ExerciseProgressionConfig {
  /** Minimum weight increment (lbs) */
  minIncrement: number;
  
  /** Maximum weight increment (lbs) */
  maxIncrement: number;
  
  /** Target velocity loss range */
  targetVelocityLoss: [number, number];
  
  /** Target RIR */
  targetRIR: number;
  
  /** Sessions before considering weight increase */
  sessionsForProgression: number;
  
  /** Auto-deload after this many failed sessions */
  autoDeloadThreshold: number;
}

/**
 * Default progression configuration.
 */
export const DEFAULT_PROGRESSION_CONFIG: ExerciseProgressionConfig = {
  minIncrement: 5,
  maxIncrement: 10,
  targetVelocityLoss: [15, 25],
  targetRIR: 2,
  sessionsForProgression: 2,
  autoDeloadThreshold: 3,
};
