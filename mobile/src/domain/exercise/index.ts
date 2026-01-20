/**
 * Exercise Domain
 * 
 * Pure exercise definitions - metadata about exercises.
 * 
 * Contains:
 * - Types: MuscleGroup, MovementPattern, ExerciseType
 * - Catalog: Exercise interface, EXERCISE_CATALOG, getExercise, getAllExercises
 * - Mappings: EXERCISE_MUSCLE_GROUPS, EXERCISE_TYPES, getExerciseName, getKnownExercises
 * 
 * Note: ExerciseSession, ExercisePlan, and PlannedSet have moved to @/domain/workout/models
 */

// Types
export {
  MuscleGroup,
  type MovementPattern,
  type ExerciseType,
  type VoltrasSetup,
} from './types';

// Catalog
export {
  type Exercise,
  EXERCISE_CATALOG,
  createExercise,
  getExercise,
  getAllExercises,
} from './catalog';

// Mappings (legacy helpers from training/plan-loader)
export {
  EXERCISE_MUSCLE_GROUPS,
  EXERCISE_TYPES,
  getExerciseName,
  getKnownExercises,
} from './mappings';
