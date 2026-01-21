/**
 * Exercise Data Module
 *
 * Storage and management of exercise definitions.
 */

// Schema
export type { StoredExercise } from './exercise-schema';
export { EXERCISE_CATALOG_VERSION } from './exercise-schema';

// Repository
export type { ExerciseRepository } from './exercise-repository';
export { ExerciseRepositoryImpl, createExerciseRepository } from './exercise-repository';

// Bootstrap
export { bootstrapExercises, forceReseedCatalog } from './exercise-bootstrap';
