/**
 * Voltra Workout Planning Models
 * 
 * Data models for workout plans, exercise prescriptions, and adaptive training.
 * All thresholds and defaults are research-backed.
 * 
 * Key concepts:
 * - ExercisePrescription: What to do for one exercise
 * - WorkoutPlan: A complete workout session
 * - WarmupScheme: How to warm up (also used for readiness detection)
 * - AdaptiveSessionState: Tracks adjustments during a workout
 */

// =============================================================================
// Enums
// =============================================================================

export enum TrainingGoal {
  STRENGTH = 'strength',       // Minimize fatigue, maximize force output
  HYPERTROPHY = 'hypertrophy', // Moderate fatigue, maximize volume
  ENDURANCE = 'endurance',     // High fatigue tolerance training
}

export enum TrainingLevel {
  NOVICE = 'novice',           // 0-6 months
  INTERMEDIATE = 'intermediate', // 6 months - 2 years
  ADVANCED = 'advanced',       // 2+ years
}

export enum ProgressionScheme {
  LINEAR = 'linear',           // Add weight every session (novices)
  DOUBLE = 'double',           // Add reps until top of range, then add weight
  AUTOREGULATED = 'autoregulated', // Progress based on velocity/readiness
}

export enum ReadinessZone {
  GREEN = 'green',   // >95% of baseline - proceed as planned or push harder
  YELLOW = 'yellow', // 85-95% of baseline - reduce weight/volume
  RED = 'red',       // <85% of baseline - major reduction or skip
}

export enum MuscleGroup {
  QUADS = 'quads',
  HAMSTRINGS = 'hamstrings',
  GLUTES = 'glutes',
  BACK = 'back',
  CHEST = 'chest',
  SHOULDERS = 'shoulders',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  CORE = 'core',
  CALVES = 'calves',
}

export type ExerciseType = 'compound' | 'isolation';

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
export const RIR_DEFAULTS: Record<ExerciseType, number> = {
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

/** Readiness thresholds (velocity as % of baseline) */
export const READINESS_THRESHOLDS = {
  excellent: 1.05,  // >105% = can push harder
  normal: 0.95,     // 95-105% = proceed as planned
  fatigued: 0.85,   // 85-95% = reduce load
  red: 0.85,        // <85% = major adjustment
};

/** Set-to-set expected performance drop (with adequate rest) */
export const EXPECTED_REP_DROP: Record<number, number> = {
  60: 0.35,   // 1 min rest: ~35% drop
  120: 0.20,  // 2 min rest: ~20% drop
  180: 0.15,  // 3 min rest: ~15% drop
};

/** Progression increments (lbs) */
export const PROGRESSION_INCREMENTS = {
  compound: 5,
  isolation: 5,  // Would be 2.5 if available, but Voltra uses 5 lb steps
};

// =============================================================================
// Data Models
// =============================================================================

/**
 * How to warm up for an exercise.
 * Also used for readiness detection.
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

/**
 * Settings for intra-workout adaptation.
 */
export interface AdaptiveSettings {
  /** Can readiness adjust weight? */
  allowWeightAdjustment: boolean;
  /** Can fatigue add/remove sets? */
  allowSetAdjustment: boolean;
  /** Upper limit even if feeling great */
  maxSets: number;
  /** Lower limit even if struggling */
  minSets: number;
}

export const DEFAULT_ADAPTIVE_SETTINGS: AdaptiveSettings = {
  allowWeightAdjustment: true,
  allowSetAdjustment: true,
  maxSets: 5,
  minSets: 2,
};

/**
 * What to do for one exercise in a workout.
 */
export interface ExercisePrescription {
  /** Unique identifier e.g., "cable_row" */
  exerciseId: string;
  /** Display name e.g., "Seated Cable Row" */
  exerciseName: string;
  
  /** Muscle group for volume tracking */
  muscleGroup: MuscleGroup;
  /** Type of exercise */
  exerciseType: ExerciseType;
  
  /** Target number of working sets */
  numSets: number;
  /** [min, max] rep range */
  repRange: [number, number];
  
  /** Fixed weight (adjusted by readiness) */
  weightLbs?: number;
  /** Stop with X reps left */
  rirTarget: number;
  /** Target velocity loss [min, max] */
  velocityLossTarget?: [number, number];
  
  /** Tempo string e.g., "2-0-1-0" (ecc-pause-con-pause) */
  tempo?: string;
  
  /** Base rest between sets (seconds) */
  restSeconds: number;
  
  /** Training goal (affects VL interpretation) */
  goal: TrainingGoal;
  
  /** How to progress over time */
  progressionScheme: ProgressionScheme;
  /** lbs to add when progressing */
  progressionIncrement: number;
  
  /** Warmup configuration */
  warmupScheme?: WarmupScheme;
  
  /** Adaptive settings */
  adaptive: AdaptiveSettings;
}

/**
 * Create an exercise prescription with research-backed defaults.
 */
export function createExercisePrescription(
  base: Partial<ExercisePrescription> & Pick<ExercisePrescription, 'exerciseId' | 'exerciseName'>
): ExercisePrescription {
  const exerciseType = base.exerciseType ?? 'compound';
  const goal = base.goal ?? TrainingGoal.HYPERTROPHY;
  
  return {
    exerciseId: base.exerciseId,
    exerciseName: base.exerciseName,
    muscleGroup: base.muscleGroup ?? MuscleGroup.BACK,
    exerciseType,
    numSets: base.numSets ?? 3,
    repRange: base.repRange ?? [8, 12],
    weightLbs: base.weightLbs,
    rirTarget: base.rirTarget ?? RIR_DEFAULTS[exerciseType],
    velocityLossTarget: base.velocityLossTarget ?? VELOCITY_LOSS_TARGETS[goal],
    tempo: base.tempo,
    restSeconds: base.restSeconds ?? REST_DEFAULTS[goal],
    goal,
    progressionScheme: base.progressionScheme ?? ProgressionScheme.DOUBLE,
    progressionIncrement: base.progressionIncrement ?? PROGRESSION_INCREMENTS[exerciseType],
    warmupScheme: base.warmupScheme ?? DEFAULT_WARMUP_SCHEME,
    adaptive: base.adaptive ?? DEFAULT_ADAPTIVE_SETTINGS,
  };
}

/**
 * A complete workout session.
 */
export interface WorkoutPlan {
  planId: string;
  name: string;
  exercises: ExercisePrescription[];
  
  /** Optional notes */
  notes?: string;
  /** Estimated duration in minutes */
  estimatedDurationMinutes?: number;
  
  /** User's training level (affects defaults) */
  trainingLevel: TrainingLevel;
}

/**
 * Record of an adjustment made between sets.
 */
export interface SetAdjustment {
  /** Which set this adjustment was made after */
  afterSet: number;
  /** Type of adjustment */
  adjustmentType: 'weight' | 'rest' | 'reps' | 'stop';
  /** Previous value */
  oldValue: number | [number, number] | null;
  /** New value */
  newValue: number | [number, number] | null;
  /** Why the adjustment was made */
  reason: string;
}

/**
 * Tracks adjustments made during a workout session for one exercise.
 */
export interface AdaptiveSessionState {
  exerciseId: string;
  
  // Pre-workout targets (from plan + history)
  plannedWeight: number;
  plannedRepRange: [number, number];
  plannedSets: number;
  
  // Readiness adjustment (from warmups)
  readinessZone: ReadinessZone;
  readinessScore: number; // 0.0 - 1.5 (1.0 = normal)
  adjustedWeight: number;
  adjustedRepRange?: [number, number];
  readinessNote: string;
  
  // Intra-workout state
  setsCompleted: number;
  setAdjustments: SetAdjustment[];
  
  // Performance tracking
  totalReps: number;
  totalVolume: number; // reps × weight
  avgVelocityLoss: number;
  avgRir: number;
  
  // Final decision (set after exercise completes)
  progressionRecommendation: string;
  nextSessionWeight?: number;
  nextSessionRepRange?: [number, number];
}

/**
 * Create initial session state from a prescription.
 */
export function createSessionState(
  prescription: ExercisePrescription
): AdaptiveSessionState {
  return {
    exerciseId: prescription.exerciseId,
    plannedWeight: prescription.weightLbs ?? 0,
    plannedRepRange: prescription.repRange,
    plannedSets: prescription.numSets,
    readinessZone: ReadinessZone.GREEN,
    readinessScore: 1.0,
    adjustedWeight: prescription.weightLbs ?? 0,
    readinessNote: '',
    setsCompleted: 0,
    setAdjustments: [],
    totalReps: 0,
    totalVolume: 0,
    avgVelocityLoss: 0,
    avgRir: 0,
    progressionRecommendation: '',
  };
}

/**
 * Detected reason for recommending a deload.
 */
export interface DeloadTrigger {
  triggerType: 'time' | 'performance' | 'readiness' | 'user_reported';
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
  detectedAt: number; // timestamp
}

/**
 * Deload week prescription.
 */
export interface DeloadWeek {
  /** 50% of normal sets */
  volumeReduction: number;
  /** 85% of normal weight */
  intensityReduction: number;
  /** Never go below RIR 4 */
  rirFloor: number;
  /** Duration in days */
  durationDays: number;
  /** "active" (light training) or "rest" (skip gym) */
  mode: 'active' | 'rest';
  /** What triggered this deload */
  trigger?: DeloadTrigger;
}

export const DEFAULT_DELOAD: DeloadWeek = {
  volumeReduction: 0.5,
  intensityReduction: 0.15,
  rirFloor: 4,
  durationDays: 7,
  mode: 'active',
};

/**
 * Track total sets per muscle group across the week.
 */
export interface WeeklyVolume {
  muscleGroup: MuscleGroup;
  totalSets: number;
  mev: number; // Minimum effective volume
  mav: number; // Maximum adaptive volume
  mrv: number; // Maximum recoverable volume
}

/**
 * Get volume status for a muscle group.
 */
export function getVolumeStatus(volume: WeeklyVolume): 'under' | 'optimal' | 'high' | 'excessive' {
  if (volume.totalSets < volume.mev) return 'under';
  if (volume.totalSets <= volume.mav) return 'optimal';
  if (volume.totalSets <= volume.mrv) return 'high';
  return 'excessive';
}

/**
 * Get volume landmarks for a muscle group based on training level.
 */
export function getVolumeLandmarks(
  level: TrainingLevel,
  muscleGroup: MuscleGroup
): { mev: number; mav: number; mrv: number } {
  const base = VOLUME_LANDMARKS[level];
  
  // Adjust for muscle size
  const largeMuscles = new Set([MuscleGroup.QUADS, MuscleGroup.BACK, MuscleGroup.GLUTES]);
  const smallMuscles = new Set([MuscleGroup.BICEPS, MuscleGroup.TRICEPS, MuscleGroup.CALVES]);
  
  let multiplier = 1.0;
  if (largeMuscles.has(muscleGroup)) {
    multiplier = 1.2;
  } else if (smallMuscles.has(muscleGroup)) {
    multiplier = 0.8;
  }
  
  return {
    mev: Math.round(base.mev * multiplier),
    mav: Math.round(base.mav * multiplier),
    mrv: Math.round(base.mrv * multiplier),
  };
}

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
