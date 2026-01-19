/**
 * Workout Repository Implementation
 * 
 * Handles persistence of workout data using a StorageAdapter.
 */

import { StorageAdapter, STORAGE_KEYS } from '@/data/adapters';
import { StoredWorkout, WorkoutSummary, toWorkoutSummary } from '@/data/models';
import type { WorkoutRepository } from './types';

/**
 * Implementation of WorkoutRepository using a StorageAdapter.
 */
export class WorkoutRepositoryImpl implements WorkoutRepository {
  constructor(private adapter: StorageAdapter) {}
  
  /**
   * Get the index of all workout IDs.
   */
  private async getIndex(): Promise<string[]> {
    const index = await this.adapter.get<string[]>(STORAGE_KEYS.WORKOUTS_INDEX);
    return index ?? [];
  }
  
  /**
   * Save the index of workout IDs.
   */
  private async saveIndex(ids: string[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.WORKOUTS_INDEX, ids);
  }
  
  /**
   * Get storage key for a workout by ID.
   */
  private getKey(id: string): string {
    return `${STORAGE_KEYS.WORKOUT_PREFIX}${id}`;
  }
  
  async getById(id: string): Promise<StoredWorkout | null> {
    return this.adapter.get<StoredWorkout>(this.getKey(id));
  }
  
  async getAll(): Promise<StoredWorkout[]> {
    const index = await this.getIndex();
    const keys = index.map(id => this.getKey(id));
    const results = await this.adapter.getMultiple<StoredWorkout>(keys);
    
    const workouts: StoredWorkout[] = [];
    for (const [, workout] of results) {
      if (workout) {
        workouts.push(workout);
      }
    }
    
    // Sort by date descending
    return workouts.sort((a, b) => b.date - a.date);
  }
  
  async save(workout: StoredWorkout): Promise<void> {
    // Save the workout
    await this.adapter.set(this.getKey(workout.id), workout);
    
    // Update index if needed
    const index = await this.getIndex();
    if (!index.includes(workout.id)) {
      // Add to front (most recent)
      await this.saveIndex([workout.id, ...index]);
    }
  }
  
  async delete(id: string): Promise<void> {
    // Remove from storage
    await this.adapter.remove(this.getKey(id));
    
    // Remove from index
    const index = await this.getIndex();
    const newIndex = index.filter(i => i !== id);
    await this.saveIndex(newIndex);
  }
  
  async getRecent(count: number): Promise<StoredWorkout[]> {
    const index = await this.getIndex();
    const recentIds = index.slice(0, count);
    const keys = recentIds.map(id => this.getKey(id));
    const results = await this.adapter.getMultiple<StoredWorkout>(keys);
    
    const workouts: StoredWorkout[] = [];
    // Preserve order from index (most recent first)
    for (const id of recentIds) {
      const workout = results.get(this.getKey(id));
      if (workout) {
        workouts.push(workout);
      }
    }
    
    return workouts;
  }
  
  async getByExercise(exerciseId: string): Promise<StoredWorkout[]> {
    const all = await this.getAll();
    return all.filter(w => w.exerciseId === exerciseId);
  }
  
  async getByDateRange(start: Date, end: Date): Promise<StoredWorkout[]> {
    const all = await this.getAll();
    const startTs = start.getTime();
    const endTs = end.getTime();
    
    return all.filter(w => w.date >= startTs && w.date <= endTs);
  }
  
  async getSummaries(): Promise<WorkoutSummary[]> {
    const workouts = await this.getAll();
    return workouts.map(toWorkoutSummary);
  }
  
  async getAggregateStats(): Promise<{
    totalWorkouts: number;
    totalReps: number;
    totalVolume: number;
  }> {
    const workouts = await this.getAll();
    
    let totalReps = 0;
    let totalVolume = 0;
    
    for (const workout of workouts) {
      totalReps += workout.reps.length;
      totalVolume += workout.weight * workout.reps.length;
    }
    
    return {
      totalWorkouts: workouts.length,
      totalReps,
      totalVolume,
    };
  }
}
