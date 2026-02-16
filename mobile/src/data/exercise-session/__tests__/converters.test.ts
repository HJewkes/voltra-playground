/**
 * Exercise Session Converters Tests
 *
 * Tests for conversion between domain models and storage schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  toStoredExerciseSession,
  fromStoredExerciseSession,
  toStoredPlan,
  fromStoredPlan,
  toStoredSessionSet,
  fromStoredSessionSet,
  toExerciseSessionSummary,
} from '../exercise-session-converters';
import type { ExerciseSession } from '@/domain/workout/models/session';
import type { ExercisePlan, PlannedSet } from '@/domain/workout/models/plan';
import type { CompletedSet } from '@/domain/workout/models/completed-set';
import { TrainingGoal } from '@/domain/planning';
import { createTestExercise } from '@/__fixtures__/generators';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';
import {
  getSetMeanVelocity,
  getSetVelocityLossPct,
  estimateSetRIR,
} from '@voltras/workout-analytics';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestPlan(): ExercisePlan {
  const sets: PlannedSet[] = [
    { setNumber: 1, weight: 50, targetReps: 10, rirTarget: 5, isWarmup: true },
    { setNumber: 2, weight: 75, targetReps: 8, rirTarget: 3, isWarmup: false },
    { setNumber: 3, weight: 75, targetReps: 8, rirTarget: 2, isWarmup: false },
  ];

  return {
    exerciseId: 'cable_row',
    sets,
    defaultRestSeconds: 120,
    goal: TrainingGoal.HYPERTROPHY,
    generatedAt: 1000000,
    generatedBy: 'standard',
  };
}

function createTestSet(
  options: {
    weight?: number;
    repCount?: number;
  } = {}
): CompletedSet {
  const { weight = 75, repCount = 8 } = options;

  const velocities = Array.from({ length: repCount }, (_, i) =>
    Math.max(0.2, 0.55 - i * 0.02)
  );

  return mockCompletedSet({
    exerciseId: 'cable_row',
    exerciseName: 'Seated Cable Row',
    weight,
    velocities,
    startTime: Date.now() - 60000,
    endTime: Date.now(),
  });
}

function createTestSession(): ExerciseSession {
  return {
    id: 'session_test_12345',
    exercise: createTestExercise({
      id: 'cable_row',
      name: 'Seated Cable Row',
    }),
    plan: createTestPlan(),
    completedSets: [
      createTestSet({ weight: 50, repCount: 10 }),
      createTestSet({ weight: 75, repCount: 8 }),
    ],
    restEndsAt: null,
    startedAt: Date.now() - 600000,
  };
}

// =============================================================================
// toStoredExerciseSession() Tests
// =============================================================================

describe('toStoredExerciseSession()', () => {
  it('converts session to stored format', () => {
    const session = createTestSession();

    const stored = toStoredExerciseSession(session, 'completed');

    expect(stored.id).toBe(session.id);
    expect(stored.exerciseId).toBe(session.exercise.id);
    expect(stored.exerciseName).toBe(session.exercise.name);
    expect(stored.startTime).toBe(session.startedAt);
    expect(stored.status).toBe('completed');
  });

  it('preserves plan', () => {
    const session = createTestSession();

    const stored = toStoredExerciseSession(session, 'completed');

    expect(stored.plan.exerciseId).toBe(session.plan.exerciseId);
    expect(stored.plan.goal).toBe(session.plan.goal);
    expect(stored.plan.sets.length).toBe(session.plan.sets.length);
  });

  it('converts all completed sets', () => {
    const session = createTestSession();

    const stored = toStoredExerciseSession(session, 'completed');

    expect(stored.completedSets.length).toBe(session.completedSets.length);
    stored.completedSets.forEach((set, index) => {
      expect(set.weight).toBe(session.completedSets[index].weight);
      expect(set.reps.length).toBe(session.completedSets[index].data.reps.length);
    });
  });

  it('sets endTime to null for in_progress', () => {
    const session = createTestSession();

    const stored = toStoredExerciseSession(session, 'in_progress');

    expect(stored.endTime).toBeNull();
  });

  it('sets endTime for completed sessions', () => {
    const session = createTestSession();
    const before = Date.now();

    const stored = toStoredExerciseSession(session, 'completed');

    expect(stored.endTime).toBeGreaterThanOrEqual(before);
  });

  it('includes termination reason when provided', () => {
    const session = createTestSession();

    const stored = toStoredExerciseSession(session, 'completed', 'plan_exhausted');

    expect(stored.terminationReason).toBe('plan_exhausted');
  });
});

// =============================================================================
// fromStoredExerciseSession() Tests
// =============================================================================

describe('fromStoredExerciseSession()', () => {
  it('converts stored format back to domain', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const restored = fromStoredExerciseSession(stored);

    expect(restored.id).toBe(session.id);
    expect(restored.exercise.id).toBe(session.exercise.id);
    expect(restored.startedAt).toBe(session.startedAt);
  });

  it('restores plan correctly', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const restored = fromStoredExerciseSession(stored);

    expect(restored.plan.exerciseId).toBe(session.plan.exerciseId);
    expect(restored.plan.goal).toBe(session.plan.goal);
    expect(restored.plan.sets.length).toBe(session.plan.sets.length);
  });

  it('restores completed sets', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const restored = fromStoredExerciseSession(stored);

    expect(restored.completedSets.length).toBe(session.completedSets.length);
  });

  it('creates exercise from catalog when available', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const restored = fromStoredExerciseSession(stored);

    expect(restored.exercise.id).toBe('cable_row');
    expect(restored.exercise.muscleGroups.length).toBeGreaterThan(0);
  });

  it('restores restEndsAt as null', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const restored = fromStoredExerciseSession(stored);

    expect(restored.restEndsAt).toBeNull();
  });
});

// =============================================================================
// toStoredPlan() Tests
// =============================================================================

describe('toStoredPlan()', () => {
  it('preserves all plan fields', () => {
    const plan = createTestPlan();

    const stored = toStoredPlan(plan);

    expect(stored.exerciseId).toBe(plan.exerciseId);
    expect(stored.defaultRestSeconds).toBe(plan.defaultRestSeconds);
    expect(stored.goal).toBe(plan.goal);
    expect(stored.generatedAt).toBe(plan.generatedAt);
    expect(stored.generatedBy).toBe(plan.generatedBy);
  });

  it('preserves all planned sets', () => {
    const plan = createTestPlan();

    const stored = toStoredPlan(plan);

    expect(stored.sets.length).toBe(plan.sets.length);
    stored.sets.forEach((set, index) => {
      expect(set.weight).toBe(plan.sets[index].weight);
      expect(set.targetReps).toBe(plan.sets[index].targetReps);
      expect(set.isWarmup).toBe(plan.sets[index].isWarmup);
    });
  });
});

// =============================================================================
// fromStoredPlan() Tests
// =============================================================================

describe('fromStoredPlan()', () => {
  it('restores plan from stored format', () => {
    const plan = createTestPlan();
    const stored = toStoredPlan(plan);

    const restored = fromStoredPlan(stored);

    expect(restored.exerciseId).toBe(plan.exerciseId);
    expect(restored.goal).toBe(plan.goal);
    expect(restored.sets.length).toBe(plan.sets.length);
  });
});

// =============================================================================
// toStoredSessionSet() Tests
// =============================================================================

describe('toStoredSessionSet()', () => {
  it('converts set to stored format', () => {
    const set = createTestSet({ weight: 100, repCount: 8 });

    const stored = toStoredSessionSet(set, 0);

    expect(stored.setIndex).toBe(0);
    expect(stored.weight).toBe(100);
    expect(stored.reps.length).toBe(8);
  });

  it('extracts velocity metrics', () => {
    const set = createTestSet();

    const stored = toStoredSessionSet(set, 0);

    expect(stored.meanVelocity).toBe(getSetMeanVelocity(set.data));
    expect(stored.velocityLossPercent).toBe(Math.abs(getSetVelocityLossPct(set.data)));
  });

  it('extracts effort estimates', () => {
    const set = createTestSet();

    const stored = toStoredSessionSet(set, 0);

    const rirEstimate = estimateSetRIR(set.data);
    expect(stored.estimatedRPE).toBe(rirEstimate.rpe);
    expect(stored.estimatedRIR).toBe(rirEstimate.rir);
  });

  it('preserves timestamps', () => {
    const set = createTestSet();

    const stored = toStoredSessionSet(set, 0);

    expect(stored.startTime).toBe(set.timestamp.start);
    expect(stored.endTime).toBeDefined();
  });

  it('converts all reps to stored format', () => {
    const set = createTestSet({ repCount: 5 });

    const stored = toStoredSessionSet(set, 0);

    expect(stored.reps.length).toBe(5);
    stored.reps.forEach((rep, index) => {
      expect(rep.repNumber).toBe(index + 1);
      expect(rep.concentric).toBeDefined();
      expect(rep.eccentric).toBeDefined();
    });
  });
});

// =============================================================================
// fromStoredSessionSet() Tests
// =============================================================================

describe('fromStoredSessionSet()', () => {
  it('restores set from stored format', () => {
    const set = createTestSet({ weight: 100, repCount: 6 });
    const stored = toStoredSessionSet(set, 0);

    const restored = fromStoredSessionSet(stored);

    expect(restored.weight).toBe(100);
    expect(restored.data).toBeDefined();
    expect(restored.data.reps).toBeDefined();
  });

  it('restores CompletedSet structure', () => {
    const set = createTestSet();
    const stored = toStoredSessionSet(set, 0);

    const restored = fromStoredSessionSet(stored);

    expect(restored.weight).toBe(set.weight);
    expect(restored.data).toBeDefined();
    expect(restored.timestamp.start).toBe(stored.startTime);
  });
});

// =============================================================================
// toExerciseSessionSummary() Tests
// =============================================================================

describe('toExerciseSessionSummary()', () => {
  it('creates summary from stored session', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed', 'plan_exhausted');

    const summary = toExerciseSessionSummary(stored);

    expect(summary.id).toBe(stored.id);
    expect(summary.exerciseId).toBe(stored.exerciseId);
    expect(summary.exerciseName).toBe(stored.exerciseName);
  });

  it('calculates summary metrics', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const summary = toExerciseSessionSummary(stored);

    expect(summary.totalSets).toBe(stored.completedSets.length);
    expect(summary.totalReps).toBeGreaterThan(0);
  });

  it('includes discovery flag', () => {
    const session = createTestSession();
    const stored = toStoredExerciseSession(session, 'completed');

    const summary = toExerciseSessionSummary(stored);

    expect(summary.isDiscovery).toBe(session.plan.generatedBy === 'discovery');
  });
});

// =============================================================================
// Roundtrip Tests
// =============================================================================

describe('Roundtrip Preservation', () => {
  it('preserves session through roundtrip', () => {
    const original = createTestSession();
    const stored = toStoredExerciseSession(original, 'completed');
    const restored = fromStoredExerciseSession(stored);

    expect(restored.id).toBe(original.id);
    expect(restored.exercise.id).toBe(original.exercise.id);
    expect(restored.plan.exerciseId).toBe(original.plan.exerciseId);
    expect(restored.completedSets.length).toBe(original.completedSets.length);
  });

  it('preserves plan through roundtrip', () => {
    const original = createTestPlan();
    const stored = toStoredPlan(original);
    const restored = fromStoredPlan(stored);

    expect(restored.exerciseId).toBe(original.exerciseId);
    expect(restored.goal).toBe(original.goal);
    expect(restored.sets.length).toBe(original.sets.length);
    original.sets.forEach((set, index) => {
      expect(restored.sets[index].weight).toBe(set.weight);
      expect(restored.sets[index].targetReps).toBe(set.targetReps);
    });
  });

  it('preserves set data through roundtrip', () => {
    const original = createTestSet({ weight: 85, repCount: 7 });
    const stored = toStoredSessionSet(original, 0);
    const restored = fromStoredSessionSet(stored);

    expect(restored.weight).toBe(original.weight);
    expect(restored.data).toBeDefined();
    expect(restored.timestamp.start).toBe(original.timestamp.start);
  });
});
