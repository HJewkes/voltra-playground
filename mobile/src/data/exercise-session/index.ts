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
  type ExerciseSessionSummary,
  type TerminationReason,
  type SessionStatus,
} from './schema';

// Converters
export {
  toStoredExerciseSession,
  toStoredPlan,
  toStoredSessionSet,
  fromStoredExerciseSession,
  fromStoredPlan,
  fromStoredSessionSet,
  toExerciseSessionSummary,
} from './converters';

// Repository
export {
  type ExerciseSessionRepository,
  ExerciseSessionRepositoryImpl,
  createExerciseSessionRepository,
} from './repository';
