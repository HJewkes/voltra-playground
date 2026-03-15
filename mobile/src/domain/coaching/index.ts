/**
 * Coaching Domain
 *
 * AI coaching context generation for Claude-powered coaching responses.
 * Assembles telemetry from workout, planning, and history domains
 * into structured prompts for the Claude Messages API.
 */

export {
  buildCoachingContext,
  toPrompt,
  type BuildContextInput,
  type AutoRegulationInput,
} from './coaching-context-builder';

export type {
  CoachingContext,
  SetSummary,
  SessionContext,
  FatigueTrend,
  AthleteHistory,
  HistoricalSession,
  PersonalRecordSummary,
  AutoRegulationSignals,
  LoadSuggestionSummary,
  PreviousCoachingCue,
  VelocityWarningSeverity,
} from './types';

export { getCoachingCue, DEFAULT_MODEL } from './claude-api';
export { parseCoachingResponse, createFallbackCue } from './response-parser';

export type {
  CoachingCue,
  TextCue,
  LoadAdjustmentCue,
  EncouragementCue,
  CoachingApiConfig,
  TokenUsage,
} from './claude-api-types';
