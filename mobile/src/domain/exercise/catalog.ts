/**
 * Exercise Catalog
 *
 * Exercise definitions and lookup functions.
 * Contains the master catalog of all known exercises with their metadata.
 */

import type { TempoTarget } from '@/domain/workout';
import { MuscleGroup, MovementPattern, VoltrasSetup } from './types';

// =============================================================================
// Exercise Interface
// =============================================================================

/**
 * Exercise definition - metadata about an exercise.
 *
 * @example
 * const benchPress: Exercise = {
 *   id: 'bench_press',
 *   name: 'Bench Press',
 *   muscleGroups: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
 *   movementPattern: 'push',
 * };
 */
export interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  movementPattern: MovementPattern;
  equipmentSetup?: VoltrasSetup;
  defaultTempo?: TempoTarget;
  rangeOfMotionNotes?: string;
}

// =============================================================================
// Exercise Factory
// =============================================================================

/**
 * Create an exercise with sensible defaults.
 */
export function createExercise(
  base: Pick<Exercise, 'id' | 'name'> & Partial<Exercise>
): Exercise {
  return {
    id: base.id,
    name: base.name,
    muscleGroups: base.muscleGroups ?? [MuscleGroup.BACK],
    movementPattern: base.movementPattern ?? 'pull',
    equipmentSetup: base.equipmentSetup,
    defaultTempo: base.defaultTempo,
    rangeOfMotionNotes: base.rangeOfMotionNotes,
  };
}

// =============================================================================
// Exercise Catalog
// =============================================================================

/**
 * Master catalog of all known exercises.
 * Future: Load from database or API.
 */
export const EXERCISE_CATALOG: Record<string, Exercise> = {
  // Back exercises
  cable_row: createExercise({
    id: 'cable_row',
    name: 'Seated Cable Row',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
  }),
  seated_cable_row: createExercise({
    id: 'seated_cable_row',
    name: 'Seated Cable Row',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
  }),
  lat_pulldown: createExercise({
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
  }),
  cable_pulldown: createExercise({
    id: 'cable_pulldown',
    name: 'Cable Pulldown',
    muscleGroups: [MuscleGroup.BACK, MuscleGroup.BICEPS],
    movementPattern: 'pull',
  }),

  // Chest exercises
  cable_chest_press: createExercise({
    id: 'cable_chest_press',
    name: 'Cable Chest Press',
    muscleGroups: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
    movementPattern: 'push',
  }),
  cable_fly: createExercise({
    id: 'cable_fly',
    name: 'Cable Fly',
    muscleGroups: [MuscleGroup.CHEST],
    movementPattern: 'isolation',
  }),
  cable_crossover: createExercise({
    id: 'cable_crossover',
    name: 'Cable Crossover',
    muscleGroups: [MuscleGroup.CHEST],
    movementPattern: 'isolation',
  }),

  // Biceps exercises
  cable_curl: createExercise({
    id: 'cable_curl',
    name: 'Cable Bicep Curl',
    muscleGroups: [MuscleGroup.BICEPS],
    movementPattern: 'isolation',
  }),
  bicep_curl: createExercise({
    id: 'bicep_curl',
    name: 'Cable Bicep Curl',
    muscleGroups: [MuscleGroup.BICEPS],
    movementPattern: 'isolation',
  }),
  cable_hammer_curl: createExercise({
    id: 'cable_hammer_curl',
    name: 'Cable Hammer Curl',
    muscleGroups: [MuscleGroup.BICEPS],
    movementPattern: 'isolation',
  }),

  // Triceps exercises
  cable_tricep_pushdown: createExercise({
    id: 'cable_tricep_pushdown',
    name: 'Cable Tricep Pushdown',
    muscleGroups: [MuscleGroup.TRICEPS],
    movementPattern: 'isolation',
  }),
  tricep_pushdown: createExercise({
    id: 'tricep_pushdown',
    name: 'Tricep Pushdown',
    muscleGroups: [MuscleGroup.TRICEPS],
    movementPattern: 'isolation',
  }),
  cable_tricep_extension: createExercise({
    id: 'cable_tricep_extension',
    name: 'Cable Tricep Extension',
    muscleGroups: [MuscleGroup.TRICEPS],
    movementPattern: 'isolation',
  }),

  // Shoulder exercises
  cable_shoulder_press: createExercise({
    id: 'cable_shoulder_press',
    name: 'Cable Shoulder Press',
    muscleGroups: [MuscleGroup.SHOULDERS, MuscleGroup.TRICEPS],
    movementPattern: 'push',
  }),
  cable_lateral_raise: createExercise({
    id: 'cable_lateral_raise',
    name: 'Cable Lateral Raise',
    muscleGroups: [MuscleGroup.SHOULDERS],
    movementPattern: 'isolation',
  }),
  cable_face_pull: createExercise({
    id: 'cable_face_pull',
    name: 'Cable Face Pull',
    muscleGroups: [MuscleGroup.SHOULDERS, MuscleGroup.BACK],
    movementPattern: 'pull',
  }),

  // Leg exercises
  cable_squat: createExercise({
    id: 'cable_squat',
    name: 'Cable Squat',
    muscleGroups: [MuscleGroup.QUADS, MuscleGroup.GLUTES],
    movementPattern: 'squat',
  }),
  cable_lunge: createExercise({
    id: 'cable_lunge',
    name: 'Cable Lunge',
    muscleGroups: [MuscleGroup.QUADS, MuscleGroup.GLUTES],
    movementPattern: 'lunge',
  }),
  cable_leg_curl: createExercise({
    id: 'cable_leg_curl',
    name: 'Cable Leg Curl',
    muscleGroups: [MuscleGroup.HAMSTRINGS],
    movementPattern: 'isolation',
  }),
  cable_deadlift: createExercise({
    id: 'cable_deadlift',
    name: 'Cable Deadlift',
    muscleGroups: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.BACK],
    movementPattern: 'hinge',
  }),
  cable_hip_thrust: createExercise({
    id: 'cable_hip_thrust',
    name: 'Cable Hip Thrust',
    muscleGroups: [MuscleGroup.GLUTES, MuscleGroup.HAMSTRINGS],
    movementPattern: 'hinge',
  }),
  cable_kickback: createExercise({
    id: 'cable_kickback',
    name: 'Cable Kickback',
    muscleGroups: [MuscleGroup.GLUTES],
    movementPattern: 'isolation',
  }),

  // Core exercises
  cable_crunch: createExercise({
    id: 'cable_crunch',
    name: 'Cable Crunch',
    muscleGroups: [MuscleGroup.CORE],
    movementPattern: 'isolation',
  }),
  cable_woodchop: createExercise({
    id: 'cable_woodchop',
    name: 'Cable Woodchop',
    muscleGroups: [MuscleGroup.CORE],
    movementPattern: 'rotation',
  }),
};

// =============================================================================
// Lookup Functions
// =============================================================================

/**
 * Get an exercise by ID.
 */
export function getExercise(exerciseId: string): Exercise | undefined {
  return EXERCISE_CATALOG[exerciseId];
}

/**
 * Get all available exercises.
 */
export function getAllExercises(): Exercise[] {
  return Object.values(EXERCISE_CATALOG);
}

/**
 * Check if an exercise exists in the catalog.
 */
export function hasExercise(exerciseId: string): boolean {
  return exerciseId in EXERCISE_CATALOG;
}
