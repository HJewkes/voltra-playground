/**
 * Exercise Session Data Layer
 *
 * Unified storage for all exercise sessions (discovery and standard).
 * Replaces both data/set/ and data/discovery/.
 */

// Schema types
export {
  type StoredExerciseSession,
  type StoredExercisePlan,
  type StoredSessionSet,
  type StoredRep,
  type LegacyStoredRep,
  type LegacyStoredSessionSet,
  type ExerciseSessionSummary,
  type TerminationReason,
  type SessionStatus,
} from './exercise-session-schema';

// Converters
export {
  toStoredExerciseSession,
  toStoredPlan,
  toStoredSessionSet,
  fromStoredExerciseSession,
  fromStoredPlan,
  fromStoredSessionSet,
  fromLegacyStoredSessionSet,
  toExerciseSessionSummary,
} from './exercise-session-converters';

// Repository
export {
  type ExerciseSessionRepository,
  ExerciseSessionRepositoryImpl,
  createExerciseSessionRepository,
} from './exercise-session-repository';

// SQLite repository (op-sqlite backed) is intentionally NOT re-exported here.
// op-sqlite is a native-only module; re-exporting its runtime values through
// this cross-platform barrel drags it into the web bundle and breaks the web
// build. Consumers that need it (tests, crash-recovery wiring) import directly
// from './sqlite-exercise-session-repository'. The SessionDatabase type is
// re-exported below because type-only exports are erased at build time.
export type { SessionDatabase } from './sqlite-exercise-session-repository';

// Session export
export { exportSession, exportSessionsToJSON, type SessionNote } from './session-export';

// Crash-safe telemetry buffer + recovery (VLT-09.11)
export {
  TelemetryBuffer,
  TELEMETRY_FLUSH_SAMPLE_COUNT,
  TELEMETRY_FLUSH_INTERVAL_MS,
  ensureSessionSchema,
  loadBufferedSamples,
  clearBufferedSamples,
  replaySamplesToSet,
  recoverInProgressSet,
  type TelemetryBufferOptions,
  type RecoveredSet,
} from './telemetry-buffer';
