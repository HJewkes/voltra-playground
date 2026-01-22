/**
 * Session Termination Tests
 *
 * Tests for workout termination logic.
 */

import { describe, it, expect } from 'vitest';
import {
  checkTermination,
  createUserStoppedTermination,
  getTerminationMessage,
  type TerminationReason,
} from '../termination';
import type { ExerciseSession } from '@/domain/workout/models/session';
import type { Set, SetMetrics } from '@/domain/workout/models/set';
import type { ExercisePlan, PlannedSet } from '@/domain/workout/models/plan';
import { createExercise, MuscleGroup } from '@/domain/exercise';
import { TrainingGoal } from '@/domain/planning';
import { repBuilder, setBuilder } from '@/__fixtures__/generators';

// =============================================================================
// Test Helpers - Direct Metric Control for Termination Logic Testing
// =============================================================================

/**
 * Create mock set metrics with specific velocity baseline.
 * For termination tests, we need direct control over the metric values.
 */
function createMockSetMetrics(overrides: Partial<SetMetrics['velocity']> = {}): SetMetrics {
  return {
    repCount: 5,
    totalDuration: 15,
    timeUnderTension: 12,
    velocity: {
      concentricBaseline: overrides.concentricBaseline ?? 0.5,
      eccentricBaseline: 0.3,
      concentricLast: 0.45,
      eccentricLast: 0.35,
      concentricDelta: -10,
      eccentricDelta: 5,
      concentricByRep: [0.55, 0.52, 0.5, 0.48, 0.45],
      eccentricByRep: [0.32, 0.33, 0.35, 0.34, 0.35],
    },
    fatigue: {
      fatigueIndex: 20,
      eccentricControlScore: 90,
      formWarning: null,
    },
    effort: {
      rir: 3,
      rpe: 7,
      confidence: 'medium',
    },
  };
}

/**
 * Create a mock set with specific metrics for termination logic testing.
 * Uses direct metric assignment rather than physics-based generation.
 */
function createMockSet(
  options: {
    repCount?: number;
    weight?: number;
    velocityBaseline?: number;
  } = {}
): Set {
  const { repCount = 5, weight = 100, velocityBaseline = 0.5 } = options;

  // Generate reps using the builder for realistic rep data
  const reps =
    repCount > 0
      ? Array.from({ length: repCount }, (_, i) =>
          repBuilder()
            .concentric({ meanVelocity: velocityBaseline, peakVelocity: velocityBaseline + 0.15 })
            .eccentric({
              meanVelocity: velocityBaseline * 0.5,
              peakVelocity: velocityBaseline * 0.6,
            })
            .repNumber(i + 1)
            .build()
        )
      : [];

  // But override metrics directly for termination logic testing
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    exerciseId: 'test_exercise',
    exerciseName: 'Test Exercise',
    weight,
    reps,
    timestamp: { start: Date.now() - 60000, end: Date.now() },
    metrics: {
      ...createMockSetMetrics({ concentricBaseline: velocityBaseline }),
      repCount, // Override with actual rep count
    },
  };
}

function createMockPlan(
  options: {
    setCount?: number;
    isDiscovery?: boolean;
  } = {}
): ExercisePlan {
  const { setCount = 3, isDiscovery = false } = options;

  const sets: PlannedSet[] = Array.from({ length: setCount }, (_, i) => ({
    setNumber: i + 1,
    weight: 100,
    targetReps: 8,
    rirTarget: 2,
    isWarmup: false,
  }));

  return {
    exerciseId: 'test_exercise',
    sets,
    defaultRestSeconds: 120,
    goal: TrainingGoal.HYPERTROPHY,
    generatedAt: Date.now(),
    generatedBy: isDiscovery ? 'discovery' : 'standard',
  };
}

function createMockSession(
  options: {
    completedSets?: Set[];
    planSetCount?: number;
    isDiscovery?: boolean;
  } = {}
): ExerciseSession {
  const { completedSets = [], planSetCount = 3, isDiscovery = false } = options;

  return {
    id: `session_${Date.now()}`,
    exercise: createExercise({
      id: 'test_exercise',
      name: 'Test Exercise',
      muscleGroups: [MuscleGroup.BACK],
      movementPattern: 'pull',
    }),
    plan: createMockPlan({ setCount: planSetCount, isDiscovery }),
    completedSets,
    restEndsAt: null,
    startedAt: Date.now() - 600000,
  };
}

// =============================================================================
// checkTermination() Tests
// =============================================================================

describe('checkTermination()', () => {
  describe('failure detection (0 reps)', () => {
    it('terminates when set has 0 reps', () => {
      const session = createMockSession();
      const failedSet = createMockSet({ repCount: 0 });

      const result = checkTermination(session, failedSet);

      expect(result.shouldTerminate).toBe(true);
      expect(result.reason).toBe('failure');
    });

    it('does not terminate when set has reps', () => {
      const session = createMockSession();
      const goodSet = createMockSet({ repCount: 5 });

      const result = checkTermination(session, goodSet);

      expect(result.shouldTerminate).toBe(false);
    });
  });

  describe('velocity grinding detection', () => {
    it('terminates when velocity below threshold', () => {
      const session = createMockSession();
      const slowSet = createMockSet({ velocityBaseline: 0.2 }); // Below 0.3 threshold

      const result = checkTermination(session, slowSet);

      expect(result.shouldTerminate).toBe(true);
      expect(result.reason).toBe('velocity_grinding');
    });

    it('does not terminate when velocity above threshold', () => {
      const session = createMockSession();
      const normalSet = createMockSet({ velocityBaseline: 0.5 });

      const result = checkTermination(session, normalSet);

      expect(result.reason).not.toBe('velocity_grinding');
    });
  });

  describe('plan exhausted detection', () => {
    it('terminates when all planned sets completed', () => {
      const completedSets = [createMockSet(), createMockSet(), createMockSet()];
      const session = createMockSession({ completedSets, planSetCount: 3 });
      const lastSet = completedSets[completedSets.length - 1];

      const result = checkTermination(session, lastSet);

      expect(result.shouldTerminate).toBe(true);
      expect(result.reason).toBe('plan_exhausted');
    });

    it('does not terminate when sets remain', () => {
      const completedSets = [createMockSet(), createMockSet()];
      const session = createMockSession({ completedSets, planSetCount: 3 });
      const lastSet = completedSets[completedSets.length - 1];

      const result = checkTermination(session, lastSet);

      expect(result.reason).not.toBe('plan_exhausted');
    });
  });

  describe('junk volume detection (standard only)', () => {
    it('terminates on significant rep drop in standard session', () => {
      const set1 = createMockSet({ repCount: 10, weight: 100 }); // First working set
      const set2 = createMockSet({ repCount: 8, weight: 100 });
      const set3 = createMockSet({ repCount: 4, weight: 100 }); // 60% drop

      const session = createMockSession({
        completedSets: [set1, set2, set3],
        planSetCount: 5,
        isDiscovery: false,
      });

      const result = checkTermination(session, set3);

      expect(result.shouldTerminate).toBe(true);
      expect(result.reason).toBe('junk_volume');
    });

    it('does not check junk volume in discovery session', () => {
      const set1 = createMockSet({ repCount: 10, weight: 100 });
      const set2 = createMockSet({ repCount: 4, weight: 100 }); // Big drop

      const session = createMockSession({
        completedSets: [set1, set2],
        planSetCount: 5,
        isDiscovery: true, // Discovery session
      });

      const result = checkTermination(session, set2);

      // Should not be junk_volume since this is discovery
      expect(result.reason).not.toBe('junk_volume');
    });

    it('ignores warmup sets in junk volume calculation', () => {
      const warmup = createMockSet({ repCount: 10, weight: 50 }); // Lower weight = warmup
      const working = createMockSet({ repCount: 8, weight: 100 });
      const working2 = createMockSet({ repCount: 5, weight: 100 }); // Compare to first at same weight

      const session = createMockSession({
        completedSets: [warmup, working, working2],
        planSetCount: 5,
        isDiscovery: false,
      });

      const result = checkTermination(session, working2);

      // Should compare working2 (5 reps) to working (8 reps), not warmup
      // 5/8 = 62.5%, drop = 37.5% which is below 50% threshold
      expect(result.reason).not.toBe('junk_volume');
    });
  });

  describe('profile complete detection (discovery only)', () => {
    it('terminates when profile has enough data', () => {
      // Need 3+ data points with 30%+ weight spread
      const set1 = createMockSet({ weight: 50, velocityBaseline: 0.8 });
      const set2 = createMockSet({ weight: 75, velocityBaseline: 0.6 });
      const set3 = createMockSet({ weight: 100, velocityBaseline: 0.4 }); // 100% spread from 50

      const session = createMockSession({
        completedSets: [set1, set2, set3],
        planSetCount: 5,
        isDiscovery: true,
      });

      const result = checkTermination(session, set3);

      expect(result.shouldTerminate).toBe(true);
      expect(result.reason).toBe('profile_complete');
    });

    it('does not check profile in standard session', () => {
      const set1 = createMockSet({ weight: 50, velocityBaseline: 0.8 });
      const set2 = createMockSet({ weight: 75, velocityBaseline: 0.6 });
      const set3 = createMockSet({ weight: 100, velocityBaseline: 0.4 });

      const session = createMockSession({
        completedSets: [set1, set2, set3],
        planSetCount: 5,
        isDiscovery: false, // Standard session
      });

      const result = checkTermination(session, set3);

      expect(result.reason).not.toBe('profile_complete');
    });
  });

  describe('priority ordering', () => {
    it('failure takes priority over other reasons', () => {
      const failedSet = createMockSet({ repCount: 0, velocityBaseline: 0.2 });
      const session = createMockSession({
        completedSets: [createMockSet(), createMockSet(), failedSet],
        planSetCount: 3,
      });

      const result = checkTermination(session, failedSet);

      expect(result.reason).toBe('failure');
    });
  });
});

// =============================================================================
// createUserStoppedTermination() Tests
// =============================================================================

describe('createUserStoppedTermination()', () => {
  it('creates user stopped result', () => {
    const result = createUserStoppedTermination();

    expect(result.shouldTerminate).toBe(true);
    expect(result.reason).toBe('user_stopped');
    expect(result.message).toBe('Session ended by user');
  });
});

// =============================================================================
// getTerminationMessage() Tests
// =============================================================================

describe('getTerminationMessage()', () => {
  const testCases: Array<{ reason: TerminationReason; expectedContains: string }> = [
    { reason: 'failure', expectedContains: 'failure' },
    { reason: 'velocity_grinding', expectedContains: 'max effort' },
    { reason: 'junk_volume', expectedContains: 'declined' },
    { reason: 'plan_exhausted', expectedContains: 'complete' },
    { reason: 'profile_complete', expectedContains: 'complete' },
    { reason: 'user_stopped', expectedContains: 'saved' },
  ];

  it.each(testCases)('returns message for $reason', ({ reason, expectedContains }) => {
    const message = getTerminationMessage(reason);

    expect(message.toLowerCase()).toContain(expectedContains.toLowerCase());
  });
});

// =============================================================================
// Integration with Builders
// =============================================================================

describe('Termination with Builders', () => {
  it('detects termination conditions from set composition', () => {
    // Generate productive set and junk volume set using builders
    const productiveSet = setBuilder().weight(100).productiveWorking().build();
    const junkSet = setBuilder().weight(100).junkVolume().build();

    // productiveWorking has 7 reps, junkVolume has 4 reps (with grinding behavior)
    const session = createMockSession({
      completedSets: [productiveSet, junkSet],
      planSetCount: 5,
      isDiscovery: false,
    });

    const result = checkTermination(session, junkSet);

    // Should terminate for some reason (velocity_grinding or junk_volume)
    // The junkVolume set has grinding reps with low velocity
    expect(result.shouldTerminate).toBe(true);
    expect(['junk_volume', 'velocity_grinding']).toContain(result.reason);
  });
});
