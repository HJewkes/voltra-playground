/**
 * Clipboard Import Tests
 *
 * Tests the full clipboard import flow:
 * - Valid plan JSON parsing and exercise resolution
 * - Multi-exercise plans with auto-advance
 * - Invalid JSON and malformed data handling
 * - Empty clipboard handling
 * - Unknown exercises graceful degradation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  parseWorkoutPlanJson,
  looksLikeWorkoutPlan,
  type WorkoutPlanJson,
} from '../clipboard-import';
import { TrainingGoal } from '@/domain/planning/types';
import {
  createExerciseSession,
  getSessionCurrentSetIndex,
  addCompletedSet,
  isSessionComplete,
} from '@/domain/workout/models/session';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';

// =============================================================================
// Test Data Factories
// =============================================================================

function validPlanJson(overrides?: Partial<WorkoutPlanJson>): string {
  const plan: WorkoutPlanJson = {
    exercises: [
      {
        exerciseId: 'cable_row',
        sets: [
          { weight: 100, targetReps: 10, rirTarget: 2, isWarmup: false },
          { weight: 100, targetReps: 10, rirTarget: 2, isWarmup: false },
          { weight: 100, targetReps: 10, rirTarget: 2, isWarmup: false },
        ],
        restSeconds: 120,
        goal: 'hypertrophy',
      },
    ],
    ...overrides,
  };
  return JSON.stringify(plan);
}

function multiExercisePlanJson(): string {
  const plan: WorkoutPlanJson = {
    exercises: [
      {
        exerciseId: 'cable_row',
        sets: [
          { weight: 50, targetReps: 10, isWarmup: true },
          { weight: 100, targetReps: 8, rirTarget: 2 },
          { weight: 100, targetReps: 8, rirTarget: 2 },
          { weight: 100, targetReps: 8, rirTarget: 2 },
        ],
        restSeconds: 120,
        goal: 'hypertrophy',
      },
      {
        exerciseId: 'cable_curl',
        sets: [
          { weight: 30, targetReps: 12 },
          { weight: 30, targetReps: 12 },
          { weight: 30, targetReps: 12 },
        ],
        restSeconds: 90,
        goal: 'hypertrophy',
      },
      {
        exerciseId: 'cable_tricep_pushdown',
        sets: [
          { weight: 40, targetReps: 10, rirTarget: 1 },
          { weight: 40, targetReps: 10, rirTarget: 1 },
        ],
        restSeconds: 90,
        goal: 'strength',
      },
    ],
  };
  return JSON.stringify(plan);
}

// =============================================================================
// Valid Plan JSON → Exercises Load
// =============================================================================

describe('parseWorkoutPlanJson', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(1000));
  });

  describe('valid single-exercise plan', () => {
    it('parses exercises and resolves from catalog', () => {
      const result = parseWorkoutPlanJson(validPlanJson());

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].exercise.id).toBe('cable_row');
      expect(result.exercises[0].exercise.name).toBe('Seated Cable Row');
    });

    it('converts sets with correct structure', () => {
      const result = parseWorkoutPlanJson(validPlanJson());
      if (!result.success) return;

      const plan = result.exercises[0].plan;
      expect(plan.sets).toHaveLength(3);
      expect(plan.sets[0]).toEqual({
        setNumber: 1,
        weight: 100,
        targetReps: 10,
        rirTarget: 2,
        isWarmup: false,
      });
    });

    it('preserves rest seconds from JSON', () => {
      const result = parseWorkoutPlanJson(validPlanJson());
      if (!result.success) return;

      expect(result.exercises[0].plan.defaultRestSeconds).toBe(120);
    });

    it('resolves training goal from string', () => {
      const result = parseWorkoutPlanJson(validPlanJson());
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.HYPERTROPHY);
    });

    it('sets generatedBy to manual for imported plans', () => {
      const result = parseWorkoutPlanJson(validPlanJson());
      if (!result.success) return;

      expect(result.exercises[0].plan.generatedBy).toBe('manual');
    });

    it('defaults rest to 90 seconds when not specified', () => {
      const json = JSON.stringify({
        exercises: [
          {
            exerciseId: 'cable_row',
            sets: [{ weight: 100, targetReps: 8 }],
          },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.defaultRestSeconds).toBe(90);
    });

    it('defaults rirTarget to 2 when not specified', () => {
      const json = JSON.stringify({
        exercises: [
          {
            exerciseId: 'cable_row',
            sets: [{ weight: 100, targetReps: 8 }],
          },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.sets[0].rirTarget).toBe(2);
    });

    it('defaults isWarmup to false when not specified', () => {
      const json = JSON.stringify({
        exercises: [
          {
            exerciseId: 'cable_row',
            sets: [{ weight: 100, targetReps: 8 }],
          },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.sets[0].isWarmup).toBe(false);
    });

    it('defaults goal to hypertrophy when not specified', () => {
      const json = JSON.stringify({
        exercises: [
          {
            exerciseId: 'cable_row',
            sets: [{ weight: 100, targetReps: 8 }],
          },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.HYPERTROPHY);
    });
  });

  // ===========================================================================
  // Multi-exercise plan → auto-advance
  // ===========================================================================

  describe('multi-exercise plan with auto-advance', () => {
    it('parses all exercises in order', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.exercises).toHaveLength(3);
      expect(result.exercises[0].exercise.id).toBe('cable_row');
      expect(result.exercises[1].exercise.id).toBe('cable_curl');
      expect(result.exercises[2].exercise.id).toBe('cable_tricep_pushdown');
    });

    it('maintains independent plans per exercise', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      expect(result.exercises[0].plan.sets).toHaveLength(4);
      expect(result.exercises[1].plan.sets).toHaveLength(3);
      expect(result.exercises[2].plan.sets).toHaveLength(2);
    });

    it('preserves per-exercise rest seconds', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      expect(result.exercises[0].plan.defaultRestSeconds).toBe(120);
      expect(result.exercises[1].plan.defaultRestSeconds).toBe(90);
      expect(result.exercises[2].plan.defaultRestSeconds).toBe(90);
    });

    it('preserves per-exercise goals', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.HYPERTROPHY);
      expect(result.exercises[1].plan.goal).toBe(TrainingGoal.HYPERTROPHY);
      expect(result.exercises[2].plan.goal).toBe(TrainingGoal.STRENGTH);
    });

    it('preserves warmup flags on individual sets', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      const rowSets = result.exercises[0].plan.sets;
      expect(rowSets[0].isWarmup).toBe(true);
      expect(rowSets[1].isWarmup).toBe(false);
    });

    it('assigns sequential set numbers within each exercise', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      for (const imported of result.exercises) {
        imported.plan.sets.forEach((set, i) => {
          expect(set.setNumber).toBe(i + 1);
        });
      }
    });

    it('can drive sequential sessions via exercise queue', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      const queue = [...result.exercises];
      expect(queue.length).toBe(3);

      const first = queue.shift()!;
      expect(first.exercise.id).toBe('cable_row');
      expect(queue.length).toBe(2);

      const second = queue.shift()!;
      expect(second.exercise.id).toBe('cable_curl');
      expect(queue.length).toBe(1);

      const third = queue.shift()!;
      expect(third.exercise.id).toBe('cable_tricep_pushdown');
      expect(queue.length).toBe(0);
    });
  });

  // ===========================================================================
  // Goal resolution
  // ===========================================================================

  describe('goal resolution', () => {
    it('resolves strength goal', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 5 }], goal: 'strength' },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.STRENGTH);
    });

    it('resolves endurance goal', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 50, targetReps: 20 }], goal: 'endurance' },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.ENDURANCE);
    });

    it('resolves case-insensitively', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 5 }], goal: 'STRENGTH' },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.STRENGTH);
    });

    it('defaults unknown goal to hypertrophy', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 8 }], goal: 'power' },
        ],
      });

      const result = parseWorkoutPlanJson(json);
      if (!result.success) return;

      expect(result.exercises[0].plan.goal).toBe(TrainingGoal.HYPERTROPHY);
    });
  });

  // ===========================================================================
  // Invalid JSON → graceful error
  // ===========================================================================

  describe('invalid JSON handling', () => {
    it('rejects non-JSON text', () => {
      const result = parseWorkoutPlanJson('not json at all');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Invalid JSON format');
    });

    it('rejects truncated JSON', () => {
      const result = parseWorkoutPlanJson('{"exercises": [{"exerciseId":');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Invalid JSON format');
    });

    it('rejects JSON array (not object)', () => {
      const result = parseWorkoutPlanJson('[1, 2, 3]');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Plan must be a JSON object');
    });

    it('rejects JSON without exercises array', () => {
      const result = parseWorkoutPlanJson('{"name": "my plan"}');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Plan must contain a non-empty "exercises" array');
    });

    it('rejects empty exercises array', () => {
      const result = parseWorkoutPlanJson('{"exercises": []}');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Plan must contain a non-empty "exercises" array');
    });

    it('rejects exercise without exerciseId', () => {
      const json = JSON.stringify({
        exercises: [{ sets: [{ weight: 100, targetReps: 8 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('exerciseId must be a non-empty string');
    });

    it('rejects exercise with empty exerciseId', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: '', sets: [{ weight: 100, targetReps: 8 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('exerciseId must be a non-empty string');
    });

    it('rejects exercise without sets', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row' }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('sets must be a non-empty array');
    });

    it('rejects exercise with empty sets array', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row', sets: [] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('sets must be a non-empty array');
    });

    it('rejects set with missing weight', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row', sets: [{ targetReps: 8 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('weight must be a positive number');
    });

    it('rejects set with zero weight', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row', sets: [{ weight: 0, targetReps: 8 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('weight must be a positive number');
    });

    it('rejects set with negative weight', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row', sets: [{ weight: -10, targetReps: 8 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('weight must be a positive number');
    });

    it('rejects set with missing targetReps', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row', sets: [{ weight: 100 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('targetReps must be a positive integer');
    });

    it('rejects set with non-integer targetReps', () => {
      const json = JSON.stringify({
        exercises: [{ exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 8.5 }] }],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('targetReps must be a positive integer');
    });

    it('rejects set with negative rirTarget', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 8, rirTarget: -1 }] },
        ],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('rirTarget must be a non-negative number');
    });

    it('rejects set with non-boolean isWarmup', () => {
      const json = JSON.stringify({
        exercises: [
          {
            exerciseId: 'cable_row',
            sets: [{ weight: 100, targetReps: 8, isWarmup: 'yes' }],
          },
        ],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('isWarmup must be a boolean');
    });

    it('rejects negative restSeconds', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 8 }], restSeconds: -10 },
        ],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('restSeconds must be a non-negative number');
    });
  });

  // ===========================================================================
  // Empty clipboard → appropriate feedback
  // ===========================================================================

  describe('empty clipboard handling', () => {
    it('rejects empty string', () => {
      const result = parseWorkoutPlanJson('');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Clipboard is empty');
    });

    it('rejects whitespace-only string', () => {
      const result = parseWorkoutPlanJson('   \n\t  ');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe('Clipboard is empty');
    });
  });

  // ===========================================================================
  // Unknown exercises → graceful handling
  // ===========================================================================

  describe('unknown exercise handling', () => {
    it('skips unknown exercises and imports known ones', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'cable_row', sets: [{ weight: 100, targetReps: 8 }] },
          { exerciseId: 'barbell_squat', sets: [{ weight: 200, targetReps: 5 }] },
          { exerciseId: 'cable_curl', sets: [{ weight: 30, targetReps: 12 }] },
        ],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.exercises).toHaveLength(2);
      expect(result.exercises[0].exercise.id).toBe('cable_row');
      expect(result.exercises[1].exercise.id).toBe('cable_curl');
    });

    it('fails when all exercises are unknown', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'barbell_squat', sets: [{ weight: 200, targetReps: 5 }] },
          { exerciseId: 'dumbbell_press', sets: [{ weight: 80, targetReps: 10 }] },
        ],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('No recognized exercises');
      expect(result.error).toContain('barbell_squat');
      expect(result.error).toContain('dumbbell_press');
    });

    it('lists all unknown exercise IDs in error', () => {
      const json = JSON.stringify({
        exercises: [
          { exerciseId: 'foo', sets: [{ weight: 10, targetReps: 1 }] },
          { exerciseId: 'bar', sets: [{ weight: 10, targetReps: 1 }] },
          { exerciseId: 'baz', sets: [{ weight: 10, targetReps: 1 }] },
        ],
      });

      const result = parseWorkoutPlanJson(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('foo');
      expect(result.error).toContain('bar');
      expect(result.error).toContain('baz');
    });
  });

  // ===========================================================================
  // Integration with ExercisePlan and session store
  // ===========================================================================

  describe('integration with session store', () => {
    it('produces plans compatible with createExerciseSession', () => {
      const result = parseWorkoutPlanJson(validPlanJson());
      if (!result.success) return;

      const { exercise, plan } = result.exercises[0];
      const session = createExerciseSession(exercise, plan);

      expect(session.exercise.id).toBe('cable_row');
      expect(session.plan.sets).toHaveLength(3);
      expect(session.completedSets).toHaveLength(0);
    });

    it('produces plans where set completion advances to next set', () => {
      const result = parseWorkoutPlanJson(validPlanJson());
      if (!result.success) return;

      const { exercise, plan } = result.exercises[0];
      let session = createExerciseSession(exercise, plan);

      expect(getSessionCurrentSetIndex(session)).toBe(0);

      const set1 = mockCompletedSet({ exerciseId: exercise.id, weight: 100 });
      session = addCompletedSet(session, set1);
      expect(getSessionCurrentSetIndex(session)).toBe(1);

      const set2 = mockCompletedSet({ exerciseId: exercise.id, weight: 100 });
      session = addCompletedSet(session, set2);
      expect(getSessionCurrentSetIndex(session)).toBe(2);

      const set3 = mockCompletedSet({ exerciseId: exercise.id, weight: 100 });
      session = addCompletedSet(session, set3);
      expect(isSessionComplete(session)).toBe(true);
    });

    it('multi-exercise plan drives sequential sessions to completion', () => {
      const result = parseWorkoutPlanJson(multiExercisePlanJson());
      if (!result.success) return;

      const queue = [...result.exercises];
      const completedExercises: string[] = [];

      while (queue.length > 0) {
        const { exercise, plan } = queue.shift()!;
        let session = createExerciseSession(exercise, plan);

        for (let i = 0; i < plan.sets.length; i++) {
          const set = mockCompletedSet({ exerciseId: exercise.id, weight: plan.sets[i].weight });
          session = addCompletedSet(session, set);
        }

        expect(isSessionComplete(session)).toBe(true);
        completedExercises.push(exercise.id);
      }

      expect(completedExercises).toEqual([
        'cable_row',
        'cable_curl',
        'cable_tricep_pushdown',
      ]);
    });
  });
});

// =============================================================================
// looksLikeWorkoutPlan
// =============================================================================

describe('looksLikeWorkoutPlan', () => {
  it('returns true for valid plan JSON', () => {
    expect(looksLikeWorkoutPlan('{"exercises": []}')).toBe(true);
  });

  it('returns true with leading whitespace', () => {
    expect(looksLikeWorkoutPlan('  {"exercises": []}')).toBe(true);
  });

  it('returns false for non-JSON text', () => {
    expect(looksLikeWorkoutPlan('hello world')).toBe(false);
  });

  it('returns false for JSON without exercises key', () => {
    expect(looksLikeWorkoutPlan('{"name": "plan"}')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(looksLikeWorkoutPlan('')).toBe(false);
  });
});
