/**
 * Standard Strategy Tests
 *
 * Tests for intra-workout adaptation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateWeightAdjustment,
  calculateRestAdjustment,
  shouldStop,
  checkJunkVolume,
  canAddSet,
  getExpectedPerformance,
  isSetWithinExpectations,
  createAdjustment,
  EXPECTED_REP_DROP,
  type SetPerformance,
  type StandardStrategyConfig,
} from '../standard';
import type { SessionMetrics, FatigueEstimate } from '@/domain/workout/metrics/types';
import { TrainingGoal } from '@/domain/planning/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestConfig(overrides: Partial<StandardStrategyConfig> = {}): StandardStrategyConfig {
  return {
    goal: TrainingGoal.HYPERTROPHY,
    exerciseType: 'compound',
    allowWeightAdjustment: true,
    allowSetAdjustment: true,
    maxSets: 5,
    minSets: 3,
    ...overrides,
  };
}

function createTestMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    strength: {
      estimated1RM: 150,
      confidence: 0.8,
      source: 'session',
    },
    readiness: {
      zone: 'green',
      velocityPercent: 100,
      confidence: 0.8,
      adjustments: { weight: 0, volume: 1 },
      message: 'Ready to train',
    },
    fatigue: {
      level: 0.3,
      isJunkVolume: false,
      velocityRecoveryPercent: 90,
      repDropPercent: 10,
    },
    volumeAccumulated: 2400,
    effectiveVolume: 2000,
    ...overrides,
  };
}

function createTestFatigue(overrides: Partial<FatigueEstimate> = {}): FatigueEstimate {
  return {
    level: 0.3,
    isJunkVolume: false,
    velocityRecoveryPercent: 90,
    repDropPercent: 10,
    ...overrides,
  };
}

function createTestSetPerformance(overrides: Partial<SetPerformance> = {}): SetPerformance {
  return {
    setNumber: 1,
    reps: 8,
    weight: 100,
    velocityLossPercent: 15,
    estimatedRir: 3,
    firstRepVelocity: 0.6,
    avgVelocity: 0.5,
    ...overrides,
  };
}

// =============================================================================
// calculateWeightAdjustment() Tests
// =============================================================================

describe('calculateWeightAdjustment()', () => {
  describe('when velocity loss is under target', () => {
    it('recommends weight increase for compound', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig({ goal: TrainingGoal.HYPERTROPHY, exerciseType: 'compound' });
      // Hypertrophy VL target: [20, 35], VL_TOLERANCE = 5
      // Under target means < 20 - 5 = 15

      const result = calculateWeightAdjustment(metrics, 8, config);

      expect(result.shouldAdjust).toBe(true);
      expect(result.adjustment).toBe(5); // Compound increment
    });

    it('recommends increment for isolation', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig({
        goal: TrainingGoal.HYPERTROPHY,
        exerciseType: 'isolation',
      });

      const result = calculateWeightAdjustment(metrics, 8, config);

      expect(result.shouldAdjust).toBe(true);
      expect(result.adjustment).toBe(5); // Voltra uses 5 lb steps for both
    });
  });

  describe('when velocity loss is over target', () => {
    it('recommends weight decrease', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig({ goal: TrainingGoal.HYPERTROPHY });
      // Hypertrophy VL target: [20, 35], over target means > 35 + 5 = 40

      const result = calculateWeightAdjustment(metrics, 45, config);

      expect(result.shouldAdjust).toBe(true);
      expect(result.adjustment).toBe(-5);
    });
  });

  describe('when velocity loss is in target range', () => {
    it('recommends no change', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig({ goal: TrainingGoal.HYPERTROPHY });
      // In range: 20-35%

      const result = calculateWeightAdjustment(metrics, 25, config);

      expect(result.shouldAdjust).toBe(false);
      expect(result.adjustment).toBe(0);
    });
  });

  describe('when fatigue is high', () => {
    it('prevents weight increase', () => {
      const metrics = createTestMetrics({
        fatigue: createTestFatigue({ level: 0.8 }),
      });
      const config = createTestConfig();

      const result = calculateWeightAdjustment(metrics, 8, config);

      expect(result.shouldAdjust).toBe(false);
      expect(result.adjustment).toBe(0);
      expect(result.reason).toContain('Fatigue');
    });

    it('prevents weight increase on junk volume', () => {
      const metrics = createTestMetrics({
        fatigue: createTestFatigue({ isJunkVolume: true }),
      });
      const config = createTestConfig();

      const result = calculateWeightAdjustment(metrics, 8, config);

      expect(result.shouldAdjust).toBe(false);
    });
  });

  describe('with custom velocity loss targets', () => {
    it('uses provided targets', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig({
        velocityLossTarget: [10, 20], // Custom stricter targets
      });

      // 25% is over custom max of 20 + 5 tolerance
      const result = calculateWeightAdjustment(metrics, 26, config);

      expect(result.shouldAdjust).toBe(true);
      expect(result.adjustment).toBe(-5);
    });
  });
});

// =============================================================================
// calculateRestAdjustment() Tests
// =============================================================================

describe('calculateRestAdjustment()', () => {
  describe('based on velocity loss', () => {
    it('adds 60s for high velocity loss (>40%)', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig();

      const result = calculateRestAdjustment(metrics, 45, config);

      expect(result.shouldExtend).toBe(true);
      expect(result.extraRest).toBe(60);
    });

    it('adds 30s for moderate velocity loss (>30%)', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig();

      const result = calculateRestAdjustment(metrics, 35, config);

      expect(result.shouldExtend).toBe(true);
      expect(result.extraRest).toBe(30);
    });

    it('no extra rest for normal velocity loss', () => {
      const metrics = createTestMetrics();
      const config = createTestConfig();

      const result = calculateRestAdjustment(metrics, 20, config);

      expect(result.shouldExtend).toBe(false);
      expect(result.extraRest).toBe(0);
    });
  });

  describe('based on fatigue level', () => {
    it('ensures minimum 3 min rest for high fatigue', () => {
      const metrics = createTestMetrics({
        fatigue: createTestFatigue({ level: 0.8 }),
      });
      const config = createTestConfig({ baseRestSeconds: 120 }); // 2 min base

      const result = calculateRestAdjustment(metrics, 20, config);

      expect(result.extraRest).toBeGreaterThanOrEqual(60); // To reach 180s
    });
  });

  describe('based on rep drop', () => {
    it('extends rest for significant rep drop (>30%)', () => {
      const metrics = createTestMetrics({
        fatigue: createTestFatigue({ repDropPercent: 35 }),
      });
      const config = createTestConfig({ baseRestSeconds: 120 });

      const result = calculateRestAdjustment(metrics, 20, config);

      expect(result.shouldExtend).toBe(true);
    });
  });
});

// =============================================================================
// shouldStop() Tests
// =============================================================================

describe('shouldStop()', () => {
  it('stops for junk volume', () => {
    const metrics = createTestMetrics({
      fatigue: createTestFatigue({ isJunkVolume: true }),
    });
    const config = createTestConfig();

    const result = shouldStop(metrics, 3, 5, config);

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('junk_volume');
  });

  it('stops for velocity grinding', () => {
    const metrics = createTestMetrics({
      fatigue: createTestFatigue({ velocityRecoveryPercent: 50 }),
    });
    const config = createTestConfig();

    const result = shouldStop(metrics, 3, 5, config);

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('velocity_grinding');
  });

  it('stops when planned sets reached', () => {
    const metrics = createTestMetrics();
    const config = createTestConfig();

    const result = shouldStop(metrics, 5, 5, config);

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('target_reached');
  });

  it('stops at minimum sets with high fatigue', () => {
    const metrics = createTestMetrics({
      fatigue: createTestFatigue({ level: 0.8 }),
    });
    const config = createTestConfig({ minSets: 3 });

    const result = shouldStop(metrics, 3, 5, config);

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('fatigue_limit');
  });

  it('continues if not at minimum and fatigue manageable', () => {
    const metrics = createTestMetrics();
    const config = createTestConfig({ minSets: 3 });

    const result = shouldStop(metrics, 2, 5, config);

    expect(result.shouldStop).toBe(false);
    expect(result.reason).toBeNull();
  });
});

// =============================================================================
// checkJunkVolume() Tests
// =============================================================================

describe('checkJunkVolume()', () => {
  it('returns true for 50%+ rep drop', () => {
    const fatigue = createTestFatigue({ repDropPercent: 55 });

    expect(checkJunkVolume(fatigue)).toBe(true);
  });

  it('returns true for 40%+ velocity drop', () => {
    const fatigue = createTestFatigue({ velocityRecoveryPercent: 55 }); // 45% drop

    expect(checkJunkVolume(fatigue)).toBe(true);
  });

  it('returns true if already marked as junk', () => {
    const fatigue = createTestFatigue({ isJunkVolume: true });

    expect(checkJunkVolume(fatigue)).toBe(true);
  });

  it('returns false for normal fatigue', () => {
    const fatigue = createTestFatigue({
      repDropPercent: 20,
      velocityRecoveryPercent: 85,
      isJunkVolume: false,
    });

    expect(checkJunkVolume(fatigue)).toBe(false);
  });
});

// =============================================================================
// canAddSet() Tests
// =============================================================================

describe('canAddSet()', () => {
  it('allows extra set when conditions good', () => {
    const metrics = createTestMetrics();
    const lastSet = createTestSetPerformance({
      estimatedRir: 4,
      velocityLossPercent: 15,
    });
    const config = createTestConfig({ maxSets: 6 });

    const result = canAddSet(metrics, lastSet, 4, config);

    expect(result.canAddSet).toBe(true);
  });

  it('denies when at max sets', () => {
    const metrics = createTestMetrics();
    const lastSet = createTestSetPerformance();
    const config = createTestConfig({ maxSets: 5 });

    const result = canAddSet(metrics, lastSet, 5, config);

    expect(result.canAddSet).toBe(false);
    expect(result.reason).toContain('maximum');
  });

  it('denies when RIR too low', () => {
    const metrics = createTestMetrics();
    const lastSet = createTestSetPerformance({ estimatedRir: 1 }); // Below RIR_DEFAULTS.compound of 2
    const config = createTestConfig();

    const result = canAddSet(metrics, lastSet, 4, config);

    expect(result.canAddSet).toBe(false);
    expect(result.reason).toContain('failure');
  });

  it('denies when velocity loss over target', () => {
    const metrics = createTestMetrics();
    const lastSet = createTestSetPerformance({ velocityLossPercent: 40 });
    const config = createTestConfig({ goal: TrainingGoal.HYPERTROPHY }); // Target max 35%

    const result = canAddSet(metrics, lastSet, 4, config);

    expect(result.canAddSet).toBe(false);
  });

  it('denies for junk volume', () => {
    const metrics = createTestMetrics({
      fatigue: createTestFatigue({ isJunkVolume: true }),
    });
    const lastSet = createTestSetPerformance();
    const config = createTestConfig();

    const result = canAddSet(metrics, lastSet, 4, config);

    expect(result.canAddSet).toBe(false);
    expect(result.reason).toContain('junk');
  });

  it('denies for high fatigue', () => {
    const metrics = createTestMetrics({
      fatigue: createTestFatigue({ level: 0.8 }),
    });
    const lastSet = createTestSetPerformance();
    const config = createTestConfig();

    const result = canAddSet(metrics, lastSet, 4, config);

    expect(result.canAddSet).toBe(false);
    expect(result.reason).toContain('Fatigue');
  });
});

// =============================================================================
// getExpectedPerformance() Tests
// =============================================================================

describe('getExpectedPerformance()', () => {
  it('returns null for first set', () => {
    const result = getExpectedPerformance(1, 10, 120);

    expect(result).toBeNull();
  });

  it('returns null for zero first reps', () => {
    const result = getExpectedPerformance(2, 0, 120);

    expect(result).toBeNull();
  });

  it('calculates expected reps for set 2', () => {
    const result = getExpectedPerformance(2, 10, 120);

    expect(result).not.toBeNull();
    expect(result!.expectedReps).toBeLessThan(10);
    expect(result!.expectedReps).toBeGreaterThan(0);
  });

  it('uses correct drop rate for rest period', () => {
    // 60s rest has 35% expected drop
    const shortRest = getExpectedPerformance(2, 10, 60);
    // 180s rest has 15% expected drop
    const longRest = getExpectedPerformance(2, 10, 180);

    expect(shortRest!.expectedReps).toBeLessThan(longRest!.expectedReps);
  });

  it('compounds drop across multiple sets', () => {
    const set2 = getExpectedPerformance(2, 10, 120);
    const set4 = getExpectedPerformance(4, 10, 120);

    expect(set4!.expectedDropPercent).toBeGreaterThan(set2!.expectedDropPercent);
  });

  it('defaults to 120s drop rate for unknown rest periods', () => {
    const result = getExpectedPerformance(2, 10, 90); // 90s not in table

    expect(result).not.toBeNull();
    expect(result!.expectedDropPercent).toBeCloseTo(EXPECTED_REP_DROP[120] * 100, 0);
  });
});

// =============================================================================
// isSetWithinExpectations() Tests
// =============================================================================

describe('isSetWithinExpectations()', () => {
  it('marks as within expectations when close', () => {
    const result = isSetWithinExpectations(8, 8, 0.5, 0.5);

    expect(result.withinExpectations).toBe(true);
    expect(result.assessment).toBe('On track');
  });

  it('identifies better than expected performance', () => {
    const result = isSetWithinExpectations(10, 8, 0.5, 0.5); // 25% more reps

    expect(result.withinExpectations).toBe(false);
    expect(result.assessment).toContain('better');
  });

  it('identifies below expected performance', () => {
    const result = isSetWithinExpectations(6, 8, 0.5, 0.5); // 25% fewer reps

    expect(result.withinExpectations).toBe(false);
    expect(result.assessment).toContain('below');
  });

  it('identifies velocity drop issues', () => {
    const result = isSetWithinExpectations(8, 8, 0.4, 0.5); // 20% velocity drop

    expect(result.withinExpectations).toBe(false);
    expect(result.assessment).toContain('Velocity');
  });

  it('respects custom tolerance', () => {
    // With default 15% tolerance, 10% deviation is within
    const defaultResult = isSetWithinExpectations(9, 8, 0.5, 0.5);
    expect(defaultResult.withinExpectations).toBe(true);

    // With 5% tolerance, 10% deviation is outside
    const strictResult = isSetWithinExpectations(9, 8, 0.5, 0.5, 0.05);
    expect(strictResult.withinExpectations).toBe(false);
  });

  it('calculates deviation percentages', () => {
    const result = isSetWithinExpectations(9, 8, 0.55, 0.5);

    expect(result.repDeviation).toBeCloseTo(12.5, 0); // (9-8)/8 * 100 = 12.5%
    expect(result.velocityDeviation).toBeCloseTo(10, 0); // (0.55-0.5)/0.5 * 100 = 10%
  });
});

// =============================================================================
// createAdjustment() Tests
// =============================================================================

describe('createAdjustment()', () => {
  it('creates weight adjustment record', () => {
    const adjustment = createAdjustment('weight', 'Velocity too high', 'high', 100, 105);

    expect(adjustment.type).toBe('weight');
    expect(adjustment.reason).toBe('Velocity too high');
    expect(adjustment.confidence).toBe('high');
    expect(adjustment.from).toBe(100);
    expect(adjustment.to).toBe(105);
  });

  it('creates rest adjustment record', () => {
    const adjustment = createAdjustment('rest', 'High fatigue', 'medium', 120, 180);

    expect(adjustment.type).toBe('rest');
    expect(adjustment.from).toBe(120);
    expect(adjustment.to).toBe(180);
  });

  it('handles rep range adjustments', () => {
    const adjustment = createAdjustment('reps', 'Adjusting rep target', 'low', [6, 8], [8, 10]);

    expect(adjustment.from).toEqual([6, 8]);
    expect(adjustment.to).toEqual([8, 10]);
  });

  it('handles undefined from/to', () => {
    const adjustment = createAdjustment('sets', 'Adding extra set', 'high');

    expect(adjustment.from).toBeUndefined();
    expect(adjustment.to).toBeUndefined();
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('EXPECTED_REP_DROP', () => {
  it('has higher drop for shorter rest', () => {
    expect(EXPECTED_REP_DROP[60]).toBeGreaterThan(EXPECTED_REP_DROP[120]);
    expect(EXPECTED_REP_DROP[120]).toBeGreaterThan(EXPECTED_REP_DROP[180]);
  });

  it('has common rest periods defined', () => {
    expect(EXPECTED_REP_DROP[60]).toBeDefined();
    expect(EXPECTED_REP_DROP[120]).toBeDefined();
    expect(EXPECTED_REP_DROP[180]).toBeDefined();
  });
});
