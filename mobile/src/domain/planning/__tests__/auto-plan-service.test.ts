/**
 * AutoPlanService Tests
 *
 * Tests for the one-tap auto-plan workout feature covering:
 *  - Happy path: plan built from history
 *  - No history returns null
 *  - No catalog match returns null
 *  - Summary format correctness
 *  - Exercise with no completed sessions returns null
 */

import { describe, it, expect } from 'vitest';
import { autoPlanWorkout, buildSuggestionPlan } from '../auto-plan-service';
import type { StoredExerciseSession } from '@/data/exercise-session';
import { generateStoredSession, generateStoredSet } from '@/__fixtures__/generators/session-generator';
import { EXERCISE_CATALOG } from '@/domain/exercise/catalog';

// =============================================================================
// Helpers
// =============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): number {
  return Date.now() - days * MS_PER_DAY;
}

function makeSession(
  exerciseId: string,
  daysAgoCount: number,
  opts: { setCount?: number; weight?: number; repsPerSet?: number } = {},
): StoredExerciseSession {
  const { setCount = 4, weight = 85, repsPerSet = 8 } = opts;
  const plan = {
    exerciseId,
    sets: Array.from({ length: setCount }, (_, i) => ({
      setNumber: i + 1,
      weight,
      targetReps: repsPerSet,
      rirTarget: 0,
      isWarmup: false,
      restSeconds: 90,
    })),
    defaultRestSeconds: 90,
    generatedAt: Date.now(),
    generatedBy: 'manual' as const,
  };

  return {
    ...generateStoredSession(),
    exerciseId,
    exerciseName: EXERCISE_CATALOG[exerciseId]?.name ?? exerciseId,
    status: 'completed',
    startTime: daysAgo(daysAgoCount),
    plan,
    completedSets: Array.from({ length: setCount }, () =>
      generateStoredSet({ weight, repCount: repsPerSet }),
    ),
  };
}

const SINGLE_CATALOG = {
  cable_row: EXERCISE_CATALOG.cable_row,
};

const MINI_CATALOG = {
  cable_row: EXERCISE_CATALOG.cable_row,
  cable_chest_press: EXERCISE_CATALOG.cable_chest_press,
};

// =============================================================================
// autoPlanWorkout
// =============================================================================

describe('autoPlanWorkout', () => {
  it('returns null with no sessions', () => {
    expect(autoPlanWorkout([], MINI_CATALOG)).toBeNull();
  });

  it('returns null with empty catalog', () => {
    const sessions = [makeSession('cable_row', 3)];
    expect(autoPlanWorkout(sessions, {})).toBeNull();
  });

  it('returns null when suggested exercise has no completed sessions', () => {
    const sessions = [
      { ...makeSession('cable_row', 3), status: 'abandoned' as const },
    ];
    expect(autoPlanWorkout(sessions, MINI_CATALOG)).toBeNull();
  });

  it('produces a valid auto-plan from history', () => {
    const sessions = [
      makeSession('cable_row', 3, { weight: 85, setCount: 4, repsPerSet: 8 }),
      makeSession('cable_chest_press', 1, { weight: 100, setCount: 3, repsPerSet: 10 }),
    ];

    const result = autoPlanWorkout(sessions, MINI_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.exercise.id).toBe('cable_row');
    expect(result!.weight).toBe(85);
    expect(result!.plan.sets).toHaveLength(4);
    expect(result!.plan.sets[0].weight).toBe(85);
    expect(result!.plan.sets[0].targetReps).toBe(8);
  });

  it('formats summary as "Name / weight lbs / sets x reps"', () => {
    const sessions = [
      makeSession('cable_row', 5, { weight: 85, setCount: 4, repsPerSet: 8 }),
    ];

    const result = autoPlanWorkout(sessions, SINGLE_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Seated Cable Row / 85 lbs / 4\u00d78');
  });

  it('picks the exercise with highest suggestion score', () => {
    const sessions = [
      makeSession('cable_row', 7, { weight: 85, setCount: 4, repsPerSet: 8 }),
      makeSession('cable_chest_press', 1, { weight: 100, setCount: 3, repsPerSet: 10 }),
    ];

    const result = autoPlanWorkout(sessions, MINI_CATALOG);

    expect(result).not.toBeNull();
    // cable_row done 7 days ago scores higher than cable_chest_press done 1 day ago
    expect(result!.exercise.id).toBe('cable_row');
  });

  it('sets plan generatedBy to manual', () => {
    const sessions = [makeSession('cable_row', 3)];
    const result = autoPlanWorkout(sessions, SINGLE_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.plan.generatedBy).toBe('manual');
  });
});

// =============================================================================
// buildSuggestionPlan
// =============================================================================

describe('buildSuggestionPlan', () => {
  it('returns null when exercise is not in catalog', () => {
    expect(buildSuggestionPlan([], 'nonexistent', SINGLE_CATALOG)).toBeNull();
  });

  it('returns defaults when no history exists', () => {
    const result = buildSuggestionPlan([], 'cable_row', SINGLE_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.weight).toBe(45);
    expect(result!.sets).toBe(3);
    expect(result!.repsPerSet).toBe(8);
    expect(result!.plan.sets).toHaveLength(3);
    expect(result!.plan.sets[0].weight).toBe(45);
    expect(result!.plan.sets[0].targetReps).toBe(8);
    expect(result!.exercise.id).toBe('cable_row');
  });

  it('pre-fills from last session when history exists', () => {
    const sessions = [
      makeSession('cable_row', 2, { weight: 95, setCount: 4, repsPerSet: 10 }),
    ];

    const result = buildSuggestionPlan(sessions, 'cable_row', SINGLE_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.weight).toBe(95);
    expect(result!.sets).toBe(4);
    expect(result!.repsPerSet).toBe(10);
    expect(result!.plan.sets).toHaveLength(4);
    expect(result!.plan.sets[0].weight).toBe(95);
    expect(result!.plan.sets[0].targetReps).toBe(10);
  });

  it('uses the most recent session when multiple exist', () => {
    const sessions = [
      makeSession('cable_row', 5, { weight: 75, setCount: 3, repsPerSet: 8 }),
      makeSession('cable_row', 1, { weight: 100, setCount: 5, repsPerSet: 6 }),
    ];

    const result = buildSuggestionPlan(sessions, 'cable_row', SINGLE_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.weight).toBe(100);
    expect(result!.sets).toBe(5);
    expect(result!.repsPerSet).toBe(6);
  });

  it('ignores abandoned sessions and falls back to defaults', () => {
    const sessions = [
      { ...makeSession('cable_row', 2), status: 'abandoned' as const },
    ];

    const result = buildSuggestionPlan(sessions, 'cable_row', SINGLE_CATALOG);

    expect(result).not.toBeNull();
    expect(result!.weight).toBe(45);
    expect(result!.sets).toBe(3);
  });
});
