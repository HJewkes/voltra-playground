/**
 * Stored Exercise Schema
 *
 * Defines the storage format for exercises.
 * Mirrors domain Exercise with additional storage metadata.
 */

import type { MuscleGroup, MovementPattern, VoltrasSetup } from '@/domain/exercise';
import type { TempoTarget } from '@/domain/workout';

/**
 * Stored exercise - exercise definition with storage metadata.
 */
export interface StoredExercise {
  /** Unique exercise identifier (e.g., "cable_row") */
  id: string;

  /** Display name */
  name: string;

  /** Primary and secondary muscle groups */
  muscleGroups: MuscleGroup[];

  /** Movement pattern classification */
  movementPattern: MovementPattern;

  /** Optional Voltra-specific equipment setup */
  equipmentSetup?: VoltrasSetup;

  /** Default tempo target for this exercise */
  defaultTempo?: TempoTarget;

  /** Notes about range of motion */
  rangeOfMotionNotes?: string;

  // Storage metadata
  
  /** Whether this is a custom user-created exercise */
  isCustom: boolean;

  /** When the exercise was created/added (ms since epoch) */
  createdAt: number;

  /** When the exercise was last modified (ms since epoch) */
  updatedAt: number;
}

/**
 * Current version of the exercise catalog.
 * Increment when adding new exercises to the catalog
 * to trigger merge on next app startup.
 */
export const EXERCISE_CATALOG_VERSION = 1;
