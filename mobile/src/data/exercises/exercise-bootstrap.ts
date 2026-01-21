/**
 * Exercise Bootstrap
 *
 * Seeds the exercise repository from the built-in catalog on first run.
 * Merges new catalog exercises when the catalog version bumps.
 */

import { EXERCISE_CATALOG, type Exercise } from '@/domain/exercise';
import type { StorageAdapter } from '@/data/adapters/types';
import { STORAGE_KEYS } from '@/data/adapters/types';
import type { ExerciseRepository } from './exercise-repository';
import type { StoredExercise } from './exercise-schema';
import { EXERCISE_CATALOG_VERSION } from './exercise-schema';

/**
 * Convert a domain Exercise to a StoredExercise.
 */
function toStoredExercise(exercise: Exercise): StoredExercise {
  const now = Date.now();
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroups: exercise.muscleGroups,
    movementPattern: exercise.movementPattern,
    equipmentSetup: exercise.equipmentSetup,
    defaultTempo: exercise.defaultTempo,
    rangeOfMotionNotes: exercise.rangeOfMotionNotes,
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get the stored catalog version.
 */
async function getStoredCatalogVersion(adapter: StorageAdapter): Promise<number> {
  const version = await adapter.get<number>(STORAGE_KEYS.EXERCISE_CATALOG_VERSION);
  return version ?? 0;
}

/**
 * Save the catalog version.
 */
async function saveCatalogVersion(adapter: StorageAdapter, version: number): Promise<void> {
  await adapter.set(STORAGE_KEYS.EXERCISE_CATALOG_VERSION, version);
}

/**
 * Bootstrap exercises from the catalog.
 *
 * - On first run (empty repo): Seeds all exercises from EXERCISE_CATALOG
 * - On catalog version bump: Merges new exercises (doesn't overwrite custom or modified)
 *
 * @param repo - Exercise repository instance
 * @param adapter - Storage adapter for version tracking
 */
export async function bootstrapExercises(
  repo: ExerciseRepository,
  adapter: StorageAdapter
): Promise<{ added: number; skipped: number }> {
  const storedVersion = await getStoredCatalogVersion(adapter);
  const currentVersion = EXERCISE_CATALOG_VERSION;

  // If already at current version, nothing to do
  if (storedVersion >= currentVersion) {
    return { added: 0, skipped: 0 };
  }

  let added = 0;
  let skipped = 0;

  // Get all exercises from catalog
  const catalogExercises = Object.values(EXERCISE_CATALOG);

  for (const exercise of catalogExercises) {
    const exists = await repo.exists(exercise.id);

    if (!exists) {
      // New exercise - add it
      await repo.save(toStoredExercise(exercise));
      added++;
    } else {
      // Exercise exists - skip (don't overwrite user modifications)
      skipped++;
    }
  }

  // Update stored version
  await saveCatalogVersion(adapter, currentVersion);

  return { added, skipped };
}

/**
 * Force re-seed all catalog exercises.
 * WARNING: This will overwrite any non-custom exercises.
 */
export async function forceReseedCatalog(
  repo: ExerciseRepository,
  adapter: StorageAdapter
): Promise<{ updated: number }> {
  let updated = 0;

  const catalogExercises = Object.values(EXERCISE_CATALOG);

  for (const exercise of catalogExercises) {
    const existing = await repo.getById(exercise.id);

    // Only overwrite non-custom exercises
    if (!existing || !existing.isCustom) {
      await repo.save(toStoredExercise(exercise));
      updated++;
    }
  }

  // Update stored version
  await saveCatalogVersion(adapter, EXERCISE_CATALOG_VERSION);

  return { updated };
}
