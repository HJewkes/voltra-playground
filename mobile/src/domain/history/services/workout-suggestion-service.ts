/**
 * Workout Suggestion Service
 *
 * Recommends exercises based on training history using three signals:
 *  - Recency: exercises not done recently score higher
 *  - Muscle group balance: underrepresented groups get a bonus; overrepresented get a penalty
 *  - Catalog coverage: exercises never attempted score as if done 7+ days ago
 *
 * Score = (daysSinceLast × 2) + muscleGroupBonus - muscleGroupPenalty
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import type { Exercise } from '@/domain/exercise/catalog';
import { EXERCISE_MUSCLE_GROUPS } from '@/domain/exercise/mappings';
import type { MuscleGroup } from '@/domain/exercise/types';

// =============================================================================
// Types
// =============================================================================

/** A single exercise suggestion with a human-readable reason. */
export interface ExerciseSuggestion {
  exerciseId: string;
  exerciseName: string;
  score: number;
  reason: string;
}

// =============================================================================
// Scoring helpers
// =============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Build a map of exerciseId → timestamp of last completed session.
 */
function buildLastSessionMap(sessions: StoredExerciseSession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const existing = map.get(s.exerciseId);
    if (existing === undefined || s.startTime > existing) {
      map.set(s.exerciseId, s.startTime);
    }
  }
  return map;
}

/**
 * Compute total set counts per muscle group from completed sessions in the
 * last 7 days to determine balance.
 */
function buildWeeklyMuscleSetCounts(
  sessions: StoredExerciseSession[],
  now: number,
): Map<MuscleGroup, number> {
  const cutoff = now - 7 * MS_PER_DAY;
  const map = new Map<MuscleGroup, number>();

  for (const s of sessions) {
    if (s.status !== 'completed' || s.startTime < cutoff) continue;
    const mg = EXERCISE_MUSCLE_GROUPS[s.exerciseId];
    if (!mg) continue;
    map.set(mg, (map.get(mg) ?? 0) + s.completedSets.length);
  }
  return map;
}

/**
 * Derive the muscle group bonus/penalty for a given exercise.
 * Exercises targeting underrepresented muscle groups score +5; overrepresented score -3.
 */
function muscleGroupAdjustment(
  exerciseId: string,
  weeklyCounts: Map<MuscleGroup, number>,
): number {
  const mg = EXERCISE_MUSCLE_GROUPS[exerciseId];
  if (!mg) return 0;

  const values = Array.from(weeklyCounts.values());
  if (values.length === 0) return 0;

  const totalSets = values.reduce((a, b) => a + b, 0);
  const avgSets = totalSets / weeklyCounts.size;
  const count = weeklyCounts.get(mg) ?? 0;

  if (count < avgSets * 0.6) return 5;
  if (count > avgSets * 1.5) return -3;
  return 0;
}

/**
 * Build a human-readable reason string for a suggestion.
 */
function buildReason(
  daysSinceLast: number,
  muscleAdj: number,
  exerciseId: string,
  weeklyCounts: Map<MuscleGroup, number>,
): string {
  const mg = EXERCISE_MUSCLE_GROUPS[exerciseId];

  if (daysSinceLast >= 7) {
    return `Not done in ${Math.round(daysSinceLast)} day${Math.round(daysSinceLast) === 1 ? '' : 's'}`;
  }

  if (muscleAdj > 0 && mg) {
    const count = weeklyCounts.get(mg) ?? 0;
    return `${capitalise(mg)} volume is low this week (${count} set${count === 1 ? '' : 's'})`;
  }

  if (daysSinceLast >= 3) {
    return `Not done in ${Math.round(daysSinceLast)} day${Math.round(daysSinceLast) === 1 ? '' : 's'}`;
  }

  return 'Good time to revisit';
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Suggest the top N exercises to do next based on training history and a
 * catalog of available exercises.
 *
 * @param sessions  All stored exercise sessions (any status).
 * @param catalog   Available exercises keyed by exercise ID.
 * @param topN      Number of suggestions to return (default 3).
 * @param now       Current timestamp (injectable for testing; defaults to Date.now()).
 */
export function suggestNextExercise(
  sessions: StoredExerciseSession[],
  catalog: Record<string, Exercise>,
  topN: number = 3,
  now: number = Date.now(),
): ExerciseSuggestion[] {
  const lastSessionMap = buildLastSessionMap(sessions);
  const weeklyCounts = buildWeeklyMuscleSetCounts(sessions, now);

  const suggestions: ExerciseSuggestion[] = Object.values(catalog)
    .filter((ex) => ex.id !== 'general') // skip the placeholder exercise
    .map((ex) => {
      const lastTs = lastSessionMap.get(ex.id);
      const daysSinceLast = lastTs !== undefined ? (now - lastTs) / MS_PER_DAY : 14;
      const muscleAdj = muscleGroupAdjustment(ex.id, weeklyCounts);
      const score = daysSinceLast * 2 + muscleAdj;
      const reason = buildReason(daysSinceLast, muscleAdj, ex.id, weeklyCounts);

      return {
        exerciseId: ex.id,
        exerciseName: ex.name,
        score,
        reason,
      };
    });

  return suggestions.sort((a, b) => b.score - a.score).slice(0, topN);
}
