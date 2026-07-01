/**
 * Plan Load Service Tests
 *
 * Covers the programmatic receive + validate + load path that replaces the
 * clipboard import: valid plans (object and JSON string) load and persist,
 * malformed/invalid payloads are rejected cleanly without throwing.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseWorkoutPlanPayload,
  loadWorkoutPlan,
} from '../plan-load-service';
import type { WorkoutPlan } from '@/domain/workout/models/workout-plan';
import type { WorkoutPlanRepository } from '@/data/workout-plan';

function validPlan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: 'plan-1',
    name: 'Push Day',
    date: '2026-07-01',
    coach: 'Claude',
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        cues: ['Drive through the floor'],
        sets: [
          { weight: 135, reps: 5, type: 'working', rirTarget: 2 },
          { weight: null, reps: 8, type: 'backoff' },
        ],
      },
    ],
    ...overrides,
  };
}

function fakeRepo(): WorkoutPlanRepository & { saveWorkoutPlan: ReturnType<typeof vi.fn> } {
  return {
    saveWorkoutPlan: vi.fn(async () => {}),
    getWorkoutPlan: vi.fn(async () => null),
    getTodaysPlan: vi.fn(async () => null),
    getAllPlans: vi.fn(async () => []),
    deletePlan: vi.fn(async () => {}),
  };
}

describe('parseWorkoutPlanPayload', () => {
  it('accepts a valid structured plan object', () => {
    const result = parseWorkoutPlanPayload(validPlan());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.name).toBe('Push Day');
  });

  it('accepts a valid plan delivered as a JSON string', () => {
    const result = parseWorkoutPlanPayload(JSON.stringify(validPlan()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.exercises).toHaveLength(1);
  });

  it('rejects a malformed JSON string without throwing', () => {
    const result = parseWorkoutPlanPayload('{ not json ]');
    expect(result).toEqual({ ok: false, error: 'Plan payload is not valid JSON' });
  });

  it('rejects an empty string payload', () => {
    expect(parseWorkoutPlanPayload('   ')).toEqual({
      ok: false,
      error: 'Empty plan payload',
    });
  });

  it('rejects non-object, non-string payloads', () => {
    expect(parseWorkoutPlanPayload(42)).toEqual({
      ok: false,
      error: 'Plan payload must be an object or JSON string',
    });
    expect(parseWorkoutPlanPayload(null)).toEqual({
      ok: false,
      error: 'Plan payload must be an object or JSON string',
    });
  });

  it('surfaces the validator error for a structurally invalid plan', () => {
    const result = parseWorkoutPlanPayload(validPlan({ exercises: [] }));
    expect(result).toEqual({ ok: false, error: 'Missing or empty "exercises" array' });
  });

  it('rejects a plan whose set has an invalid type', () => {
    const bad = validPlan();
    // @ts-expect-error deliberately invalid set type for the test
    bad.exercises[0].sets[0].type = 'bogus';
    const result = parseWorkoutPlanPayload(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('"type" must be one of');
  });
});

describe('loadWorkoutPlan', () => {
  it('persists a valid plan and returns it typed', async () => {
    const repo = fakeRepo();
    const result = await loadWorkoutPlan(validPlan(), repo);

    expect(result.ok).toBe(true);
    expect(repo.saveWorkoutPlan).toHaveBeenCalledTimes(1);
    expect(repo.saveWorkoutPlan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plan-1', name: 'Push Day' }),
    );
  });

  it('does not persist when the payload is invalid', async () => {
    const repo = fakeRepo();
    const result = await loadWorkoutPlan('{ broken', repo);

    expect(result).toEqual({ ok: false, error: 'Plan payload is not valid JSON' });
    expect(repo.saveWorkoutPlan).not.toHaveBeenCalled();
  });
});
