/**
 * Storage Adapter Types
 * 
 * Defines the interface for storage backends (AsyncStorage, InMemory, etc.).
 * This abstraction allows swapping storage implementations for testing.
 */

/**
 * Low-level storage operations interface.
 * Implementations handle actual persistence.
 */
export interface StorageAdapter {
  /**
   * Get a value by key.
   * Returns null if key doesn't exist.
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set a value by key.
   */
  set<T>(key: string, value: T): Promise<void>;
  
  /**
   * Remove a value by key.
   */
  remove(key: string): Promise<void>;
  
  /**
   * Get all keys, optionally filtered by prefix.
   */
  keys(prefix?: string): Promise<string[]>;
  
  /**
   * Clear all storage (use with caution).
   */
  clear(): Promise<void>;
  
  /**
   * Get multiple values by keys.
   * Returns a map of key -> value (or null if not found).
   */
  getMultiple<T>(keys: string[]): Promise<Map<string, T | null>>;
  
  /**
   * Set multiple values at once.
   */
  setMultiple<T>(entries: Array<[string, T]>): Promise<void>;
}

/**
 * Storage key prefixes for different data types.
 */
export const STORAGE_KEYS = {
  // Workouts (legacy - being replaced by exercise sessions)
  WORKOUTS_INDEX: 'voltra:workouts:index',
  WORKOUT_PREFIX: 'voltra:workouts:',
  
  // Discovery sessions (legacy - being replaced by exercise sessions)
  DISCOVERY_INDEX: 'voltra:discovery:index',
  DISCOVERY_PREFIX: 'voltra:discovery:',
  
  // Exercise sessions (unified storage for all sessions)
  EXERCISE_SESSIONS_INDEX: 'voltra:exercise-sessions:index',
  EXERCISE_SESSION_PREFIX: 'voltra:exercise-sessions:',
  EXERCISE_SESSION_CURRENT: 'voltra:exercise-sessions:current',
  
  // Progression state
  PROGRESSION_STATE: 'voltra:progression:state',
  PROGRESSION_EXERCISE_PREFIX: 'voltra:progression:exercise:',
  
  // Preferences
  LAST_DEVICE: 'voltra:preferences:lastDevice',
  AUTO_RECONNECT: 'voltra:preferences:autoReconnect',
  
  // Migration
  STORAGE_VERSION: 'voltra:version',
} as const;

/**
 * Current storage schema version.
 * Increment when making breaking changes to stored data structure.
 */
export const CURRENT_STORAGE_VERSION = 2;
