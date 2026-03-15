/**
 * Auto-Plan Service
 *
 * Combines workout suggestion and progression services to produce a one-tap
 * workout plan. Given session history and exercise catalog, it:
 *  1. Picks the best exercise via suggestNextExercise
 *  2. Looks up the last completed session for that exercise
 *  3. Builds a repeat-last-session plan via buildRepeatLastSessionPlan
 *
 * Returns a self-contained AutoPlan with exercise, plan, weight, and
 * human-readable summary (e.g. "Cable Row / 85 lbs / 4x8").
 */

import type { StoredExerciseSession } from '@/data/exercise-session';
import type { Exercise } from '@/domain/exercise/catalog';
import type { ExercisePlan } from '@/domain/workout/models/plan';
import {
  buildLastSessionBanner,
  buildRepeatLastSessionPlan,
} from '@/domain/history/services/progression-service';
import { suggestNextExercise } from '@/domain/history/services/workout-suggestion-service';

// =============================================================================
// Types
// =============================================================================

export interface AutoPlan {
  exercise: Exercise;
  plan: ExercisePlan;
  weight: number;
  summary: string;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate a one-tap workout plan from history.
 *
 * Returns null when there is no history, no catalog match, or the best
 * suggested exercise has never been completed.
 */
export function autoPlanWorkout(
  sessions: StoredExerciseSession[],
  catalog: Record<string, Exercise>,
): AutoPlan | null {
  const suggestions = suggestNextExercise(sessions, catalog, 1);
  if (suggestions.length === 0) return null;

  const top = suggestions[0];
  const exercise = catalog[top.exerciseId];
  if (!exercise) return null;

  const banner = buildLastSessionBanner(sessions, top.exerciseId);
  if (!banner) return null;

  const plan = buildRepeatLastSessionPlan(banner);
  const repsPerSet = banner.sets > 0 ? Math.round(banner.reps / banner.sets) : 0;
  const summary = `${exercise.name} / ${banner.weight} lbs / ${banner.sets}\u00d7${repsPerSet}`;

  return { exercise, plan, weight: banner.weight, summary };
}
