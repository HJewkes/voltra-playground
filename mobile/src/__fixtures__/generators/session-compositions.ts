/**
 * Session Composition System
 *
 * Composes sets into full exercise sessions. A SessionComposition is an array
 * of (weight%, SetComposition) pairs that model a complete workout with warmups
 * and working sets.
 *
 * Example: standardWorkout = [
 *   { weightPercent: 50, composition: 'warmupEasy' },
 *   { weightPercent: 75, composition: 'warmupEasy' },
 *   { weightPercent: 85, composition: 'productiveWorking' },
 *   { weightPercent: 85, composition: 'productiveWorking' },
 *   { weightPercent: 85, composition: 'toFailure' },
 * ]
 */

import { v4 as uuid } from 'uuid';
import {
  type ExerciseSession,
  type ExercisePlan,
  type PlannedSet,
  type CompletedSet,
} from '@/domain/workout';
import { type Exercise, createExercise, MuscleGroup } from '@/domain/exercise';
import { TrainingGoal } from '@/domain/planning';
import { type SetComposition, setPresets, generateSetFromBehaviors } from './set-compositions';

// =============================================================================
// Types
// =============================================================================

/**
 * Specification for a single set in a session composition.
 */
export interface SessionSetSpec {
  /** Weight as percentage of working weight or estimated 1RM */
  weightPercent: number;
  /** Set composition - either a preset name or custom RepBehavior[] */
  composition: SetComposition | keyof typeof setPresets;
}

/**
 * A session composition is an array of set specifications.
 */
export type SessionComposition = SessionSetSpec[];

/**
 * Options for generating a session from a composition.
 */
export interface GenerateSessionOptions {
  /** Base working weight in lbs */
  workingWeight: number;
  /** Exercise ID */
  exerciseId?: string;
  /** Exercise name */
  exerciseName?: string;
  /** Training goal */
  goal?: TrainingGoal;
  /** Whether this is a discovery session */
  isDiscovery?: boolean;
  /** Starting timestamp */
  startTime?: number;
  /** Rest between sets in seconds */
  restBetweenSets?: number;
}

/**
 * Result of generating a session from a composition.
 */
export interface SessionFromCompositionResult {
  /** The generated exercise session */
  session: ExerciseSession;
  /** The plan that was created */
  plan: ExercisePlan;
  /** All completed sets */
  completedSets: CompletedSet[];
  /** Total reps completed across all sets */
  totalReps: number;
  /** Total volume (weight × reps) */
  totalVolume: number;
}

// =============================================================================
// Session Presets
// =============================================================================

/**
 * Named presets for common session compositions.
 */
export const sessionPresets = {
  /** Standard workout - 2 warmups, 3 working sets with last to failure */
  standardWorkout: [
    { weightPercent: 50, composition: 'warmupEasy' },
    { weightPercent: 75, composition: 'warmupModerate' },
    { weightPercent: 85, composition: 'productiveWorking' },
    { weightPercent: 85, composition: 'productiveWorking' },
    { weightPercent: 85, composition: 'toFailure' },
  ] as SessionComposition,

  /** Discovery session - progressive weight exploration */
  discoverySession: [
    { weightPercent: 30, composition: 'warmupEasy' },
    { weightPercent: 50, composition: 'productiveWorking' },
    { weightPercent: 70, composition: 'productiveWorking' },
    { weightPercent: 85, composition: 'toFailure' },
  ] as SessionComposition,

  /** Junk volume session - session that went too long */
  junkVolumeSession: [
    { weightPercent: 85, composition: 'productiveWorking' },
    { weightPercent: 85, composition: 'productiveWorking' },
    { weightPercent: 85, composition: 'junkVolume' },
  ] as SessionComposition,

  /** Failed early session - jumped weight too fast */
  failedEarlySession: [
    { weightPercent: 50, composition: 'warmupEasy' },
    { weightPercent: 100, composition: 'tooHeavy' },
  ] as SessionComposition,

  /** Light warmup only */
  warmupOnly: [
    { weightPercent: 40, composition: 'warmupEasy' },
    { weightPercent: 60, composition: 'warmupEasy' },
    { weightPercent: 80, composition: 'warmupModerate' },
  ] as SessionComposition,

  /** Strength-focused session - heavier, fewer reps */
  strengthSession: [
    { weightPercent: 50, composition: 'warmupEasy' },
    { weightPercent: 70, composition: 'warmupModerate' },
    { weightPercent: 85, composition: 'strengthSet' },
    { weightPercent: 90, composition: 'strengthSet' },
    { weightPercent: 95, composition: 'strengthSet' },
  ] as SessionComposition,

  /** High volume session - more sets */
  highVolumeSession: [
    { weightPercent: 50, composition: 'warmupEasy' },
    { weightPercent: 75, composition: 'warmupModerate' },
    { weightPercent: 80, composition: 'productiveWorking' },
    { weightPercent: 80, composition: 'productiveWorking' },
    { weightPercent: 80, composition: 'productiveWorking' },
    { weightPercent: 80, composition: 'productiveWorking' },
    { weightPercent: 80, composition: 'toFailure' },
  ] as SessionComposition,
} as const;

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate a complete exercise session from a composition.
 *
 * @param composition - Array of set specifications
 * @param options - Configuration options
 * @returns Complete session with plan and completed sets
 */
export function generateSessionFromComposition(
  composition: SessionComposition,
  options: GenerateSessionOptions
): SessionFromCompositionResult {
  const {
    workingWeight,
    exerciseId = 'test_exercise',
    exerciseName = 'Test Exercise',
    goal = TrainingGoal.HYPERTROPHY,
    isDiscovery = false,
    startTime = Date.now(),
    restBetweenSets = 120,
  } = options;

  // Create exercise
  const exercise = createTestExercise({
    id: exerciseId,
    name: exerciseName,
  });

  // Create planned sets
  const plannedSets: PlannedSet[] = composition.map((spec, index) => {
    const weight = roundToNearest5(workingWeight * (spec.weightPercent / 100));
    const repComposition = resolveComposition(spec.composition);
    const isWarmup = spec.weightPercent < 85;

    return {
      setNumber: index + 1,
      weight,
      targetReps: repComposition.length,
      rirTarget: isWarmup ? 5 : 2,
      isWarmup,
    };
  });

  // Create plan
  const plan: ExercisePlan = {
    exerciseId,
    sets: plannedSets,
    defaultRestSeconds: restBetweenSets,
    goal,
    generatedAt: startTime,
    generatedBy: isDiscovery ? 'discovery' : 'standard',
  };

  // Generate completed sets
  const completedSets: CompletedSet[] = [];
  let currentTime = startTime;
  let totalReps = 0;
  let totalVolume = 0;

  for (let i = 0; i < composition.length; i++) {
    const spec = composition[i];
    const plannedSet = plannedSets[i];
    const repComposition = resolveComposition(spec.composition);

    const { set, completedRepCount } = generateSetFromBehaviors(repComposition, {
      weight: plannedSet.weight,
      exerciseId,
      exerciseName,
      processWithAggregators: true,
      startTime: currentTime,
    });

    if (set) {
      completedSets.push(set);
      const actualReps = set.data.reps.length;
      totalReps += actualReps;
      totalVolume += set.weight * actualReps;
    }

    // Advance time by set duration + rest
    currentTime += 60000 + restBetweenSets * 1000; // ~1 min for set + rest
  }

  // Create session
  const session: ExerciseSession = {
    id: `session_${startTime}_${uuid().substring(0, 8)}`,
    exercise,
    plan,
    completedSets,
    restEndsAt: null,
    startedAt: startTime,
  };

  return {
    session,
    plan,
    completedSets,
    totalReps,
    totalVolume,
  };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Convenience functions for generating sessions from presets.
 */
export const sessions = {
  standard: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) =>
    generateSessionFromComposition(sessionPresets.standardWorkout, { ...options, workingWeight }),

  discovery: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) =>
    generateSessionFromComposition(sessionPresets.discoverySession, {
      ...options,
      workingWeight,
      isDiscovery: true,
    }),

  junkVolume: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) =>
    generateSessionFromComposition(sessionPresets.junkVolumeSession, { ...options, workingWeight }),

  failedEarly: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) =>
    generateSessionFromComposition(sessionPresets.failedEarlySession, {
      ...options,
      workingWeight,
    }),

  warmupOnly: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) => generateSessionFromComposition(sessionPresets.warmupOnly, { ...options, workingWeight }),

  strength: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) =>
    generateSessionFromComposition(sessionPresets.strengthSession, {
      ...options,
      workingWeight,
      goal: TrainingGoal.STRENGTH,
    }),

  highVolume: (
    workingWeight: number,
    options?: Partial<Omit<GenerateSessionOptions, 'workingWeight'>>
  ) =>
    generateSessionFromComposition(sessionPresets.highVolumeSession, {
      ...options,
      workingWeight,
      goal: TrainingGoal.HYPERTROPHY,
    }),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve a composition reference to the actual RepBehavior array.
 */
function resolveComposition(composition: SetComposition | keyof typeof setPresets): SetComposition {
  if (typeof composition === 'string') {
    return [...setPresets[composition]];
  }
  return [...composition];
}

/**
 * Round weight to nearest 5 lbs (Voltra increment).
 */
function roundToNearest5(weight: number): number {
  return Math.max(5, Math.round(weight / 5) * 5);
}

/**
 * Create a test exercise with sensible defaults.
 */
export function createTestExercise(
  overrides: Partial<Exercise> & { id: string; name: string }
): Exercise {
  return createExercise({
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
    ...overrides,
  });
}

// =============================================================================
// Exercise Presets
// =============================================================================

/**
 * Pre-defined test exercises for common scenarios.
 */
export const testExercises = {
  compound: createTestExercise({
    id: 'cable_row',
    name: 'Seated Cable Row',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
  }),

  isolation: createTestExercise({
    id: 'cable_curl',
    name: 'Cable Bicep Curl',
    muscleGroups: [MuscleGroup.BICEPS],
    movementPattern: 'isolation',
  }),

  push: createTestExercise({
    id: 'cable_chest_press',
    name: 'Cable Chest Press',
    muscleGroups: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
    movementPattern: 'push',
  }),

  triceps: createTestExercise({
    id: 'cable_tricep_pushdown',
    name: 'Cable Tricep Pushdown',
    muscleGroups: [MuscleGroup.TRICEPS],
    movementPattern: 'push',
  }),
};
