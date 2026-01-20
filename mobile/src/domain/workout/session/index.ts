/**
 * Session termination logic barrel export.
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
