/**
 * domain/coaching - Claude-as-coach feedback loop.
 *
 * Provides AI coaching cues during workout sessions with a feedback loop:
 * athlete reactions and compliance data inform subsequent coaching calls.
 */

// Types
export type {
  CoachingCue,
  CueReaction,
  ReactedCue,
  ComplianceOutcome,
  CueComplianceRecord,
  CoachingContext,
} from './types';

// Context builder
export {
  buildCoachingContext,
  buildComplianceRecord,
  assessCompliance,
  toPrompt,
} from './coaching-context-builder';

// Claude API
export { getCoachingCue, parseCoachingResponse, type ClaudeApiConfig } from './claude-api';

// Store
export {
  coachingStore,
  createCoachingStore,
  useCoachingStore,
  type CoachingState,
  type CoachingStoreApi,
} from './coaching-store';

// Loop orchestration
export { executeCoachingLoop } from './coaching-loop';
