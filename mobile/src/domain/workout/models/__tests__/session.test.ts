/**
 * Session Model Tests
 *
 * Tests for ExerciseSession factory and helper functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  planBuilder,
  createTestExercise,
} from '@/__fixtures__/generators';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';
import {
  createExerciseSession,
  getSessionCurrentSetIndex,
  getCurrentPlannedSet,
  isResting,
  getRemainingRestSeconds,
  isSessionComplete,
  isDiscoverySession,
  getCompletedVolume,
  getTotalReps,
  addCompletedSet,
  startRest,
  clearRest,
  compareSetAtIndex,
  getAllSetComparisons,
} from '../session';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockSet(
  options: {
    weight?: number;
    repCount?: number;
  } = {}
) {
  const { weight = 100, repCount = 8 } = options;
  return mockCompletedSet({ weight, repCount });
}

// =============================================================================
// createExerciseSession() Tests
// =============================================================================

describe('createExerciseSession()', () => {
  it('creates session with exercise and plan', () => {
    const exercise = createTestExercise('test_exercise');
    const plan = planBuilder().workingSets(3).build();

    const session = createExerciseSession(exercise, plan);

    expect(session.exercise).toBe(exercise);
    expect(session.plan).toBe(plan);
    expect(session.completedSets).toEqual([]);
    expect(session.restEndsAt).toBeNull();
  });

  it('generates unique session id', () => {
    const exercise = createTestExercise('test_exercise');
    const plan = planBuilder().workingSets(3).build();

    const session1 = createExerciseSession(exercise, plan);
    const session2 = createExerciseSession(exercise, plan);

    expect(session1.id).not.toBe(session2.id);
  });

  it('sets startedAt to current time', () => {
    const before = Date.now();
    const session = createExerciseSession(
      createTestExercise('test_exercise'),
      planBuilder().workingSets(3).build()
    );
    const after = Date.now();

    expect(session.startedAt).toBeGreaterThanOrEqual(before);
    expect(session.startedAt).toBeLessThanOrEqual(after);
  });
});

// =============================================================================
// Derived State Helpers Tests
// =============================================================================

describe('Derived State Helpers', () => {
  describe('getSessionCurrentSetIndex()', () => {
    it('returns 0 when no sets completed', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      expect(getSessionCurrentSetIndex(session)).toBe(0);
    });

    it('returns count of completed sets', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.completedSets = [createMockSet(), createMockSet()];

      expect(getSessionCurrentSetIndex(session)).toBe(2);
    });
  });

  describe('getCurrentPlannedSet()', () => {
    it('returns first planned set when none completed', () => {
      const plan = planBuilder().workingSets(3).build();
      const session = createExerciseSession(createTestExercise('test_exercise'), plan);

      const plannedSet = getCurrentPlannedSet(session);

      expect(plannedSet).toBe(plan.sets[0]);
    });

    it('returns next planned set', () => {
      const plan = planBuilder().workingSets(3).build();
      const session = createExerciseSession(createTestExercise('test_exercise'), plan);
      session.completedSets = [createMockSet()];

      const plannedSet = getCurrentPlannedSet(session);

      expect(plannedSet).toBe(plan.sets[1]);
    });

    it('returns undefined when all sets completed', () => {
      const plan = planBuilder().workingSets(2).build();
      const session = createExerciseSession(createTestExercise('test_exercise'), plan);
      session.completedSets = [createMockSet(), createMockSet()];

      const plannedSet = getCurrentPlannedSet(session);

      expect(plannedSet).toBeUndefined();
    });
  });

  describe('isSessionComplete()', () => {
    it('returns false when sets remain', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.completedSets = [createMockSet()];

      expect(isSessionComplete(session)).toBe(false);
    });

    it('returns true when all sets completed', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(2).build()
      );
      session.completedSets = [createMockSet(), createMockSet()];

      expect(isSessionComplete(session)).toBe(true);
    });
  });

  describe('isDiscoverySession()', () => {
    it('returns false for standard session', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      expect(isDiscoverySession(session)).toBe(false);
    });

    it('returns true for discovery session', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).discovery().build()
      );

      expect(isDiscoverySession(session)).toBe(true);
    });
  });

  describe('getCompletedVolume()', () => {
    it('returns 0 when no sets completed', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      expect(getCompletedVolume(session)).toBe(0);
    });

    it('calculates volume correctly', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.completedSets = [
        createMockSet({ weight: 100, repCount: 8 }), // 800
        createMockSet({ weight: 100, repCount: 7 }), // 700
      ];

      expect(getCompletedVolume(session)).toBe(1500);
    });
  });

  describe('getTotalReps()', () => {
    it('returns 0 when no sets completed', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      expect(getTotalReps(session)).toBe(0);
    });

    it('sums reps correctly', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.completedSets = [
        createMockSet({ repCount: 8 }),
        createMockSet({ repCount: 7 }),
        createMockSet({ repCount: 6 }),
      ];

      expect(getTotalReps(session)).toBe(21);
    });
  });
});

// =============================================================================
// Rest Functions Tests
// =============================================================================

describe('Rest Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isResting()', () => {
    it('returns false when restEndsAt is null', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = null;

      expect(isResting(session)).toBe(false);
    });

    it('returns true when rest period active', () => {
      vi.setSystemTime(new Date(1000000));
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = 1000000 + 60000; // 60 seconds from now

      expect(isResting(session)).toBe(true);
    });

    it('returns false when rest period expired', () => {
      vi.setSystemTime(new Date(1000000));
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = 1000000 - 1000; // 1 second ago

      expect(isResting(session)).toBe(false);
    });
  });

  describe('getRemainingRestSeconds()', () => {
    it('returns 0 when not resting', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = null;

      expect(getRemainingRestSeconds(session)).toBe(0);
    });

    it('returns remaining seconds', () => {
      vi.setSystemTime(new Date(1000000));
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = 1000000 + 45000; // 45 seconds remaining

      expect(getRemainingRestSeconds(session)).toBe(45);
    });

    it('returns 0 when rest expired', () => {
      vi.setSystemTime(new Date(1000000));
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = 1000000 - 5000; // 5 seconds ago

      expect(getRemainingRestSeconds(session)).toBe(0);
    });
  });

  describe('startRest()', () => {
    it('sets restEndsAt based on duration', () => {
      vi.setSystemTime(new Date(1000000));
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      const newSession = startRest(session, 120);

      expect(newSession.restEndsAt).toBe(1000000 + 120000);
    });

    it('returns new session (immutable)', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      const newSession = startRest(session, 120);

      expect(newSession).not.toBe(session);
      expect(session.restEndsAt).toBeNull();
    });
  });

  describe('clearRest()', () => {
    it('clears restEndsAt', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.restEndsAt = Date.now() + 60000;

      const newSession = clearRest(session);

      expect(newSession.restEndsAt).toBeNull();
    });
  });
});

// =============================================================================
// Mutation Functions Tests
// =============================================================================

describe('Session Mutations', () => {
  describe('addCompletedSet()', () => {
    it('adds set to completedSets', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      const set = createMockSet();

      const newSession = addCompletedSet(session, set);

      expect(newSession.completedSets.length).toBe(1);
      expect(newSession.completedSets[0]).toBe(set);
    });

    it('returns new session (immutable)', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      const set = createMockSet();

      const newSession = addCompletedSet(session, set);

      expect(newSession).not.toBe(session);
      expect(session.completedSets.length).toBe(0);
    });

    it('preserves existing sets', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );
      session.completedSets = [createMockSet()];
      const newSet = createMockSet();

      const newSession = addCompletedSet(session, newSet);

      expect(newSession.completedSets.length).toBe(2);
    });
  });
});

// =============================================================================
// Comparison Helpers Tests
// =============================================================================

describe('Comparison Helpers', () => {
  describe('compareSetAtIndex()', () => {
    it('returns comparison for matching indices', () => {
      const plan = planBuilder().workingSets(3).workingWeight(100).targetReps(8).build();

      const session = createExerciseSession(createTestExercise('test_exercise'), plan);
      const actualSet = createMockSet({ weight: 105, repCount: 9 });
      session.completedSets = [actualSet];

      const comparison = compareSetAtIndex(session, 0);

      expect(comparison).toBeDefined();
      expect(comparison!.planned).toBe(plan.sets[0]);
      expect(comparison!.actual).toBe(actualSet);
      expect(comparison!.weightDelta).toBe(5); // 105 - 100
      expect(comparison!.repsDelta).toBe(1); // 9 - 8
    });

    it('returns undefined when no actual set', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      const comparison = compareSetAtIndex(session, 0);

      expect(comparison).toBeUndefined();
    });

    it('returns undefined when no planned set', () => {
      const plan = planBuilder().workingSets(1).build();
      const session = createExerciseSession(createTestExercise('test_exercise'), plan);
      session.completedSets = [createMockSet(), createMockSet()];

      const comparison = compareSetAtIndex(session, 1);

      expect(comparison).toBeUndefined();
    });
  });

  describe('getAllSetComparisons()', () => {
    it('returns empty array when no sets', () => {
      const session = createExerciseSession(
        createTestExercise('test_exercise'),
        planBuilder().workingSets(3).build()
      );

      const comparisons = getAllSetComparisons(session);

      expect(comparisons).toEqual([]);
    });

    it('returns comparisons for all completed sets', () => {
      const plan = planBuilder().workingSets(3).build();
      const session = createExerciseSession(createTestExercise('test_exercise'), plan);
      session.completedSets = [createMockSet(), createMockSet()];

      const comparisons = getAllSetComparisons(session);

      expect(comparisons.length).toBe(2);
    });
  });
});
