/**
 * Plan Load Service
 *
 * Programmatic entry point for receiving a workout plan, validating it, and
 * loading it into persistent storage — independent of any UI or clipboard.
 *
 * This is the replacement for the clipboard-driven import that lived inside
 * the PlanLoader component: any producer of a structured plan (the coaching
 * channel, a future upload, a deep link) can call these functions to get a
 * validated, persisted WorkoutPlan back, with clean error results instead of
 * thrown exceptions or Alert dialogs.
 */

import { validateWorkoutPlan, type WorkoutPlan } from '@/domain/workout/models/workout-plan';
import { getWorkoutPlanRepository } from '@/data/provider';
import type { WorkoutPlanRepository } from '@/data/workout-plan';

/**
 * Result of parsing/loading a plan payload. Never throws for expected
 * failures (bad JSON, invalid shape) — callers branch on `ok`.
 */
export type PlanLoadResult = { ok: true; plan: WorkoutPlan } | { ok: false; error: string };

/**
 * Parse and validate a plan payload without persisting it.
 *
 * Accepts either an already-structured object (as the coaching channel would
 * deliver) or a raw JSON string (as the clipboard flow produced). Returns a
 * typed WorkoutPlan on success or a descriptive error on failure.
 */
export function parseWorkoutPlanPayload(payload: unknown): PlanLoadResult {
  const parsed = coerceToObject(payload);
  if (!parsed.ok) return parsed;

  const error = validateWorkoutPlan(parsed.value);
  if (error) return { ok: false, error };

  return { ok: true, plan: parsed.value as WorkoutPlan };
}

/**
 * Receive, validate, and persist a workout plan.
 *
 * On success the plan is saved via the repository and returned typed, ready to
 * hand to the exercise-session loader. The repository is injectable for tests.
 */
export async function loadWorkoutPlan(
  payload: unknown,
  repo: WorkoutPlanRepository = getWorkoutPlanRepository()
): Promise<PlanLoadResult> {
  const result = parseWorkoutPlanPayload(payload);
  if (!result.ok) return result;

  await repo.saveWorkoutPlan(result.plan);
  return result;
}

type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string };

function coerceToObject(payload: unknown): CoerceResult {
  if (typeof payload === 'string') {
    if (!payload.trim()) return { ok: false, error: 'Empty plan payload' };
    try {
      return { ok: true, value: JSON.parse(payload) };
    } catch {
      return { ok: false, error: 'Plan payload is not valid JSON' };
    }
  }

  if (payload && typeof payload === 'object') return { ok: true, value: payload };

  return { ok: false, error: 'Plan payload must be an object or JSON string' };
}
