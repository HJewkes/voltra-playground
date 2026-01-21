/**
 * Zustand Stores
 *
 * Centralized state management for the Voltra app.
 */

// Per-device store (factory)
export { createVoltraStore } from './voltra-store';
export type {
  VoltraState,
  VoltraStoreApi,
  ConnectionState,
  RecordingState as VoltraRecordingState, // Renamed to avoid conflict
} from './voltra-store';

// Recording store (factory for per-recording analytics)
export { createRecordingStore } from './recording-store';
export type { RecordingState, RecordingStoreApi, RecordingUIState } from './recording-store';

// Exercise session store (factory for multi-set orchestration)
export { createExerciseSessionStore } from './exercise-session-store';
export type {
  ExerciseSessionState,
  ExerciseSessionStoreApi,
  ExerciseSessionUIState,
} from './exercise-session-store';

// Singleton stores
export { useConnectionStore } from './connection-store';
export type { RelayStatus } from './connection-store';

// Connection store selectors (use with useConnectionStore(selector))
export {
  selectIsWeb,
  selectIsConnected,
  selectConnectedDeviceName,
  selectRelayNotReady,
} from './connection-store';
