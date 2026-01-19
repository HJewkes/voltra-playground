/**
 * Voltra Workout Plan Loader
 * 
 * Load workout plans from JSON with validation and smart defaults.
 * All defaults are research-backed.
 */

import {
  AdaptiveSettings,
  ExercisePrescription,
  MuscleGroup,
  ProgressionScheme,
  TrainingGoal,
  TrainingLevel,
  WarmupScheme,
  WorkoutPlan,
  ExerciseType,
  DEFAULT_WARMUP_SCHEME,
  DEFAULT_ADAPTIVE_SETTINGS,
  REST_DEFAULTS,
  RIR_DEFAULTS,
  VELOCITY_LOSS_TARGETS,
  getDefaultProgressionScheme,
} from './models';

// =============================================================================
// Exercise Mappings
// =============================================================================

/**
 * Muscle group mapping for common Voltra exercises.
 */
export const EXERCISE_MUSCLE_GROUPS: Record<string, MuscleGroup> = {
  // Back
  cable_row: MuscleGroup.BACK,
  seated_cable_row: MuscleGroup.BACK,
  lat_pulldown: MuscleGroup.BACK,
  cable_pulldown: MuscleGroup.BACK,
  
  // Chest
  cable_chest_press: MuscleGroup.CHEST,
  cable_fly: MuscleGroup.CHEST,
  cable_crossover: MuscleGroup.CHEST,
  
  // Biceps
  cable_curl: MuscleGroup.BICEPS,
  cable_hammer_curl: MuscleGroup.BICEPS,
  
  // Triceps
  cable_tricep_pushdown: MuscleGroup.TRICEPS,
  cable_tricep_extension: MuscleGroup.TRICEPS,
  
  // Shoulders
  cable_shoulder_press: MuscleGroup.SHOULDERS,
  cable_lateral_raise: MuscleGroup.SHOULDERS,
  cable_face_pull: MuscleGroup.SHOULDERS,
  
  // Legs
  cable_squat: MuscleGroup.QUADS,
  cable_lunge: MuscleGroup.QUADS,
  cable_leg_curl: MuscleGroup.HAMSTRINGS,
  cable_deadlift: MuscleGroup.HAMSTRINGS,
  cable_hip_thrust: MuscleGroup.GLUTES,
  cable_kickback: MuscleGroup.GLUTES,
  
  // Core
  cable_crunch: MuscleGroup.CORE,
  cable_woodchop: MuscleGroup.CORE,
};

/**
 * Exercise type mapping (compound vs isolation).
 */
export const EXERCISE_TYPES: Record<string, ExerciseType> = {
  // Compound exercises
  cable_row: 'compound',
  seated_cable_row: 'compound',
  lat_pulldown: 'compound',
  cable_pulldown: 'compound',
  cable_chest_press: 'compound',
  cable_shoulder_press: 'compound',
  cable_squat: 'compound',
  cable_lunge: 'compound',
  cable_deadlift: 'compound',
  cable_hip_thrust: 'compound',
  
  // Isolation exercises
  cable_fly: 'isolation',
  cable_crossover: 'isolation',
  cable_curl: 'isolation',
  cable_hammer_curl: 'isolation',
  cable_tricep_pushdown: 'isolation',
  cable_tricep_extension: 'isolation',
  cable_lateral_raise: 'isolation',
  cable_face_pull: 'isolation',
  cable_leg_curl: 'isolation',
  cable_kickback: 'isolation',
  cable_crunch: 'isolation',
  cable_woodchop: 'isolation',
};

// =============================================================================
// Validation
// =============================================================================

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a workout plan.
 */
export function validatePlan(plan: WorkoutPlan): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!plan.exercises || plan.exercises.length === 0) {
    errors.push('Plan must have at least one exercise');
  }
  
  for (let i = 0; i < plan.exercises.length; i++) {
    const ex = plan.exercises[i];
    const prefix = `Exercise ${i + 1} (${ex.exerciseId})`;
    
    // Validate rep range
    if (ex.repRange[0] > ex.repRange[1]) {
      errors.push(`${prefix}: min reps (${ex.repRange[0]}) > max reps (${ex.repRange[1]})`);
    }
    
    if (ex.repRange[0] < 1) {
      errors.push(`${prefix}: min reps must be at least 1`);
    }
    
    if (ex.repRange[1] > 30) {
      warnings.push(`${prefix}: max reps (${ex.repRange[1]}) seems high`);
    }
    
    // Validate sets
    if (ex.numSets < 1) {
      errors.push(`${prefix}: must have at least 1 set`);
    }
    
    if (ex.numSets > 10) {
      warnings.push(`${prefix}: ${ex.numSets} sets seems excessive`);
    }
    
    // Validate weight
    if (ex.weightLbs !== undefined) {
      if (ex.weightLbs < 5) {
        errors.push(`${prefix}: weight must be at least 5 lbs`);
      }
      if (ex.weightLbs > 200) {
        errors.push(`${prefix}: weight (${ex.weightLbs}) exceeds Voltra max (200 lbs)`);
      }
      if (ex.weightLbs % 5 !== 0) {
        warnings.push(`${prefix}: weight should be multiple of 5 lbs`);
      }
    }
    
    // Validate RIR
    if (ex.rirTarget < 0 || ex.rirTarget > 5) {
      warnings.push(`${prefix}: RIR target (${ex.rirTarget}) should be 0-5`);
    }
    
    // Validate velocity loss target
    if (ex.velocityLossTarget) {
      const [minVl, maxVl] = ex.velocityLossTarget;
      if (minVl > maxVl) {
        errors.push(`${prefix}: min VL (${minVl}) > max VL (${maxVl})`);
      }
      if (maxVl > 60) {
        warnings.push(`${prefix}: max VL (${maxVl}%) seems too high`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Parsing Helpers
// =============================================================================

function parseGoal(goalStr: string): TrainingGoal {
  const goalMap: Record<string, TrainingGoal> = {
    strength: TrainingGoal.STRENGTH,
    hypertrophy: TrainingGoal.HYPERTROPHY,
    endurance: TrainingGoal.ENDURANCE,
  };
  return goalMap[goalStr.toLowerCase()] ?? TrainingGoal.HYPERTROPHY;
}

function parseProgression(progStr: string): ProgressionScheme {
  const progMap: Record<string, ProgressionScheme> = {
    linear: ProgressionScheme.LINEAR,
    double: ProgressionScheme.DOUBLE,
    autoregulated: ProgressionScheme.AUTOREGULATED,
    auto: ProgressionScheme.AUTOREGULATED,
  };
  return progMap[progStr.toLowerCase()] ?? ProgressionScheme.DOUBLE;
}

function parseLevel(levelStr: string): TrainingLevel {
  const levelMap: Record<string, TrainingLevel> = {
    novice: TrainingLevel.NOVICE,
    beginner: TrainingLevel.NOVICE,
    intermediate: TrainingLevel.INTERMEDIATE,
    advanced: TrainingLevel.ADVANCED,
  };
  return levelMap[levelStr.toLowerCase()] ?? TrainingLevel.INTERMEDIATE;
}

function parseMuscleGroup(groupStr: string): MuscleGroup {
  const groupMap: Record<string, MuscleGroup> = {
    quads: MuscleGroup.QUADS,
    quadriceps: MuscleGroup.QUADS,
    legs: MuscleGroup.QUADS,
    hamstrings: MuscleGroup.HAMSTRINGS,
    hams: MuscleGroup.HAMSTRINGS,
    glutes: MuscleGroup.GLUTES,
    back: MuscleGroup.BACK,
    lats: MuscleGroup.BACK,
    chest: MuscleGroup.CHEST,
    pecs: MuscleGroup.CHEST,
    shoulders: MuscleGroup.SHOULDERS,
    delts: MuscleGroup.SHOULDERS,
    biceps: MuscleGroup.BICEPS,
    bis: MuscleGroup.BICEPS,
    triceps: MuscleGroup.TRICEPS,
    tris: MuscleGroup.TRICEPS,
    core: MuscleGroup.CORE,
    abs: MuscleGroup.CORE,
    calves: MuscleGroup.CALVES,
  };
  return groupMap[groupStr.toLowerCase()] ?? MuscleGroup.BACK;
}

function parseWarmup(warmupData: Record<string, unknown> | undefined): WarmupScheme | undefined {
  if (!warmupData) return undefined;
  
  let percentages = warmupData.percentages as [number, number][] | undefined;
  if (!percentages) {
    percentages = DEFAULT_WARMUP_SCHEME.warmupPercentages;
  }
  
  return {
    warmupPercentages: percentages,
    readinessCheckSet: (warmupData.readiness_check_set as number) ?? -1,
    warmupRestSeconds: (warmupData.rest_seconds as number) ?? 60,
  };
}

function parseAdaptive(adaptiveData: Record<string, unknown> | undefined): AdaptiveSettings {
  if (!adaptiveData) return DEFAULT_ADAPTIVE_SETTINGS;
  
  return {
    allowWeightAdjustment: (adaptiveData.adjust_weight as boolean) ?? true,
    allowSetAdjustment: (adaptiveData.adjust_sets as boolean) ?? true,
    maxSets: (adaptiveData.max_sets as number) ?? 5,
    minSets: (adaptiveData.min_sets as number) ?? 2,
  };
}

// =============================================================================
// Exercise Parsing
// =============================================================================

interface ExerciseData {
  exercise_id?: string;
  id?: string;
  name?: string;
  exercise_name?: string;
  muscle_group?: string;
  exercise_type?: string;
  sets?: number;
  num_sets?: number;
  reps?: number | [number, number];
  rep_range?: [number, number];
  weight_lbs?: number;
  weight?: number;
  rir_target?: number;
  rir?: number;
  velocity_loss_target?: [number, number];
  tempo?: string;
  rest_seconds?: number;
  rest?: number;
  goal?: string;
  progression?: string;
  progression_scheme?: string;
  increment_lbs?: number;
  progression_increment?: number;
  warmup?: Record<string, unknown>;
  adaptive?: Record<string, unknown>;
}

function parseExercise(data: ExerciseData, trainingLevel: TrainingLevel): ExercisePrescription {
  const exerciseId = data.exercise_id ?? data.id ?? 'unknown';
  const exerciseName = data.name ?? data.exercise_name ?? exerciseId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  // Parse training goal
  const goal = parseGoal(data.goal ?? 'hypertrophy');
  
  // Determine muscle group and exercise type
  const muscleGroup = data.muscle_group 
    ? parseMuscleGroup(data.muscle_group)
    : EXERCISE_MUSCLE_GROUPS[exerciseId] ?? MuscleGroup.BACK;
  
  const exerciseType: ExerciseType = (data.exercise_type as ExerciseType) ?? EXERCISE_TYPES[exerciseId] ?? 'compound';
  
  // Parse rep range
  let repRange: [number, number];
  const reps = data.reps ?? data.rep_range ?? [8, 12];
  if (Array.isArray(reps)) {
    repRange = [reps[0], reps[1]];
  } else {
    repRange = [reps, reps]; // Single number = fixed reps
  }
  
  // Parse progression scheme
  const progression = data.progression ?? data.progression_scheme;
  const progressionScheme = progression 
    ? parseProgression(progression)
    : getDefaultProgressionScheme(trainingLevel, goal);
  
  // Get research-backed defaults
  const defaultRest = REST_DEFAULTS[goal];
  const defaultRir = RIR_DEFAULTS[exerciseType];
  
  // Parse velocity loss target
  let velocityLossTarget: [number, number] | undefined;
  if (data.velocity_loss_target) {
    velocityLossTarget = data.velocity_loss_target;
  } else {
    velocityLossTarget = VELOCITY_LOSS_TARGETS[goal];
  }
  
  return {
    exerciseId,
    exerciseName,
    muscleGroup,
    exerciseType,
    numSets: data.sets ?? data.num_sets ?? 3,
    repRange,
    weightLbs: data.weight_lbs ?? data.weight,
    rirTarget: data.rir_target ?? data.rir ?? defaultRir,
    velocityLossTarget,
    tempo: data.tempo,
    restSeconds: data.rest_seconds ?? data.rest ?? defaultRest,
    goal,
    progressionScheme,
    progressionIncrement: data.increment_lbs ?? data.progression_increment ?? 5,
    warmupScheme: parseWarmup(data.warmup),
    adaptive: parseAdaptive(data.adaptive),
  };
}

// =============================================================================
// Plan Loading
// =============================================================================

interface PlanData {
  plan_id?: string;
  id?: string;
  name?: string;
  notes?: string;
  estimated_duration?: number;
  duration?: number;
  training_level?: string;
  exercises?: ExerciseData[];
}

/**
 * Load a workout plan from a dictionary/object.
 */
export function loadPlanFromObject(data: PlanData, validate: boolean = true): WorkoutPlan {
  // Parse training level first (affects defaults)
  const trainingLevel = parseLevel(data.training_level ?? 'intermediate');
  
  // Parse exercises
  const exercisesData = data.exercises ?? [];
  if (exercisesData.length === 0 && validate) {
    throw new PlanValidationError('Workout plan must have at least one exercise');
  }
  
  const exercises = exercisesData.map(ex => parseExercise(ex, trainingLevel));
  
  // Create plan
  const plan: WorkoutPlan = {
    planId: data.plan_id ?? data.id ?? 'default',
    name: data.name ?? 'Workout',
    exercises,
    notes: data.notes,
    estimatedDurationMinutes: data.estimated_duration ?? data.duration ?? 45,
    trainingLevel,
  };
  
  if (validate) {
    const result = validatePlan(plan);
    if (!result.valid) {
      throw new PlanValidationError(result.errors.join('\n'));
    }
  }
  
  return plan;
}

/**
 * Load a workout plan from a JSON string.
 */
export function loadPlanFromJSON(jsonString: string, validate: boolean = true): WorkoutPlan {
  const data = JSON.parse(jsonString) as PlanData;
  return loadPlanFromObject(data, validate);
}

// =============================================================================
// Plan Serialization
// =============================================================================

/**
 * Convert a workout plan to a serializable object.
 */
export function planToObject(plan: WorkoutPlan): PlanData {
  return {
    plan_id: plan.planId,
    name: plan.name,
    notes: plan.notes,
    estimated_duration: plan.estimatedDurationMinutes,
    training_level: plan.trainingLevel,
    exercises: plan.exercises.map(exerciseToObject),
  };
}

function exerciseToObject(ex: ExercisePrescription): ExerciseData {
  const data: ExerciseData = {
    exercise_id: ex.exerciseId,
    name: ex.exerciseName,
    muscle_group: ex.muscleGroup,
    exercise_type: ex.exerciseType,
    sets: ex.numSets,
    reps: ex.repRange,
    rir_target: ex.rirTarget,
    rest_seconds: ex.restSeconds,
    goal: ex.goal,
    progression: ex.progressionScheme,
    increment_lbs: ex.progressionIncrement,
  };
  
  // Optional fields
  if (ex.weightLbs !== undefined) {
    data.weight_lbs = ex.weightLbs;
  }
  
  if (ex.tempo) {
    data.tempo = ex.tempo;
  }
  
  if (ex.velocityLossTarget) {
    data.velocity_loss_target = ex.velocityLossTarget;
  }
  
  // Warmup
  if (ex.warmupScheme) {
    data.warmup = {
      percentages: ex.warmupScheme.warmupPercentages,
      rest_seconds: ex.warmupScheme.warmupRestSeconds,
    };
  }
  
  // Adaptive settings (only if non-default)
  const adaptive = ex.adaptive;
  if (!adaptive.allowWeightAdjustment || !adaptive.allowSetAdjustment ||
      adaptive.maxSets !== 5 || adaptive.minSets !== 2) {
    data.adaptive = {
      adjust_weight: adaptive.allowWeightAdjustment,
      adjust_sets: adaptive.allowSetAdjustment,
      max_sets: adaptive.maxSets,
      min_sets: adaptive.minSets,
    };
  }
  
  return data;
}

/**
 * Convert a workout plan to a JSON string.
 */
export function planToJSON(plan: WorkoutPlan, pretty: boolean = true): string {
  const obj = planToObject(plan);
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a workout plan with minimal configuration.
 * Smart defaults are applied for everything not specified.
 */
export function createMinimalPlan(
  name: string,
  exercises: Array<{ exercise_id: string; weight_lbs?: number; [key: string]: unknown }>,
  trainingLevel: string = 'intermediate'
): WorkoutPlan {
  return loadPlanFromObject({
    name,
    training_level: trainingLevel,
    exercises: exercises as ExerciseData[],
  });
}

/**
 * Get suggested exercise name from ID.
 */
export function getExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get all known exercise IDs.
 */
export function getKnownExercises(): string[] {
  return Object.keys(EXERCISE_MUSCLE_GROUPS);
}

/**
 * Get exercises by muscle group.
 */
export function getExercisesByMuscleGroup(muscleGroup: MuscleGroup): string[] {
  return Object.entries(EXERCISE_MUSCLE_GROUPS)
    .filter(([_, group]) => group === muscleGroup)
    .map(([id]) => id);
}
