/**
 * Planning Types Tests
 *
 * Tests for planning utilities and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
  TrainingGoal,
  TrainingLevel,
  ProgressionScheme,
  getWarmupSets,
  getDefaultProgressionScheme,
  createEmptyHistoricalMetrics,
  createPlanningContext,
  VELOCITY_LOSS_TARGETS,
  REST_DEFAULTS,
  RIR_DEFAULTS,
  VOLUME_LANDMARKS,
} from '../types';

// =============================================================================
// getWarmupSets() Tests
// =============================================================================

describe('getWarmupSets()', () => {
  it('returns warmup sets with default scheme', () => {
    const warmups = getWarmupSets(100);

    expect(warmups.length).toBe(3); // Default scheme has 3 warmups
  });

  it('calculates weights as percentages', () => {
    const warmups = getWarmupSets(100);

    // Default percentages: 50%, 75%, 90%
    expect(warmups[0].weight).toBe(50);
    expect(warmups[1].weight).toBe(75);
    expect(warmups[2].weight).toBe(90);
  });

  it('rounds weights to nearest 5 lbs', () => {
    const warmups = getWarmupSets(83);

    // 83 * 0.5 = 41.5 -> rounds to 40
    // 83 * 0.75 = 62.25 -> rounds to 60
    // 83 * 0.9 = 74.7 -> rounds to 75
    expect(warmups[0].weight).toBe(40);
    expect(warmups[1].weight).toBe(60);
    expect(warmups[2].weight).toBe(75);
  });

  it('enforces minimum weight of 5 lbs', () => {
    const warmups = getWarmupSets(5);

    // Even at minimum working weight, warmups should be at least 5
    warmups.forEach((w) => {
      expect(w.weight).toBeGreaterThanOrEqual(5);
    });
  });

  it('includes rep targets', () => {
    const warmups = getWarmupSets(100);

    // Default scheme has: 10, 5, 3 reps
    expect(warmups[0].reps).toBe(10);
    expect(warmups[1].reps).toBe(5);
    expect(warmups[2].reps).toBe(3);
  });

  it('uses custom scheme when provided', () => {
    const customScheme = {
      warmupPercentages: [
        [0.4, 5],
        [0.6, 3],
      ] as [number, number][],
      readinessCheckSet: -1,
      warmupRestSeconds: 60,
    };

    const warmups = getWarmupSets(100, customScheme);

    expect(warmups.length).toBe(2);
    expect(warmups[0].weight).toBe(40);
    expect(warmups[0].reps).toBe(5);
    expect(warmups[1].weight).toBe(60);
    expect(warmups[1].reps).toBe(3);
  });
});

// =============================================================================
// getDefaultProgressionScheme() Tests
// =============================================================================

describe('getDefaultProgressionScheme()', () => {
  describe('novice level', () => {
    it('returns LINEAR for any goal', () => {
      expect(getDefaultProgressionScheme(TrainingLevel.NOVICE, TrainingGoal.STRENGTH)).toBe(
        ProgressionScheme.LINEAR
      );
      expect(getDefaultProgressionScheme(TrainingLevel.NOVICE, TrainingGoal.HYPERTROPHY)).toBe(
        ProgressionScheme.LINEAR
      );
      expect(getDefaultProgressionScheme(TrainingLevel.NOVICE, TrainingGoal.ENDURANCE)).toBe(
        ProgressionScheme.LINEAR
      );
    });
  });

  describe('intermediate level', () => {
    it('returns AUTOREGULATED for strength', () => {
      expect(getDefaultProgressionScheme(TrainingLevel.INTERMEDIATE, TrainingGoal.STRENGTH)).toBe(
        ProgressionScheme.AUTOREGULATED
      );
    });

    it('returns DOUBLE for hypertrophy', () => {
      expect(
        getDefaultProgressionScheme(TrainingLevel.INTERMEDIATE, TrainingGoal.HYPERTROPHY)
      ).toBe(ProgressionScheme.DOUBLE);
    });

    it('returns DOUBLE for endurance', () => {
      expect(getDefaultProgressionScheme(TrainingLevel.INTERMEDIATE, TrainingGoal.ENDURANCE)).toBe(
        ProgressionScheme.DOUBLE
      );
    });
  });

  describe('advanced level', () => {
    it('returns AUTOREGULATED for any goal', () => {
      expect(getDefaultProgressionScheme(TrainingLevel.ADVANCED, TrainingGoal.STRENGTH)).toBe(
        ProgressionScheme.AUTOREGULATED
      );
      expect(getDefaultProgressionScheme(TrainingLevel.ADVANCED, TrainingGoal.HYPERTROPHY)).toBe(
        ProgressionScheme.AUTOREGULATED
      );
      expect(getDefaultProgressionScheme(TrainingLevel.ADVANCED, TrainingGoal.ENDURANCE)).toBe(
        ProgressionScheme.AUTOREGULATED
      );
    });
  });
});

// =============================================================================
// createEmptyHistoricalMetrics() Tests
// =============================================================================

describe('createEmptyHistoricalMetrics()', () => {
  it('returns metrics with null values', () => {
    const metrics = createEmptyHistoricalMetrics();

    expect(metrics.recentEstimated1RM).toBeNull();
    expect(metrics.trend).toBeNull();
    expect(metrics.lastWorkingWeight).toBeNull();
    expect(metrics.avgRepsAtWeight).toBeNull();
    expect(metrics.daysSinceLastSession).toBeNull();
    expect(metrics.velocityBaseline).toBeNull();
  });

  it('returns zero session count', () => {
    const metrics = createEmptyHistoricalMetrics();

    expect(metrics.sessionCount).toBe(0);
  });
});

// =============================================================================
// createPlanningContext() Tests
// =============================================================================

describe('createPlanningContext()', () => {
  it('creates context with required fields', () => {
    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound'
    );

    expect(context.exerciseId).toBe('test_exercise');
    expect(context.goal).toBe(TrainingGoal.HYPERTROPHY);
    expect(context.level).toBe(TrainingLevel.INTERMEDIATE);
    expect(context.exerciseType).toBe('compound');
  });

  it('has null metrics by default', () => {
    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound'
    );

    expect(context.sessionMetrics).toBeNull();
    expect(context.historicalMetrics).toBeNull();
  });

  it('has empty completed sets by default', () => {
    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound'
    );

    expect(context.completedSets).toEqual([]);
  });

  it('is not discovery by default', () => {
    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound'
    );

    expect(context.isDiscovery).toBe(false);
  });

  it('accepts historical metrics option', () => {
    const historicalMetrics = {
      recentEstimated1RM: 150,
      trend: 'stable' as const,
      lastWorkingWeight: 100,
      avgRepsAtWeight: 8,
      sessionCount: 5,
      daysSinceLastSession: 3,
      velocityBaseline: null,
    };

    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound',
      { historicalMetrics }
    );

    expect(context.historicalMetrics).toEqual(historicalMetrics);
  });

  it('accepts discovery flag', () => {
    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound',
      { isDiscovery: true }
    );

    expect(context.isDiscovery).toBe(true);
  });

  it('accepts overrides', () => {
    const overrides = {
      weight: 100,
      repRange: [6, 10] as [number, number],
      numSets: 4,
    };

    const context = createPlanningContext(
      'test_exercise',
      TrainingGoal.HYPERTROPHY,
      TrainingLevel.INTERMEDIATE,
      'compound',
      { overrides }
    );

    expect(context.overrides).toEqual(overrides);
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Planning Constants', () => {
  describe('VELOCITY_LOSS_TARGETS', () => {
    it('strength has lowest velocity loss target', () => {
      const [, maxStr] = VELOCITY_LOSS_TARGETS[TrainingGoal.STRENGTH];
      const [, maxHyp] = VELOCITY_LOSS_TARGETS[TrainingGoal.HYPERTROPHY];

      expect(maxStr).toBeLessThan(maxHyp);
    });

    it('endurance has highest velocity loss target', () => {
      const [, maxEnd] = VELOCITY_LOSS_TARGETS[TrainingGoal.ENDURANCE];
      const [, maxHyp] = VELOCITY_LOSS_TARGETS[TrainingGoal.HYPERTROPHY];

      expect(maxEnd).toBeGreaterThan(maxHyp);
    });
  });

  describe('REST_DEFAULTS', () => {
    it('strength has longest rest', () => {
      expect(REST_DEFAULTS[TrainingGoal.STRENGTH]).toBeGreaterThan(
        REST_DEFAULTS[TrainingGoal.HYPERTROPHY]
      );
    });

    it('endurance has shortest rest', () => {
      expect(REST_DEFAULTS[TrainingGoal.ENDURANCE]).toBeLessThan(
        REST_DEFAULTS[TrainingGoal.HYPERTROPHY]
      );
    });
  });

  describe('RIR_DEFAULTS', () => {
    it('compound has higher RIR than isolation', () => {
      expect(RIR_DEFAULTS.compound).toBeGreaterThan(RIR_DEFAULTS.isolation);
    });
  });

  describe('VOLUME_LANDMARKS', () => {
    it('advanced has higher volume limits', () => {
      expect(VOLUME_LANDMARKS[TrainingLevel.ADVANCED].mrv).toBeGreaterThan(
        VOLUME_LANDMARKS[TrainingLevel.INTERMEDIATE].mrv
      );
    });

    it('MEV < MAV < MRV for each level', () => {
      Object.values(VOLUME_LANDMARKS).forEach((landmarks) => {
        expect(landmarks.mev).toBeLessThan(landmarks.mav);
        expect(landmarks.mav).toBeLessThan(landmarks.mrv);
      });
    });
  });
});
