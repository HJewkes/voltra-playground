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

// Recording store (singleton for per-recording analytics)
export { createRecordingStore, recordingStore, useRecordingStore } from './recording-store';
export type { RecordingState, RecordingStoreApi, RecordingUIState } from './recording-store';

// Exercise session store (singleton for multi-set orchestration)
export { createExerciseSessionStore, exerciseSessionStore, useExerciseSessionStore } from './exercise-session-store';
export type {
  ExerciseSessionState,
  ExerciseSessionStoreApi,
  ExerciseSessionUIState,
} from './exercise-session-store';

// Coaching store (singleton for AI coaching cue management)
export { createCoachingStore, coachingStore, useCoachingStore } from './coaching-store';
export type {
  CoachingState,
  CoachingStoreApi,
  CoachingCue,
  CoachingCueType,
  CoachingLogEntry,
  AthleteReaction,
} from './coaching-store';

export {
  createPlanDeliveryStore,
  planDeliveryStore,
  usePlanDeliveryStore,
  receiveWorkoutPlan,
} from './plan-delivery-store';
export type { PlanDeliveryState, PlanDeliveryStoreApi } from './plan-delivery-store';

// Singleton stores
export { useConnectionStore } from './connection-store';

// Connection store selectors (use with useConnectionStore(selector))
export { selectBleEnvironment, selectIsConnected } from './connection-store';
