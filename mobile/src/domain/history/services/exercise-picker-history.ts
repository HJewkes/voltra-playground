/**
 * Exercise Picker History Service
 *
 * Extracts summary data from stored sessions for display in the exercise picker.
 * Pure functions operating on StoredExerciseSession data.
 */

import type { StoredExerciseSession } from '@/data/exercise-session';

/**
 * Summary of past performance for a single exercise, shown in the picker.
 */
export interface ExercisePickerSummary {
  exerciseId: string;
  lastPerformedAt: number;
  workingWeight: number;
  bestMeanVelocity: number;
}

/**
 * Extract picker summary from the most recent completed session for an exercise.
 * Returns null if the session has no completed sets.
 */
export function extractPickerSummary(session: StoredExerciseSession): ExercisePickerSummary | null {
  const completedSets = session.completedSets;
  if (completedSets.length === 0) return null;

  const workingSets = completedSets.filter((_, i) => !session.plan.sets[i]?.isWarmup);
  const setsForAnalysis = workingSets.length > 0 ? workingSets : completedSets;

  const workingWeight = setsForAnalysis.reduce((max, s) => Math.max(max, s.weight), 0);

  const bestMeanVelocity = setsForAnalysis.reduce((max, s) => Math.max(max, s.meanVelocity), 0);

  return {
    exerciseId: session.exerciseId,
    lastPerformedAt: session.startTime,
    workingWeight,
    bestMeanVelocity,
  };
}

/**
 * Build a map of exercise ID to picker summary from a list of sessions.
 * Uses only the most recent completed session per exercise.
 */
export function buildPickerSummaryMap(
  sessions: StoredExerciseSession[]
): Map<string, ExercisePickerSummary> {
  const map = new Map<string, ExercisePickerSummary>();

  const sorted = [...sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.startTime - a.startTime);

  for (const session of sorted) {
    if (map.has(session.exerciseId)) continue;

    const summary = extractPickerSummary(session);
    if (summary) {
      map.set(session.exerciseId, summary);
    }
  }

  return map;
}

/**
 * Format a timestamp as a relative time string (e.g., "3 days ago").
 */
export function formatTimeAgo(timestamp: number, now: number = Date.now()): string {
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}
