/**
 * Repository Interfaces
 * 
 * Defines the data access interfaces for the app.
 * Repositories handle CRUD operations on primary data only.
 * Derived data (baselines, PRs, trends) is computed by HistoryStore.
 */

import type {
  StoredWorkout,
  WorkoutSummary,
  DiscoverySession,
  StoredProgressionState,
  ExerciseProgressionConfig,
  Device,
  UserPreferences,
} from '@/data/models';

/**
 * Generic repository interface.
 */
export interface Repository<T, ID = string> {
  getById(id: ID): Promise<T | null>;
  getAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

/**
 * Workout repository - source of truth for workout data.
 * Velocity baselines and PRs are computed from this data.
 */
export interface WorkoutRepository extends Repository<StoredWorkout> {
  /**
   * Get recent workouts, sorted by date descending.
   */
  getRecent(count: number): Promise<StoredWorkout[]>;
  
  /**
   * Get all workouts for a specific exercise.
   */
  getByExercise(exerciseId: string): Promise<StoredWorkout[]>;
  
  /**
   * Get workouts within a date range.
   */
  getByDateRange(start: Date, end: Date): Promise<StoredWorkout[]>;
  
  /**
   * Get workout summaries (lighter than full workouts).
   */
  getSummaries(): Promise<WorkoutSummary[]>;
  
  /**
   * Get aggregate stats (total workouts, reps, volume).
   */
  getAggregateStats(): Promise<{
    totalWorkouts: number;
    totalReps: number;
    totalVolume: number;
  }>;
}

/**
 * Discovery session repository.
 */
export interface DiscoveryRepository extends Repository<DiscoverySession> {
  /**
   * Get discovery sessions for an exercise.
   */
  getByExercise(exerciseId: string): Promise<DiscoverySession[]>;
  
  /**
   * Get the most recent discovery session.
   */
  getLatest(): Promise<DiscoverySession | null>;
  
  /**
   * Get the current in-progress session (if any).
   */
  getCurrentSession(): Promise<DiscoverySession | null>;
  
  /**
   * Save/update the current session.
   */
  saveCurrentSession(session: DiscoverySession): Promise<void>;
  
  /**
   * Clear the current session.
   */
  clearCurrentSession(): Promise<void>;
}

/**
 * Raw state format used by ProgressionEngine.
 */
export interface ProgressionEngineState {
  exerciseHistory: Record<string, unknown[]>;
  consecutiveFailures: Record<string, number>;
  lastDeloadDate: number | null;
  weeksSinceDeload: number;
}

/**
 * Progression state repository.
 */
export interface ProgressionRepository {
  /**
   * Get the full progression state.
   */
  getState(): Promise<StoredProgressionState | null>;
  
  /**
   * Save the full progression state.
   */
  saveState(state: StoredProgressionState): Promise<void>;
  
  /**
   * Get raw state in ProgressionEngine format.
   */
  getRawState(): Promise<ProgressionEngineState | null>;
  
  /**
   * Save raw state in ProgressionEngine format.
   */
  saveRawState(state: ProgressionEngineState): Promise<void>;
  
  /**
   * Get progression config for a specific exercise.
   */
  getExerciseConfig(exerciseId: string): Promise<ExerciseProgressionConfig | null>;
  
  /**
   * Save progression config for a specific exercise.
   */
  saveExerciseConfig(exerciseId: string, config: ExerciseProgressionConfig): Promise<void>;
}

/**
 * Preferences repository.
 */
export interface PreferencesRepository {
  /**
   * Get the last connected device.
   */
  getLastDevice(): Promise<Device | null>;
  
  /**
   * Save the last connected device.
   */
  saveLastDevice(device: Device): Promise<void>;
  
  /**
   * Clear the last device (disconnect).
   */
  clearLastDevice(): Promise<void>;
  
  /**
   * Check if auto-reconnect is enabled.
   */
  isAutoReconnectEnabled(): Promise<boolean>;
  
  /**
   * Set auto-reconnect preference.
   */
  setAutoReconnectEnabled(enabled: boolean): Promise<void>;
  
  /**
   * Get all user preferences.
   */
  getPreferences(): Promise<UserPreferences>;
  
  /**
   * Save user preferences.
   */
  savePreferences(prefs: Partial<UserPreferences>): Promise<void>;
}
