/**
 * Plan Model Tests
 *
 * Tests for exercise plan helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyPlan,
  getCurrentSetIndex,
  getPlannedSet,
  isDiscoveryPlan,
  getPlanVolume,
  type ExercisePlan,
  type PlannedSet,
} from '../plan';
import { TrainingGoal } from '@/domain/planning/types';
import { planBuilder } from '@/__fixtures__/generators';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestPlan(overrides: Partial<ExercisePlan> = {}): ExercisePlan {
  const sets: PlannedSet[] = [
    { setNumber: 1, weight: 50, targetReps: 10, rirTarget: 5, isWarmup: true },
    { setNumber: 2, weight: 75, targetReps: 5, rirTarget: 3, isWarmup: true },
    { setNumber: 3, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false },
    { setNumber: 4, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false },
    { setNumber: 5, weight: 100, targetReps: 8, rirTarget: 2, isWarmup: false },
  ];

  return {
    exerciseId: 'test_exercise',
    sets,
    defaultRestSeconds: 120,
    goal: TrainingGoal.HYPERTROPHY,
    generatedAt: Date.now(),
    generatedBy: 'standard',
    ...overrides,
  };
}

// =============================================================================
// createEmptyPlan() Tests
// =============================================================================

describe('createEmptyPlan()', () => {
  it('creates plan with correct exercise ID', () => {
    const plan = createEmptyPlan('bench_press');

    expect(plan.exerciseId).toBe('bench_press');
  });

  it('creates plan with empty sets', () => {
    const plan = createEmptyPlan('test');

    expect(plan.sets).toEqual([]);
  });

  it('sets default rest to 90 seconds', () => {
    const plan = createEmptyPlan('test');

    expect(plan.defaultRestSeconds).toBe(90);
  });

  it('sets generation source to manual', () => {
    const plan = createEmptyPlan('test');

    expect(plan.generatedBy).toBe('manual');
  });

  it('sets current timestamp', () => {
    const before = Date.now();
    const plan = createEmptyPlan('test');
    const after = Date.now();

    expect(plan.generatedAt).toBeGreaterThanOrEqual(before);
    expect(plan.generatedAt).toBeLessThanOrEqual(after);
  });
});

// =============================================================================
// getCurrentSetIndex() Tests
// =============================================================================

describe('getCurrentSetIndex()', () => {
  it('returns 0 when no sets completed', () => {
    const plan = createTestPlan();

    expect(getCurrentSetIndex(plan, 0)).toBe(0);
  });

  it('returns completed count when sets remain', () => {
    const plan = createTestPlan();

    expect(getCurrentSetIndex(plan, 2)).toBe(2);
    expect(getCurrentSetIndex(plan, 3)).toBe(3);
  });

  it('caps at last set index when all complete', () => {
    const plan = createTestPlan(); // 5 sets, indices 0-4

    // Even with more completed than planned, returns last valid index
    expect(getCurrentSetIndex(plan, 5)).toBe(4);
    expect(getCurrentSetIndex(plan, 10)).toBe(4);
  });

  it('handles empty plan', () => {
    const plan = createEmptyPlan('test');

    expect(getCurrentSetIndex(plan, 0)).toBe(-1); // -1 because Math.min(0, -1)
  });
});

// =============================================================================
// getPlannedSet() Tests
// =============================================================================

describe('getPlannedSet()', () => {
  it('returns set at valid index', () => {
    const plan = createTestPlan();

    const set0 = getPlannedSet(plan, 0);
    const set2 = getPlannedSet(plan, 2);

    expect(set0?.setNumber).toBe(1);
    expect(set0?.isWarmup).toBe(true);
    expect(set2?.setNumber).toBe(3);
    expect(set2?.isWarmup).toBe(false);
  });

  it('returns undefined for invalid index', () => {
    const plan = createTestPlan();

    expect(getPlannedSet(plan, -1)).toBeUndefined();
    expect(getPlannedSet(plan, 10)).toBeUndefined();
  });

  it('returns undefined for empty plan', () => {
    const plan = createEmptyPlan('test');

    expect(getPlannedSet(plan, 0)).toBeUndefined();
  });
});

// =============================================================================
// isDiscoveryPlan() Tests
// =============================================================================

describe('isDiscoveryPlan()', () => {
  it('returns true for discovery plan', () => {
    const plan = planBuilder().workingSets(3).discovery().build();

    expect(isDiscoveryPlan(plan)).toBe(true);
  });

  it('returns false for standard plan', () => {
    const plan = planBuilder().workingSets(3).build();

    expect(isDiscoveryPlan(plan)).toBe(false);
  });

  it('returns false for manual plan', () => {
    const plan = createTestPlan({ generatedBy: 'manual' });

    expect(isDiscoveryPlan(plan)).toBe(false);
  });
});

// =============================================================================
// getPlanVolume() Tests
// =============================================================================

describe('getPlanVolume()', () => {
  it('calculates total volume correctly', () => {
    const plan = createTestPlan();
    // 50*10 + 75*5 + 100*8 + 100*8 + 100*8 = 500 + 375 + 800 + 800 + 800 = 3275
    const expectedVolume = 50 * 10 + 75 * 5 + 100 * 8 * 3;

    expect(getPlanVolume(plan)).toBe(expectedVolume);
  });

  it('returns 0 for empty plan', () => {
    const plan = createEmptyPlan('test');

    expect(getPlanVolume(plan)).toBe(0);
  });

  it('handles single set plan', () => {
    const plan: ExercisePlan = {
      ...createEmptyPlan('test'),
      sets: [{ setNumber: 1, weight: 100, targetReps: 5, rirTarget: 3, isWarmup: false }],
    };

    expect(getPlanVolume(plan)).toBe(500);
  });
});
