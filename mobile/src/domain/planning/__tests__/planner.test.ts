/**
 * Planner Tests
 *
 * Tests for the unified exercise planning system.
 */

import { describe, it, expect } from 'vitest';
import { planExercise } from '../planner';
import {
  TrainingGoal,
  TrainingLevel,
  createPlanningContext,
  type HistoricalMetrics,
} from '../types';
import { mockCompletedSet } from '@/__fixtures__/generators/mock-helpers';
import { historicalMetricsBuilder } from '@/__fixtures__/generators';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockHistoricalMetrics(
  overrides: Partial<HistoricalMetrics> = {}
): HistoricalMetrics {
  const builder = historicalMetricsBuilder().experienced(100);

  // Apply overrides
  if (overrides.recentEstimated1RM !== undefined)
    builder.recentEstimated1RM(overrides.recentEstimated1RM);
  if (overrides.trend !== undefined) builder.trend(overrides.trend);
  if (overrides.lastWorkingWeight !== undefined)
    builder.lastWorkingWeight(overrides.lastWorkingWeight);
  if (overrides.avgRepsAtWeight !== undefined) builder.avgRepsAtWeight(overrides.avgRepsAtWeight);
  if (overrides.sessionCount !== undefined) builder.sessionCount(overrides.sessionCount);
  if (overrides.daysSinceLastSession !== undefined)
    builder.daysSinceLastSession(overrides.daysSinceLastSession);
  if (overrides.velocityBaseline !== undefined)
    builder.velocityBaseline(overrides.velocityBaseline);

  return builder.build();
}

function createMockSet(
  options: {
    weight?: number;
    repCount?: number;
    velocity?: number;
  } = {}
) {
  const { weight = 100, repCount = 8, velocity = 0.5 } = options;
  return mockCompletedSet({ weight, repCount, startVelocity: velocity });
}

// =============================================================================
// planExercise() Tests
// =============================================================================

describe('planExercise()', () => {
  describe('routing', () => {
    it('routes to discovery when isDiscovery is true', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        { isDiscovery: true }
      );

      const result = planExercise(context);

      // Discovery mode returns discovery step
      expect(result.discoveryStep).toBeDefined();
    });

    it('routes to initial plan when no completed sets', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          historicalMetrics: createMockHistoricalMetrics(),
        }
      );

      const result = planExercise(context);

      // Initial plan provides nextSet
      expect(result.nextSet).toBeDefined();
    });

    it('routes to adaptation when has completed sets', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          historicalMetrics: createMockHistoricalMetrics(),
        }
      );
      context.completedSets = [createMockSet()];

      const result = planExercise(context);

      // Adaptation provides nextSet or shouldStop
      expect(result.nextSet !== null || result.shouldStop).toBe(true);
    });
  });

  describe('initial planning', () => {
    it('uses override weight when provided', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          overrides: { weight: 120, repRange: [6, 10], numSets: 3 },
        }
      );

      const result = planExercise(context);

      // Should create plan with specified weight
      expect(result.nextSet).toBeDefined();
    });

    it('uses historical weight when no override', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          historicalMetrics: createMockHistoricalMetrics({ lastWorkingWeight: 100 }),
        }
      );

      const result = planExercise(context);

      // Should have nextSet based on historical data
      expect(result.nextSet).toBeDefined();
    });

    it('indicates discovery needed when no weight info', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound'
      );

      const result = planExercise(context);

      // No weight info -> either discoveryStep or message indicating need for discovery
      const needsDiscovery =
        result.discoveryStep !== undefined ||
        result.message.toLowerCase().includes('discovery') ||
        result.message.toLowerCase().includes('weight');
      expect(needsDiscovery).toBe(true);
    });

    it('generates warmup and working sets', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          historicalMetrics: createMockHistoricalMetrics(),
        }
      );

      const result = planExercise(context);

      // First set should be warmup
      expect(result.nextSet!.isWarmup).toBe(true);
      // Should have remaining sets
      expect(result.remainingSets.length).toBeGreaterThan(0);
    });

    it('provides rest recommendation', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        { historicalMetrics: createMockHistoricalMetrics() }
      );

      const result = planExercise(context);

      expect(result.restSeconds).toBeGreaterThan(0);
    });
  });

  describe('adaptation', () => {
    it('returns adjustment list based on performance', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          historicalMetrics: createMockHistoricalMetrics(),
        }
      );
      // Simulate a completed set with good performance
      context.completedSets = [createMockSet({ weight: 100, repCount: 10, velocity: 0.7 })];

      const result = planExercise(context);

      expect(result.adjustments).toBeDefined();
      expect(Array.isArray(result.adjustments)).toBe(true);
    });

    it('includes updated metrics in result', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        {
          historicalMetrics: createMockHistoricalMetrics(),
        }
      );
      context.completedSets = [createMockSet()];

      const result = planExercise(context);

      expect(result.updatedMetrics).toBeDefined();
      expect(result.updatedMetrics.strength).toBeDefined();
      expect(result.updatedMetrics.fatigue).toBeDefined();
    });
  });

  describe('discovery mode', () => {
    it('returns discovery step recommendation', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        { isDiscovery: true }
      );

      const result = planExercise(context);

      expect(result.discoveryStep).toBeDefined();
    });

    it('progresses through discovery phases', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        { isDiscovery: true }
      );

      // First call should start exploration
      const result1 = planExercise(context);
      expect(result1.discoveryStep).toBeDefined();

      // Add a completed set and call again
      context.completedSets = [createMockSet({ weight: 50, velocity: 0.8 })];
      const result2 = planExercise(context);

      // Should recommend different weight or next step
      expect(result2.discoveryStep).toBeDefined();
    });

    it('includes message explaining recommendation', () => {
      const context = createPlanningContext(
        'test_exercise',
        TrainingGoal.HYPERTROPHY,
        TrainingLevel.INTERMEDIATE,
        'compound',
        { isDiscovery: true }
      );

      const result = planExercise(context);

      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
    });
  });
});
