/**
 * Coaching Context Builder
 *
 * Builds structured context for Claude API calls. Includes:
 * - Current session state (exercise, sets, velocities)
 * - Previous coaching cues with athlete reactions
 * - Compliance tracking (did the athlete follow advice? did it work?)
 * - Auto-regulation signals for informed coaching
 */

import { getSetMeanVelocity } from '@voltras/workout-analytics';
import type { ExerciseSession } from '@/domain/workout';
import type { AutoRegulationState } from '@/domain/planning/auto-regulation';
import type {
  CoachingContext,
  CueComplianceRecord,
  ComplianceOutcome,
  ReactedCue,
} from './types';

// =============================================================================
// Compliance Assessment
// =============================================================================

const WEIGHT_TOLERANCE_LBS = 2.5;

/**
 * Determine if the athlete followed a coaching cue's load suggestion.
 */
export function assessCompliance(
  cue: ReactedCue,
  actualWeight: number | null,
  previousWeight: number
): ComplianceOutcome {
  if (actualWeight === null) return 'unknown';
  if (cue.suggestedLoadDelta === 0) return 'followed';

  const targetWeight = cue.suggestedWeight ?? (previousWeight + cue.suggestedLoadDelta);
  const delta = Math.abs(actualWeight - targetWeight);

  if (delta <= WEIGHT_TOLERANCE_LBS) return 'followed';

  const movedInRightDirection =
    (cue.suggestedLoadDelta > 0 && actualWeight > previousWeight) ||
    (cue.suggestedLoadDelta < 0 && actualWeight < previousWeight);

  return movedInRightDirection ? 'partial' : 'ignored';
}

/**
 * Build a compliance record for a cue by comparing against the next set.
 */
export function buildComplianceRecord(
  cue: ReactedCue,
  session: ExerciseSession
): CueComplianceRecord {
  const setBeforeCue = session.completedSets[cue.afterSetIndex];
  const setAfterCue = session.completedSets[cue.afterSetIndex + 1];

  const previousWeight = setBeforeCue?.weight ?? 0;
  const previousVelocity = setBeforeCue
    ? getSetMeanVelocity(setBeforeCue.data)
    : null;

  const actualWeight = setAfterCue?.weight ?? null;
  const actualVelocity = setAfterCue
    ? getSetMeanVelocity(setAfterCue.data)
    : null;

  const compliance = assessCompliance(cue, actualWeight, previousWeight);
  const summary = formatComplianceSummary(
    cue,
    compliance,
    actualWeight,
    actualVelocity,
    previousVelocity
  );

  return {
    cue,
    compliance,
    actualWeight,
    actualVelocity,
    previousVelocity,
    summary,
  };
}

// =============================================================================
// Summary Formatting
// =============================================================================

function formatComplianceSummary(
  cue: ReactedCue,
  compliance: ComplianceOutcome,
  actualWeight: number | null,
  actualVelocity: number | null,
  previousVelocity: number | null
): string {
  const cueSnippet = truncateMessage(cue.message, 60);

  if (compliance === 'unknown') {
    return `Coach suggested: "${cueSnippet}". No follow-up set recorded yet.`;
  }

  const weightStr = actualWeight !== null ? `${actualWeight}lbs` : '?';
  const velocityResult = formatVelocityChange(actualVelocity, previousVelocity);

  switch (compliance) {
    case 'followed':
      return `Coach suggested: "${cueSnippet}". Athlete followed (used ${weightStr}). ${velocityResult}`;
    case 'partial':
      return `Coach suggested: "${cueSnippet}". Athlete partially followed (used ${weightStr}). ${velocityResult}`;
    case 'ignored':
      return `Coach suggested: "${cueSnippet}". Athlete ignored (stayed at ${weightStr}). ${velocityResult}`;
  }
}

function formatVelocityChange(
  current: number | null,
  previous: number | null
): string {
  if (current === null || previous === null) return '';
  if (previous === 0) return `Velocity: ${current.toFixed(2)} m/s.`;

  const delta = current - previous;
  const direction = delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'unchanged';
  return `Velocity ${direction}: ${previous.toFixed(2)} → ${current.toFixed(2)} m/s.`;
}

function truncateMessage(message: string, maxLen: number): string {
  if (message.length <= maxLen) return message;
  return message.substring(0, maxLen - 3) + '...';
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Build complete coaching context for the next Claude API call.
 *
 * Gathers session state, previous cues with compliance tracking,
 * and auto-regulation signals into a structured context object.
 */
export function buildCoachingContext(
  session: ExerciseSession,
  reactedCues: ReactedCue[],
  autoRegulation: AutoRegulationState | null,
  cueStyle: 'brief' | 'detailed' = 'brief'
): CoachingContext {
  const completedSetsSummary = session.completedSets.map((set, i) => {
    const velocity = getSetMeanVelocity(set.data);
    const repCount = set.data.reps.length;
    return `Set ${i + 1}: ${set.weight}lbs x ${repCount} reps @ ${velocity.toFixed(2)} m/s`;
  });

  const complianceRecords = reactedCues.map((cue) =>
    buildComplianceRecord(cue, session)
  );

  const previousCueFeedback = complianceRecords.map((record) => {
    const reactionStr = record.cue.reaction
      ? ` (athlete reacted: ${record.cue.reaction})`
      : '';
    return record.summary + reactionStr;
  });

  const autoRegulationContext = formatAutoRegulation(autoRegulation);

  return {
    exerciseName: session.exercise.name,
    goal: session.plan.goal ?? 'general',
    currentSetIndex: session.completedSets.length,
    totalSets: session.plan.sets.length,
    completedSetsSummary,
    previousCueFeedback,
    autoRegulationContext,
    cueStyle,
  };
}

function formatAutoRegulation(
  autoReg: AutoRegulationState | null
): string | null {
  if (!autoReg) return null;

  const parts: string[] = [];

  if (autoReg.loadSuggestion) {
    const { direction, suggestedWeight, reason } = autoReg.loadSuggestion;
    parts.push(
      `Load suggestion: ${direction} to ${suggestedWeight}lbs (${reason})`
    );
  }

  if (autoReg.velocityWarning) {
    parts.push(
      `Velocity warning: ${autoReg.velocityWarning.message} (${autoReg.velocityWarning.velocityLossPercent}% loss)`
    );
  }

  if (autoReg.junkVolumeAlert) {
    parts.push(`Junk volume: ${autoReg.junkVolumeAlert.message}`);
  }

  return parts.length > 0 ? parts.join('. ') : null;
}

/**
 * Convert coaching context to a structured prompt string for Claude.
 */
export function toPrompt(context: CoachingContext): string {
  const lines: string[] = [
    `Exercise: ${context.exerciseName}`,
    `Goal: ${context.goal}`,
    `Progress: Set ${context.currentSetIndex} of ${context.totalSets} completed`,
    '',
  ];

  if (context.completedSetsSummary.length > 0) {
    lines.push('Completed sets:');
    context.completedSetsSummary.forEach((s) => lines.push(`  ${s}`));
    lines.push('');
  }

  if (context.previousCueFeedback.length > 0) {
    lines.push('Previous coaching feedback:');
    context.previousCueFeedback.forEach((f) => lines.push(`  ${f}`));
    lines.push('');
  }

  if (context.autoRegulationContext) {
    lines.push(`Auto-regulation: ${context.autoRegulationContext}`);
    lines.push('');
  }

  if (context.cueStyle === 'brief') {
    lines.push(
      'Respond with a 3-5 words directive coaching cue.',
      'If suggesting a weight change, specify the exact weight in lbs.'
    );
  } else {
    lines.push(
      'Based on this data, provide a brief, actionable coaching cue for the next set.',
      'If suggesting a weight change, specify the exact weight in lbs.',
      'Keep the message under 2 sentences.'
    );
  }

  return lines.join('\n');
}
