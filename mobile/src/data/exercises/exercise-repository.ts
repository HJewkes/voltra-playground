/**
 * Exercise Repository
 *
 * CRUD operations for stored exercises.
 * Uses index-based storage pattern.
 */

import type { StorageAdapter } from '@/data/adapters/types';
import { STORAGE_KEYS } from '@/data/adapters/types';
import type { StoredExercise } from './exercise-schema';

/**
 * Exercise repository interface.
 */
export interface ExerciseRepository {
  /** Save an exercise (create or update) */
  save(exercise: StoredExercise): Promise<void>;

  /** Get exercise by ID */
  getById(id: string): Promise<StoredExercise | null>;

  /** Get all exercises */
  getAll(): Promise<StoredExercise[]>;

  /** Delete an exercise */
  delete(id: string): Promise<void>;

  /** Check if an exercise exists */
  exists(id: string): Promise<boolean>;

  /** Get count of stored exercises */
  count(): Promise<number>;
}

/**
 * Implementation of ExerciseRepository using a StorageAdapter.
 */
export class ExerciseRepositoryImpl implements ExerciseRepository {
  constructor(private adapter: StorageAdapter) {}

  /**
   * Get the index of all exercise IDs.
   */
  private async getIndex(): Promise<string[]> {
    const index = await this.adapter.get<string[]>(STORAGE_KEYS.EXERCISES_INDEX);
    return index ?? [];
  }

  /**
   * Save the index of exercise IDs.
   */
  private async saveIndex(ids: string[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.EXERCISES_INDEX, ids);
  }

  /**
   * Get storage key for an exercise by ID.
   */
  private getKey(id: string): string {
    return `${STORAGE_KEYS.EXERCISE_PREFIX}${id}`;
  }

  async save(exercise: StoredExercise): Promise<void> {
    // Save the exercise
    await this.adapter.set(this.getKey(exercise.id), exercise);

    // Update index if needed
    const index = await this.getIndex();
    if (!index.includes(exercise.id)) {
      await this.saveIndex([...index, exercise.id]);
    }
  }

  async getById(id: string): Promise<StoredExercise | null> {
    return this.adapter.get<StoredExercise>(this.getKey(id));
  }

  async getAll(): Promise<StoredExercise[]> {
    const index = await this.getIndex();
    if (index.length === 0) return [];

    const keys = index.map((id) => this.getKey(id));
    const results = await this.adapter.getMultiple<StoredExercise>(keys);

    const exercises: StoredExercise[] = [];
    for (const [, exercise] of results) {
      if (exercise) {
        exercises.push(exercise);
      }
    }

    // Sort alphabetically by name
    return exercises.sort((a, b) => a.name.localeCompare(b.name));
  }

  async delete(id: string): Promise<void> {
    // Remove from storage
    await this.adapter.remove(this.getKey(id));

    // Remove from index
    const index = await this.getIndex();
    const newIndex = index.filter((i) => i !== id);
    await this.saveIndex(newIndex);
  }

  async exists(id: string): Promise<boolean> {
    const exercise = await this.getById(id);
    return exercise !== null;
  }

  async count(): Promise<number> {
    const index = await this.getIndex();
    return index.length;
  }
}

/**
 * Create a repository instance with the given adapter.
 */
export function createExerciseRepository(adapter: StorageAdapter): ExerciseRepository {
  return new ExerciseRepositoryImpl(adapter);
}
