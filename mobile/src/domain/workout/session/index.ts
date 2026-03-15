/**
 * Session logic barrel export.
 */

export {
  type TerminationReason,
  type TerminationResult,
  type TerminationConfig,
  DEFAULT_TERMINATION_CONFIG,
  checkTermination,
  createUserStoppedTermination,
  getTerminationMessage,
} from './termination';

export {
  type IntensityAdjustment,
  type ReadinessAssessment,
  deriveIntensityAdjustment,
  assessReadiness,
  isReadinessCheckCandidate,
} from './readiness';

export {
  type FatigueTrend,
  type SessionFatigueResult,
  computeSessionFatigue,
} from './session-fatigue';
