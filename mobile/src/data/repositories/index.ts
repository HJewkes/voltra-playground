/**
 * Repository Exports
 * 
 * Singleton instances of all repositories using the AsyncStorageAdapter.
 */

import { asyncStorageAdapter } from '@/data/adapters';

// Types
export * from './types';

// Implementations
export { WorkoutRepositoryImpl } from './workout-repository';
export { DiscoveryRepositoryImpl } from './discovery-repository';
export { ProgressionRepositoryImpl } from './progression-repository';
export { PreferencesRepositoryImpl } from './preferences-repository';

// Import implementations
import { WorkoutRepositoryImpl } from './workout-repository';
import { DiscoveryRepositoryImpl } from './discovery-repository';
import { ProgressionRepositoryImpl } from './progression-repository';
import { PreferencesRepositoryImpl } from './preferences-repository';

/**
 * Singleton repository instances.
 * Use these throughout the app for data access.
 */
export const workoutRepository = new WorkoutRepositoryImpl(asyncStorageAdapter);
export const discoveryRepository = new DiscoveryRepositoryImpl(asyncStorageAdapter);
export const progressionRepository = new ProgressionRepositoryImpl(asyncStorageAdapter);
export const preferencesRepository = new PreferencesRepositoryImpl(asyncStorageAdapter);
