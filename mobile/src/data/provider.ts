/**
 * Data Provider
 *
 * Centralized access to storage adapters and repositories.
 * Provides singletons for consistent access across the app and
 * test injection points for mocking.
 */

import { AsyncStorageAdapter } from './adapters/async-storage-adapter';
import { MMKVAdapter } from './adapters/mmkv-adapter';
import type { StorageAdapter } from './adapters/types';
import {
  createExerciseSessionRepository,
  type ExerciseSessionRepository,
} from './exercise-session/exercise-session-repository';
import { createExerciseRepository, type ExerciseRepository } from './exercises/exercise-repository';
import {
  createRecordingRepository,
  type RecordingRepository,
} from './recordings/recording-repository';

// Re-export debug config for convenience (consumers can import from provider)
export { isDebugTelemetryEnabled, setDebugTelemetryEnabled } from './debug-config';

// =============================================================================
// Storage Adapter Singleton
// =============================================================================

let _adapter: StorageAdapter | null = null;
let _mmkvAdapter: StorageAdapter | null = null;

/**
 * Get the default storage adapter singleton (AsyncStorage).
 * Used for large data: sessions, recordings, manual logs, workout plans.
 */
export function getAdapter(): StorageAdapter {
  if (!_adapter) {
    _adapter = new AsyncStorageAdapter();
  }
  return _adapter;
}

/**
 * Get the MMKV storage adapter singleton.
 * Used for small, frequently-accessed data: preferences, velocity profiles,
 * exercise catalog state. Synchronous reads are ~30x faster than AsyncStorage.
 */
export function getMMKVAdapter(): StorageAdapter {
  if (!_mmkvAdapter) {
    _mmkvAdapter = new MMKVAdapter();
  }
  return _mmkvAdapter;
}

/**
 * Set a test adapter for mocking in tests.
 * Clears all cached repositories.
 */
export function setTestAdapter(adapter: StorageAdapter | null): void {
  _adapter = adapter;
  _mmkvAdapter = adapter;
  // Clear cached repositories so they use the new adapter
  _sessionRepository = null;
  _exerciseRepository = null;
  _recordingRepository = null;
}

// =============================================================================
// Repository Singletons
// =============================================================================

let _sessionRepository: ExerciseSessionRepository | null = null;
let _exerciseRepository: ExerciseRepository | null = null;
let _recordingRepository: RecordingRepository | null = null;

/**
 * Get the exercise session repository singleton.
 */
export function getSessionRepository(): ExerciseSessionRepository {
  if (!_sessionRepository) {
    _sessionRepository = createExerciseSessionRepository(getAdapter());
  }
  return _sessionRepository;
}

/**
 * Get the exercise repository singleton.
 */
export function getExerciseRepository(): ExerciseRepository {
  if (!_exerciseRepository) {
    _exerciseRepository = createExerciseRepository(getMMKVAdapter());
  }
  return _exerciseRepository;
}

/**
 * Get the recording repository singleton.
 */
export function getRecordingRepository(): RecordingRepository {
  if (!_recordingRepository) {
    _recordingRepository = createRecordingRepository(getAdapter());
  }
  return _recordingRepository;
}
