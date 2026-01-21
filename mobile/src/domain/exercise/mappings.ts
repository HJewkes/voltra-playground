/**
 * Exercise Mappings
 *
 * Quick lookup maps for exercise metadata.
 * Used for validation, defaults, and UI display.
 */

import { MuscleGroup, type ExerciseType } from './types';

// =============================================================================
// Muscle Group Mappings
// =============================================================================

/**
 * Primary muscle group mapping for common Voltra exercises.
 * Maps exercise ID to its primary muscle group.
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
  bicep_curl: MuscleGroup.BICEPS,
  cable_hammer_curl: MuscleGroup.BICEPS,

  // Triceps
  cable_tricep_pushdown: MuscleGroup.TRICEPS,
  tricep_pushdown: MuscleGroup.TRICEPS,
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

// =============================================================================
// Exercise Type Mappings
// =============================================================================

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
  bicep_curl: 'isolation',
  cable_hammer_curl: 'isolation',
  cable_tricep_pushdown: 'isolation',
  tricep_pushdown: 'isolation',
  cable_tricep_extension: 'isolation',
  cable_lateral_raise: 'isolation',
  cable_face_pull: 'isolation',
  cable_leg_curl: 'isolation',
  cable_kickback: 'isolation',
  cable_crunch: 'isolation',
  cable_woodchop: 'isolation',
};

// =============================================================================
// Lookup Functions
// =============================================================================

/**
 * Get display name for an exercise ID.
 * Converts snake_case to Title Case.
 */
export function getExerciseName(exerciseId: string): string {
  return exerciseId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

/**
 * Get primary muscle group for an exercise.
 * Returns undefined if exercise is unknown.
 */
export function getExerciseMuscleGroup(exerciseId: string): MuscleGroup | undefined {
  return EXERCISE_MUSCLE_GROUPS[exerciseId];
}

/**
 * Get exercise type (compound/isolation).
 * Defaults to 'compound' if unknown.
 */
export function getExerciseType(exerciseId: string): ExerciseType {
  return EXERCISE_TYPES[exerciseId] ?? 'compound';
}
