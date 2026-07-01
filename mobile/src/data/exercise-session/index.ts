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

// SQLite repository (op-sqlite backed)
export {
  SQLiteExerciseSessionRepository,
  createSQLiteExerciseSessionRepository,
  openSessionDatabase,
  type SessionDatabase,
} from './sqlite-exercise-session-repository';

// Session export
export { exportSession, exportSessionsToJSON, type SessionNote } from './session-export';
